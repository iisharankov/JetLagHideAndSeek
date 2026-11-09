import type {
    APIRequestContext,
    Browser,
    BrowserContextOptions,
    Page,
} from "@playwright/test";

import { API_PORT, createGameOnApi, routeApi } from "./api";
import { expect, test } from "./fixtures";

// Two phones in a game made on the test API: who starts the end game when
// the seekers can't see the stations, and who may delete a game.

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

const STATIONS = {
    elements: [
        {
            type: "node",
            id: 1,
            lat: 47.3779,
            lon: 8.5403,
            tags: { name: "Zürich HB", railway: "station" },
        },
    ],
};

const newGame = async (
    request: APIRequestContext,
    settings: Record<string, unknown> = {},
) => {
    const response = await createGameOnApi(request, {
        playArea: { kind: "polygon", polygon: PLAY_AREA },
        zone: null,
        settings,
        questions: [],
        by: "Ana",
    });
    expect(response.ok()).toBe(true);
    return (await response.json()) as {
        state: { id: string };
        organiserToken: string;
    };
};

/** A phone with no tutorial, a name and the game's link (and maybe the key of the game it started). */
const phone = async (
    browser: Browser,
    name: string,
    id: string,
    organiserToken?: string,
    options: BrowserContextOptions = {},
) => {
    const page = await (
        await browser.newContext({
            viewport: { width: 1366, height: 900 },
            ...options,
        })
    ).newPage();
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
    await page.addInitScript(
        ({ name, id, organiserToken }) => {
            localStorage.setItem("showTutorials", "false");
            localStorage.setItem("playerName", name);
            if (organiserToken) {
                localStorage.setItem(
                    "organiserTokens",
                    JSON.stringify({ [id]: organiserToken }),
                );
            }
        },
        { name, id, organiserToken },
    );
    await page.goto(`/?game=${id}`);
    return page;
};

const stationsTab = (page: Page) =>
    page.getByRole("radio", { name: "Stations" });

test("seekers who can't see the stations: the hider starts the end game", async ({
    browser,
    request,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "two phones, sidebars open");
    const { state } = await newGame(request, { seekersSeeStations: false });

    const ana = await phone(browser, "Ana", state.id);
    await ana.getByRole("button", { name: "I'm a seeker" }).click();
    await expect(ana.getByTestId("join-dialog")).toBeHidden();
    // Nothing to show in a Stations tab: there is none.
    await expect(ana.getByRole("radio", { name: /^Questions/ })).toBeVisible();
    await expect(stationsTab(ana)).toHaveCount(0);

    const ben = await phone(browser, "Ben", state.id);
    await ben.getByRole("button", { name: "I'm the hider" }).click();
    await ben
        .getByTestId("hider-panel")
        .locator("li", { hasText: "Zürich HB" })
        .getByRole("button", { name: "Mine" })
        .click({ timeout: 30_000 });
    await ben.getByTestId("hider-done").click();

    // The seekers reach the zone: Ben says so.
    ben.once("dialog", (dialog) => void dialog.accept());
    await ben.getByRole("button", { name: "Start the end game" }).click();
    await expect(ben.getByTestId("hider-endgame")).toContainText(
        "You started it",
    );
    await expect(ben.getByTestId("pin-locked")).toBeVisible();

    // Ana hears it, and the Stations tab shows the end game, with no undo:
    // it's the hider's call.
    await expect(
        ana.getByText(/The hider says you're in their zone/),
    ).toBeVisible();
    await stationsTab(ana).click();
    await expect(ana.getByTestId("endgame")).toContainText(
        "the hider says you're in their zone",
    );
    await expect(
        ana.getByRole("button", { name: "Wrong station? Undo" }),
    ).toHaveCount(0);

    // Started by mistake: Ben takes it back, and the tab goes again.
    await ben.getByRole("button", { name: "Started by mistake? Undo" }).click();
    await expect(ben.getByTestId("hider-start-endgame")).toBeVisible();
    await expect(stationsTab(ana)).toHaveCount(0);
});

test("only the phone that started a game deletes it; the others forget it", async ({
    browser,
    request,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "two phones, menus open");
    const { state, organiserToken } = await newGame(request);

    const ana = await phone(browser, "Ana", state.id, organiserToken);
    await ana.getByRole("button", { name: "I'm a seeker" }).click();
    const ben = await phone(browser, "Ben", state.id);
    await ben.getByRole("button", { name: "I'm a seeker" }).click();

    const games = async (page: Page) => {
        await page.getByRole("button", { name: "Menu", exact: true }).click();
        await page.getByRole("radio", { name: "Game" }).click();
        const list = page.getByTestId("games-list");
        await list.getByRole("button", { name: /^Your games/ }).click();
        return list;
    };

    // Ben joined: he can only forget it.
    const bens = await games(ben);
    await expect(bens.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(bens.getByRole("button", { name: "Forget" })).toBeVisible();

    // Ana started it: she may delete it, for everyone.
    const anas = await games(ana);
    await expect(anas).toContainText("you started it");
    await anas.getByRole("button", { name: "Delete" }).click();
    await ana
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .click();
    await expect(ana.getByText("Game deleted.")).toBeVisible();
    await expect(ben.getByText("This game was deleted.")).toBeVisible();
});

test("a second phone of the hiding team gets the station, not the pick; only one phone moves the pin", async ({
    browser,
    request,
}, testInfo) => {
    test.setTimeout(150_000);
    const viewport = testInfo.project.use.viewport!;
    /** About 100 m east and 200 m north of Zürich HB: inside its zone. */
    const EAST = { latitude: 47.3779, longitude: 8.5416 };
    const NORTH = { latitude: 47.3797, longitude: 8.5403 };
    const { state } = await newGame(request, { teams: true });
    const readyAt = async () =>
        (
            await (
                await request.get(
                    `http://127.0.0.1:${API_PORT}/api/games/${state.id}`,
                )
            ).json()
        ).state.hiderReadyAt;

    // Ben makes Foxes, hides, and picks Zürich HB.
    const ben = await phone(browser, "Ben", state.id, undefined, {
        viewport,
        geolocation: EAST,
        permissions: ["geolocation"],
    });
    await ben.getByLabel("New team's name").fill("Foxes");
    await ben.getByLabel("Team password").fill("foxes-pass");
    await ben.getByLabel("We hide this round").check();
    await ben
        .getByRole("button", { name: "Join as Ben · hiding with Foxes" })
        .click();
    await ben
        .getByTestId("hider-panel")
        .locator("li", { hasText: "Zürich HB" })
        .getByRole("button", { name: "Mine" })
        .click({ timeout: 30_000 });
    await ben.getByTestId("hider-done").click();
    await expect(ben.getByTestId("hider-station")).toContainText(
        "Your station: Zürich HB",
    );
    await expect.poll(readyAt).not.toBeNull();
    const placedAt = await readyAt();

    // Dan joins Foxes later: the station is there, nothing to pick, and the
    // seekers aren't told the hider is in place again.
    const dan = await phone(browser, "Dan", state.id, undefined, {
        viewport,
        geolocation: NORTH,
        permissions: ["geolocation"],
    });
    await dan.getByRole("radio", { name: "Foxes (hiding)" }).click();
    await dan.getByLabel("Team password").fill("foxes-pass");
    await dan
        .getByRole("button", { name: "Join as Dan · hiding with Foxes" })
        .click();
    await expect(dan.getByTestId("hider-station")).toContainText(
        "Your station: Zürich HB",
    );
    await expect(dan.getByText("Pick your station.")).toHaveCount(0);
    await expect(dan.getByTestId("hider-done")).toHaveCount(0);
    await expect(dan.getByTestId("station-locked")).toBeVisible();
    expect(await readyAt()).toBe(placedAt);

    // Both turn on "Move my pin with GPS": the one turned on last drives
    // the pin, the other gives way within half a minute.
    const follow = (page: Page) =>
        page.getByRole("switch", { name: /^Move my pin with GPS/ });
    await follow(ben).click();
    await expect(ben.getByTestId("pin-driver")).toHaveText(
        "The pin follows this phone.",
    );
    await follow(dan).click();
    await expect(dan.getByTestId("pin-driver")).toHaveText(
        "The pin follows this phone.",
        { timeout: 20_000 },
    );
    await expect(ben.getByTestId("pin-driver")).toContainText(
        "Dan's phone is moving the pin",
    );
    await expect(follow(ben)).toHaveAttribute("aria-checked", "false", {
        timeout: 45_000,
    });
    await expect(ben.getByText(/this one stopped/)).toBeVisible();
    await expect(follow(dan)).toHaveAttribute("aria-checked", "true");
});
