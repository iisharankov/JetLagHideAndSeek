import type {
    APIRequestContext,
    Browser,
    BrowserContextOptions,
} from "@playwright/test";

import { createGameOnApi, routeApi } from "./api";
import { chooseStation } from "./ask";
import { expect, test } from "./fixtures";

// The thermometer as the rulebook plays it, with the phones' locations
// faked: started where the seekers are, asked once they've travelled the
// distance as the crow flies, answered by the hider.

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
/** 1.2 km north of Zürich HB. */
const NORTH = { latitude: 47.3779 + 1.2 / 111.195, longitude: 8.5403 };

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

/** A phone of the project's size at a place (or none), opening the link. */
const phone = async (
    browser: Browser,
    viewport: { width: number; height: number },
    name: string,
    id: string,
    at?: { latitude: number; longitude: number },
) => {
    const options: BrowserContextOptions = {
        viewport,
        ...(at ? { geolocation: at, permissions: ["geolocation"] } : {}),
    };
    const page = await (await browser.newContext(options)).newPage();
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
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

test("a thermometer starts where the seekers are, is asked once they've travelled, and is answered", async ({
    browser,
    request,
}, testInfo) => {
    test.setTimeout(150_000);
    const onPhone = testInfo.project.name === "phone";
    const viewport = testInfo.project.use.viewport!;
    const id = await newGame(request);

    // Ben hides at Zürich HB.
    const ben = await phone(browser, viewport, "Ben", id);
    await ben.getByRole("button", { name: "I'm the hider" }).click();
    await chooseStation(ben, "Zürich HB");
    await ben.getByTestId("hider-done").click();

    // Ana seeks from HB, her location on.
    const ana = await phone(browser, viewport, "Ana", id, HB);
    await ana.getByRole("button", { name: "I'm a seeker" }).click();
    await expect(ana.getByTestId("join-dialog")).toHaveCount(0);
    if (onPhone) await ana.getByRole("radio", { name: /^Questions/ }).click();
    await ana
        .getByTestId("location-prompt")
        .getByRole("button", { name: "Turn on location" })
        .click();
    // Ask → Thermometer: a distance, and it starts where she is.
    await ana.getByRole("button", { name: "Ask a question" }).click();
    await ana.getByTestId("ask-thermometer").click();
    const choices = ana.getByTestId("question-subtype");
    await choices.getByRole("button", { name: "1 km", exact: true }).click();
    await expect(choices.getByTestId("asked-from")).toContainText(
        "47.3779° N, 8.5403° E",
    );
    await choices
        .getByRole("button", { name: "Start the thermometer (1 km)" })
        .click();
    const anaState = ana.getByTestId("question-game-state");
    await expect(anaState).toHaveAttribute("data-state", "armed");
    const ask = ana.getByTestId("thermometer-ask");
    await expect(ask).toBeDisabled();
    await expect(ask).toContainText("1 km to go");
    // The start pin only, no end yet; the line to where she is.
    await expect(ana.locator('img[alt="Question"]')).toHaveCount(1);
    await expect(ana.locator("path.thermometer-travel")).toHaveCount(1);

    // Ben hears it, with nothing to answer yet.
    await expect(ben.getByText(/Thermometer started/)).toBeVisible();
    await ben.getByRole("radio", { name: /^Questions/ }).click();
    await expect(ben.getByText("Started · travelling")).toBeVisible();

    // Ana travels 1.2 km north: Ask lights up.
    const shading = ana.locator(".leaflet-overlay-pane path").first();
    const before = await shading.getAttribute("d");
    await ana.context().setGeolocation(NORTH);
    await expect(ask).toBeEnabled({ timeout: 20_000 });
    await expect(ana.getByTestId("thermometer-covered")).toHaveText(
        "1 of 1 km",
    );
    await ask.click();
    await expect(anaState).toHaveAttribute("data-state", "asked");
    // Start and end pins now.
    await expect(ana.locator('img[alt="Question"]')).toHaveCount(2);

    // Ben answers: colder (he's at the start).
    await expect(ben.getByText(/New question: Thermometer 1 km/)).toBeVisible();
    const benState = ben.getByTestId("question-game-state");
    await expect(benState).toContainText("The app suggests Colder", {
        timeout: 20_000,
    });
    await ben.getByRole("button", { name: "Colder", exact: true }).click();
    await ben.getByRole("button", { name: /^Send answer/ }).click();
    await expect(anaState).toHaveAttribute("data-state", "answered");
    await expect(anaState).toContainText("Colder");
    // Ana's map: the far half is ruled out now.
    await expect
        .poll(async () => shading.getAttribute("d"), { timeout: 20_000 })
        .not.toBe(before);
});
