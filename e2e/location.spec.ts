import type {
    APIRequestContext,
    Browser,
    BrowserContextOptions,
    Page,
} from "@playwright/test";

import { API_PORT, createGameOnApi, routeApi } from "./api";
import { askQuestion } from "./ask";
import { expect, test } from "./fixtures";

// The phones' positions, with the browser's location faked: the seekers'
// on the hider's map, questions sent from where the seekers are, and the
// hider's pin following them.

const PLAY_AREA = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [8.3, 47.2],
                        [8.8, 47.2],
                        [8.8, 47.6],
                        [8.3, 47.6],
                        [8.3, 47.2],
                    ],
                ],
            },
        },
    ],
};

const HB = { latitude: 47.3779, longitude: 8.5403 };
/** About 1 km north of Zürich HB: outside its 500 m zone. */
const NORTH = { latitude: 47.3869, longitude: 8.5403 };

const STATIONS = {
    elements: [
        {
            type: "node",
            id: 1,
            lat: HB.latitude,
            lon: HB.longitude,
            tags: { name: "Zürich HB", railway: "station" },
        },
    ],
};

const newGame = async (request: APIRequestContext) => {
    const response = await createGameOnApi(request, {
        playArea: { kind: "polygon", polygon: PLAY_AREA },
        zone: null,
        settings: {},
        questions: [],
        by: "Org",
    });
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { state: { id: string } }).state.id;
};

/** A phone at a place (or with no location at all), opening the game's link. */
const phone = async (
    browser: Browser,
    name: string,
    id: string,
    at?: { latitude: number; longitude: number },
) => {
    const options: BrowserContextOptions = {
        viewport: { width: 1366, height: 900 },
        ...(at ? { geolocation: at, permissions: ["geolocation"] } : {}),
    };
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    // After routeApi: its "**/api/**" would take these too.
    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
                (route.request().postData() ?? "").includes("railway")
                    ? STATIONS
                    : { elements: [] },
            ),
        }),
    );
    await page.addInitScript((name) => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem("playerName", name);
    }, name);
    await page.goto(`/?game=${id}`);
    return page;
};

const joinAsHider = async (page: Page) => {
    await page.getByRole("button", { name: "I'm the hider" }).click();
    await page
        .getByTestId("hider-panel")
        .locator("li", { hasText: "Zürich HB" })
        .getByRole("button", { name: "Mine" })
        .click({ timeout: 30_000 });
    await page.getByTestId("hider-done").click();
};

test("the seekers are asked to share where they are, and the hider sees them", async ({
    browser,
    request,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "phones side by side");
    const id = await newGame(request);
    const ana = await phone(browser, "Ana", id, HB);
    // Told before choosing.
    await expect(ana.getByTestId("seekers-tracked")).toContainText(
        "the hider sees where you are",
    );
    await ana.getByRole("button", { name: "I'm a seeker" }).click();
    // Asked, up front, until it's on.
    const prompt = ana.getByTestId("location-prompt");
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: "Turn on location" }).click();
    await expect(prompt).toHaveCount(0);
    await expect(ana.locator(".follow-me-marker")).toHaveCount(1);
    // Her own position is her blue dot, not a seeker's marker.
    await expect(ana.locator(".seeker-marker")).toHaveCount(0);

    const ben = await phone(browser, "Ben", id);
    await joinAsHider(ben);
    const seeker = ben.locator(".seeker-marker");
    await expect(seeker).toHaveCount(1);
    await expect(
        ben.locator(".leaflet-tooltip", { hasText: "Ana" }),
    ).toContainText("Ana · just now");
    // The hider's own phone has no prompt: only the seekers share.
    await expect(ben.getByTestId("location-prompt")).toHaveCount(0);
});

test("a question whose pin is away from the seeker asks where it's sent from", async ({
    browser,
    request,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "phones side by side");
    const id = await newGame(request);
    const ana = await phone(browser, "Ana", id, NORTH);
    await ana.getByRole("button", { name: "I'm a seeker" }).click();
    // A draft made before her location was on starts mid-map, far off.
    await askQuestion(ana, "Radius", "draft");
    await ana
        .getByTestId("location-prompt")
        .getByRole("button", { name: "Turn on location" })
        .click();
    await expect(ana.locator(".follow-me-marker")).toHaveCount(1);

    const send = ana.getByRole("button", { name: "Send to the hider" });
    await send.click();
    const askFrom = ana.getByTestId("ask-from");
    await expect(askFrom).toContainText("from where you are");
    await expect(ana.locator(".ask-from-line")).toHaveCount(1);
    // Not yet: nothing sent, the line goes.
    await askFrom.getByRole("button", { name: "Not yet" }).click();
    await expect(askFrom).toHaveCount(0);
    await expect(ana.locator(".ask-from-line")).toHaveCount(0);

    await send.click();
    await askFrom.getByRole("button", { name: "Send from where I am" }).click();
    await expect(ana.getByText(/waiting for the hider/)).toBeVisible();
    // Sent from her position: the game has it.
    const state = await (
        await request.get(`http://127.0.0.1:${API_PORT}/api/games/${id}`)
    ).json();
    const [entry] = Object.values(state.state.questions) as {
        state: string;
        question: { data: { lat: number; lng: number } };
    }[];
    expect(entry.state).toBe("asked");
    expect(entry.question.data.lat).toBeCloseTo(NORTH.latitude, 4);
    expect(entry.question.data.lng).toBeCloseTo(NORTH.longitude, 4);
});

test("the hider's pin follows their GPS, inside their zone", async ({
    browser,
    request,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "phones side by side");
    const id = await newGame(request);
    const ben = await phone(browser, "Ben", id, NORTH);
    await joinAsHider(ben);
    const pin = ben.locator(".hider-marker");
    await expect(pin).toHaveCount(1);
    await expect(ben.getByText(/^Pin: 47\.37790°N/)).toBeVisible();
    await ben.getByRole("switch", { name: /Move my pin with GPS/ }).click();
    // A kilometre north: outside the zone, so the pin waits at its edge.
    await expect(ben.getByTestId("pin-at-edge")).toBeVisible();
    await expect(ben.getByText(/^Pin: 47\.382\d\d°N/)).toBeVisible();
    // Back at the station: the pin comes along (at most every 15 s).
    await ben.context().setGeolocation(HB);
    await expect(ben.getByText(/^Pin: 47\.3779\d°N/)).toBeVisible({
        timeout: 25_000,
    });
    await expect(ben.getByTestId("pin-at-edge")).toHaveCount(0);
});
