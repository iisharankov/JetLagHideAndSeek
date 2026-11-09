import type {
    APIRequestContext,
    Browser,
    BrowserContextOptions,
    Page,
    TestInfo,
} from "@playwright/test";

import { API_PORT, routeApi } from "./api";
import { expect, test } from "./fixtures";

// Who you are in a shared game: the same player after a restart, another
// phone by the player code, and teams with passwords whose members all
// hide together.

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
const NORTH = { latitude: 47.3869, longitude: 8.5403 };

const API = `http://127.0.0.1:${API_PORT}/api`;

const newGame = async (
    request: APIRequestContext,
    settings: Record<string, unknown> = {},
) => {
    const response = await request.post(`${API}/games`, {
        data: {
            playArea: { kind: "polygon", polygon: PLAY_AREA },
            zone: null,
            settings,
            questions: [],
            by: "Org",
        },
    });
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { state: { id: string } }).state.id;
};

/**
 * A phone (the project's size) opening the game's link: a name, or the
 * storage of a phone from before (a restarted browser), and maybe a place.
 */
const phone = async (
    browser: Browser,
    testInfo: TestInfo,
    id: string,
    {
        name,
        at,
        storageState,
    }: {
        name?: string;
        at?: { latitude: number; longitude: number };
        storageState?: BrowserContextOptions["storageState"];
    },
) => {
    const context = await browser.newContext({
        viewport: testInfo.project.use.viewport ?? { width: 1366, height: 900 },
        ...(at ? { geolocation: at, permissions: ["geolocation"] } : {}),
        ...(storageState ? { storageState } : {}),
    });
    const page = await context.newPage();
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ elements: [] }),
        }),
    );
    await page.addInitScript((name) => {
        localStorage.setItem("showTutorials", "false");
        if (name) localStorage.setItem("playerName", name);
    }, name ?? "");
    await page.goto(`/?game=${id}`);
    return page;
};

const openGameMenu = async (page: Page) => {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("radio", { name: "Game" }).click();
    await expect(page.getByTestId("game-connection")).toHaveText(/Live/);
};

test("a restarted browser is the same player: no joining again", async ({
    browser,
    request,
}, testInfo) => {
    const id = await newGame(request);
    const ana = await phone(browser, testInfo, id, { name: "Ana" });
    await ana.getByRole("button", { name: "I'm a seeker" }).click();
    await expect(ana.getByTestId("join-dialog")).toHaveCount(0);
    const storageState = await ana.context().storageState();
    await ana.context().close();

    // The same phone's storage, a new browser: straight back in.
    const again = await phone(browser, testInfo, id, { storageState });
    await openGameMenu(again);
    await expect(again.getByTestId("join-dialog")).toHaveCount(0);
    await expect(again.getByTestId("game-role")).toContainText(
        "Ana · a seeker",
    );
    await expect(again.getByTestId("players-list")).toContainText(
        "Players (1)",
    );
});

test("the player code moves a player, hider and all, to another phone", async ({
    browser,
    request,
}, testInfo) => {
    const id = await newGame(request);
    const ana = await phone(browser, testInfo, id, { name: "Ana" });
    await ana.getByRole("button", { name: "I'm the hider" }).click();
    await expect(ana.getByTestId("hider-panel")).toBeVisible();
    await openGameMenu(ana);
    const code = (await ana.getByTestId("player-code").innerText()).trim();
    expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);

    // Ben's phone (a new phone for Ana, say): the code, typed any old way.
    const ben = await phone(browser, testInfo, id, { name: "Ben" });
    await ben.getByLabel("Player code").fill(code.toLowerCase());
    await ben.getByRole("button", { name: "Rejoin with the code" }).click();
    await expect(ben.getByTestId("join-dialog")).toHaveCount(0);
    await expect(ben.getByTestId("hider-panel")).toBeVisible();
    // The first phone is told, and is out of the game.
    await expect(ana.getByText(/You continued on another phone/)).toBeVisible();
    await openGameMenu(ben);
    await expect(ben.getByTestId("game-role")).toContainText("Ana · the hider");
    await expect(ben.getByTestId("player-code")).toHaveText(code);
    await expect(ben.getByTestId("players-list")).toContainText("Players (1)");
});

test("teams: the hiding team's phones are all the hider's, and their positions stay with them", async ({
    browser,
    request,
}, testInfo) => {
    const id = await newGame(request, { teams: true });
    // Ana makes Owls, who hide this round.
    const ana = await phone(browser, testInfo, id, { name: "Ana", at: HB });
    await expect(ana.getByTestId("join-dialog")).toContainText(
        "which team are you in",
    );
    await ana.getByLabel("New team's name").fill("Owls");
    await ana.getByLabel("Team password").fill("owls-pass");
    await ana.getByLabel("We hide this round").check();
    await ana
        .getByRole("button", { name: "Join as Ana · hiding with Owls" })
        .click();
    await expect(ana.getByTestId("hider-panel")).toBeVisible();

    // Ben joins Owls with the password: a hider too, with nothing else to
    // type; never asked for his location, never sending it.
    const ben = await phone(browser, testInfo, id, { name: "Ben", at: NORTH });
    const sent: string[] = [];
    ben.on("request", (request) => {
        if (request.url().endsWith("/position")) sent.push(request.url());
    });
    await ben.getByRole("radio", { name: "Owls (hiding)" }).click();
    await expect(ben.getByTestId("hiding-team-note")).toContainText(
        "Everyone in the team is a hider",
    );
    await ben.getByLabel("Team password").fill("owls-pass");
    await ben
        .getByRole("button", { name: "Join as Ben · hiding with Owls" })
        .click();
    await expect(ben.getByTestId("hider-panel")).toBeVisible();
    await expect(ben.getByTestId("location-prompt")).toHaveCount(0);

    // Cleo makes Foxes and seeks: asked for her location, and the hiders
    // see her.
    const cleo = await phone(browser, testInfo, id, { name: "Cleo", at: HB });
    await cleo.getByRole("radio", { name: "+ New team" }).click();
    await cleo.getByLabel("New team's name").fill("Foxes");
    await cleo.getByLabel("Team password").fill("foxes-pass");
    await cleo
        .getByRole("button", { name: "Join as Cleo · seeking with Foxes" })
        .click();
    // On a phone the prompt is in the questions' sheet: open it.
    if (testInfo.project.name === "phone") {
        await cleo.getByTestId("sidebar-trigger").click();
    }
    const prompt = cleo.getByTestId("location-prompt");
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: "Turn on location" }).click();
    await expect(ana.locator(".seeker-marker")).toHaveCount(1);
    await expect(ben.locator(".seeker-marker")).toHaveCount(1);
    // No hider on Cleo's map; Ben's phone never sent where it is.
    await expect(cleo.locator(".seeker-marker")).toHaveCount(0);
    expect(sent).toEqual([]);
});

test("a wrong team password keeps you out, with the reason", async ({
    browser,
    request,
}, testInfo) => {
    const id = await newGame(request, { teams: true });
    const made = await request.post(`${API}/games/${id}/join`, {
        headers: { "X-Player-Key": "e2e-key-ana-000000001" },
        data: { name: "Ana", team: { name: "Owls", password: "owls-pass" } },
    });
    expect(made.ok()).toBe(true);

    const ben = await phone(browser, testInfo, id, { name: "Ben" });
    await ben.getByRole("radio", { name: "Owls" }).click();
    await ben.getByLabel("Team password").fill("owls-pas");
    await ben
        .getByRole("button", { name: "Join as Ben · seeking with Owls" })
        .click();
    await expect(ben.getByText("Wrong team password.")).toBeVisible();
    await expect(ben.getByTestId("join-dialog")).toBeVisible();
    await ben.getByLabel("Team password").fill("owls-pass");
    await ben
        .getByRole("button", { name: "Join as Ben · seeking with Owls" })
        .click();
    await expect(ben.getByTestId("join-dialog")).toHaveCount(0);
});
