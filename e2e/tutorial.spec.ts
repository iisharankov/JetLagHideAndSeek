import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { API_PORT, routeApi } from "./api";
import { expect, test } from "./fixtures";

// The tutorial on a first visit and on a game's link, on the desktop and
// the phone: offered once ("Show Tutorial"), short tours by role on the
// coach mark, examples drawn on the map, and the game usable throughout.

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

/** A shared game in Zürich canton, made straight on the test API. */
const newGame = async (request: APIRequestContext) => {
    const response = await request.post(
        `http://127.0.0.1:${API_PORT}/api/games`,
        {
            data: {
                playArea: { kind: "polygon", polygon: PLAY_AREA },
                zone: null,
                settings: {},
                questions: [],
                by: "Org",
            },
        },
    );
    expect(response.ok()).toBe(true);
    const { state } = (await response.json()) as { state: { id: string } };
    return state.id;
};

/** A phone with a name, its requests kept to our servers. */
const preparePhone = async (page: Page, name: string) => {
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    await page.addInitScript((name) => {
        localStorage.setItem("playerName", name);
    }, name);
};

/** A phone opening the game's link for the first time, tutorial on. */
const openLink = async (page: Page, id: string, name: string) => {
    await preparePhone(page, name);
    await page.goto(`/?game=${id}`);
};

const mark = (page: Page) => page.getByTestId("coach-mark");

/**
 * Clicks "Next" to the last step, checking the count on the way. `each`
 * sees every step it stops at (a step may go on by itself when tapped).
 */
const clickThrough = async (
    page: Page,
    each?: (step: string) => Promise<void>,
) => {
    const counter = mark(page).getByText(/^\d+ of \d+$/);
    const position = async () =>
        (await counter.innerText()).split(" of ").map(Number);
    await expect(counter).toBeVisible();
    const [, total] = await position();
    for (;;) {
        await each?.((await mark(page).getAttribute("data-tour-step")) ?? "");
        const [step] = await position();
        const last = step === total;
        await mark(page)
            .getByRole("button", { name: last ? "Finish" : "Next" })
            .click();
        if (last) break;
        await expect(counter).toHaveText(`${step + 1} of ${total}`);
    }
    await expect(mark(page)).toHaveCount(0);
    return total;
};

/** The examples' own layer on the map. */
const demo = (page: Page): Locator =>
    page.locator(".leaflet-tourDemo-pane path");

test("a first visit offers the setting-up tour, once", async ({
    page,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts; // keep the outside world blocked
    await page.goto("/");

    await expect(mark(page)).toContainText("New here?");
    await mark(page).getByRole("button", { name: "Show Tutorial" }).click();
    await expect(mark(page)).toContainText("Hide and Seek");
    // Nothing is dimmed or blocked: the Menu still opens under the tour.
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await menu.press("Escape");
    await expect(menu).toBeHidden();
    const total = await clickThrough(page);
    expect(total).toBeLessThanOrEqual(6);

    // Seen: not offered again on this phone.
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(mark(page)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});

test("a seeker opening a link gets the seeker tour, with examples in Zürich", async ({
    page,
    request,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts;
    const id = await newGame(request);
    await openLink(page, id, "Ana");
    // The join dialog first; the offer only after it.
    await expect(page.getByTestId("join-dialog")).toBeVisible();
    await expect(mark(page)).toHaveCount(0);
    await page.getByRole("button", { name: "I'm a seeker" }).click();
    await expect(page.getByTestId("join-dialog")).toBeHidden();
    await mark(page).getByRole("button", { name: "Show Tutorial" }).click();

    const seen: string[] = [];
    const total = await clickThrough(page, async (step) => {
        seen.push(step);
        if (step === "how-to-play") {
            await expect(mark(page)).toContainText("longest hide wins");
        }
        if (step === "radar") {
            // The example is drawn: shading and zones in its own layer.
            await expect(demo(page).first()).toBeAttached();
            await expect(page.locator(".tour-demo-label")).toContainText([
                "Seekers",
            ]);
        }
        if (step === "station-decides") {
            await expect(
                page.locator(".tour-demo-label", { hasText: "Wipkingen" }),
            ).toBeVisible();
        }
        if (step === "endgame") {
            await expect(mark(page)).toContainText("Found it");
            await expect(
                page.locator(".tour-demo-label", { hasText: "Hider's pin" }),
            ).toBeVisible();
        }
        if (step === "sidebar") {
            // Tapping the highlighted button goes on by itself, and opens
            // the sidebar like it always does.
            await page
                .locator('[data-tutorial-id="left-sidebar-trigger"] button')
                .click();
            await expect(mark(page)).toHaveAttribute("data-tour-step", "ask");
            seen.push("ask");
            await expect(
                page.getByRole("button", { name: "Add Question" }),
            ).toBeVisible();
        }
        if (step === "clock") {
            await expect(page.getByTestId("round-clock")).toBeVisible();
        }
    });
    expect(seen).toEqual(
        expect.arrayContaining([
            "how-to-play",
            "zones",
            "radar",
            "thermometer",
            "station-decides",
            "endgame",
            "pin",
            "sidebar",
            "ask",
            "send",
            "stations",
            "curses",
            "clock",
            "menu",
        ]),
    );
    expect(total).toBeLessThanOrEqual(16);
    // The examples are gone with the tour, names and all.
    await expect(demo(page)).toHaveCount(0);
    await expect(page.locator(".tour-demo-label")).toHaveCount(0);
    // The game is as it was: no question was made.
    await expect(page.getByTestId("question-game-state")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});

test("the hider may decline the tour: then the pointer to the station; the Menu has it later", async ({
    page,
    request,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts;
    const id = await newGame(request);
    await openLink(page, id, "Ben");
    await page.getByRole("button", { name: "I'm the hider" }).click();
    await page.getByLabel("Hider password").fill("secret");
    await page.getByRole("button", { name: "Become the hider" }).click();
    await expect(page.getByTestId("join-dialog")).toBeHidden();

    await expect(mark(page)).toContainText("hide and answer");
    await mark(page).getByRole("button", { name: "No thanks" }).click();
    await expect(mark(page)).toContainText("Pick your hiding spot");
    await mark(page).getByRole("button", { name: "Got it" }).click();
    await expect(mark(page)).toHaveCount(0);

    // Menu → Game → Help → Tutorial: Hider.
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Hider tutorial" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
    const seen: string[] = [];
    await clickThrough(page, async (step) => {
        seen.push(step);
        if (step === "pick") {
            await expect(page.getByTestId("hider-panel")).toContainText(
                "Pick your station",
            );
        }
        if (step === "station-then-pin") {
            await expect(mark(page)).toContainText("from your pin");
        }
    });
    // Before the station is set, the Research tab is there to point at.
    expect(seen).toEqual(
        expect.arrayContaining(["pick", "research", "answer", "hand", "menu"]),
    );
    expect(pageErrors).toEqual([]);
});

const STATION_QUERY = {
    elements: [
        {
            type: "node",
            id: 1,
            lat: 47.3779,
            lon: 8.5403,
            tags: { name: "Zürich HB", railway: "station" },
        },
        {
            type: "node",
            id: 2,
            lat: 47.3914,
            lon: 8.5118,
            tags: { name: "Zürich Altstetten", railway: "station" },
        },
    ],
};

/** A phone that has had its tours: only the tips are left to show. */
const veteran = async (page: Page, id: string, name: string) => {
    await preparePhone(page, name);
    await page.addInitScript(() => {
        localStorage.setItem(
            "tutorialsSeen",
            JSON.stringify({ seeker: true, hider: true, organiser: true }),
        );
    });
    // The app's own Overpass answers with two stations, and nothing else
    // (after routeApi: its "**/api/**" would take these too).
    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
                (route.request().postData() ?? "").includes("railway")
                    ? STATION_QUERY
                    : { elements: [] },
            ),
        }),
    );
    await page.goto(`/?game=${id}`);
};

test("tips come the first time something happens, once, and never over the station pointer", async ({
    page: ana,
    browser,
    request,
    externalHosts,
    pageErrors,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "two phones, sidebars open");
    void externalHosts;
    const id = await newGame(request);

    // Ana seeks: no tour offered (she has had it).
    await veteran(ana, id, "Ana");
    await ana.getByRole("button", { name: "I'm a seeker" }).click();
    await expect(ana.getByTestId("join-dialog")).toBeHidden();
    await ana.waitForTimeout(500);
    await expect(mark(ana)).toHaveCount(0);

    // Ben hides: the pointer to his station, which no tip covers.
    const ben = await (await browser.newContext()).newPage();
    await veteran(ben, id, "Ben");
    await ben.getByRole("button", { name: "I'm the hider" }).click();
    await ben.getByLabel("Hider password").fill("secret");
    await ben.getByRole("button", { name: "Become the hider" }).click();
    await expect(mark(ben)).toContainText("Pick your hiding spot");
    await ben
        .getByTestId("hider-panel")
        .locator("li", { hasText: "Zürich HB" })
        .getByRole("button", { name: "Mine" })
        .click({ timeout: 30_000 });
    await ben.getByTestId("hider-done").click();
    // Its job done, the pointer goes.
    await expect(mark(ben)).toHaveCount(0);

    // Ana hears the hider is ready: start the clock.
    await expect(mark(ana)).toContainText("The hider is ready");
    await expect(mark(ana)).toContainText("Start");
    await mark(ana).getByRole("button", { name: "Got it" }).click();

    // Ana asks; Ben's first question gets a tip.
    await ana.getByRole("button", { name: "Add Question" }).click();
    await ana.getByRole("button", { name: "Add Radius" }).click();
    await ana.getByRole("button", { name: "Send to the hider" }).click();
    await expect(mark(ben)).toContainText("A question");
    await expect(mark(ben)).toContainText("within five minutes");

    // Ben answers: the tip about his cards replaces the older tip.
    await ben.getByRole("radio", { name: /^Questions/ }).click();
    await ben.getByRole("button", { name: "No", exact: true }).click();
    await ben.getByRole("button", { name: /^Send answer/ }).click();
    await expect(mark(ben)).toContainText("Your cards");
    // Ana's first answer.
    await expect(mark(ana)).toContainText("Answered");

    // Each once per phone.
    const seen = async (page: Page) =>
        Object.keys(
            JSON.parse(
                (await page.evaluate(() =>
                    localStorage.getItem("tutorialsSeen"),
                )) ?? "{}",
            ),
        );
    expect(await seen(ana)).toEqual(
        expect.arrayContaining(["tip:seeker-hider-ready", "tip:seeker-answer"]),
    );
    expect(await seen(ben)).toEqual(
        expect.arrayContaining(["tip:hider-question", "tip:hider-draw"]),
    );
    expect(pageErrors).toEqual([]);
});
