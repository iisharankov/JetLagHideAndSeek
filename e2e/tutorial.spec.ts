import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { createGameOnApi, routeApi } from "./api";
import { askQuestion, onPhone } from "./ask";
import { expect, test } from "./fixtures";
import { menuScreen, openMenu } from "./menu";

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
    const response = await createGameOnApi(request, {
        playArea: { kind: "polygon", polygon: PLAY_AREA },
        zone: null,
        settings: {},
        questions: [],
        by: "Org",
    });
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
        // On, or further: a step whose target isn't there is left out.
        await expect
            .poll(async () => (await position())[0])
            .toBeGreaterThan(step);
    }
    await expect(mark(page)).toHaveCount(0);
    return total;
};

/** The examples' own layer on the map. */
const demo = (page: Page): Locator =>
    page.locator(".leaflet-tourDemo-pane path");

test("a first visit offers the setting-up tour, once, and it opens the Menu and the setup to show them", async ({
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
    const menu = menuScreen(page);
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // Each step opens what it's about and points at it; the note stays
    // usable over them (clickThrough taps its Next).
    const setup = page.getByRole("dialog", { name: /New shared game/ });
    const seen: string[] = [];
    const total = await clickThrough(page, async (step) => {
        seen.push(step);
        if (step === "start") {
            // A new phone has no creator code yet: the tour shows where it
            // goes (Start appears once one is typed).
            await expect(menu).toBeVisible();
            await expect(menu.getByLabel(/Have a code/)).toBeInViewport();
        }
        if (step === "play-area") {
            await expect(menu).toBeHidden();
            await expect(setup).toContainText("1 of 3");
            await expect(
                setup.getByTestId("change-play-area"),
            ).toBeInViewport();
        }
        if (step === "stations") {
            await expect(setup).toContainText("2 of 3");
            await expect(
                setup.getByRole("switch", {
                    name: /Seekers can show the hiding zones/,
                }),
            ).toBeInViewport();
        }
        if (step === "places") {
            await expect(setup).toContainText("3 of 3");
            await expect(
                setup.getByRole("button", {
                    name: "Review places on the map…",
                }),
            ).toBeInViewport();
        }
        if (step === "menu") {
            await expect(setup).toBeHidden();
            await expect(
                menu.getByRole("heading", { name: "Help" }),
            ).toBeInViewport();
        }
    });
    expect(seen).toEqual([
        "welcome",
        "start",
        "play-area",
        "size",
        "stations",
        "places",
        "invite",
        "menu",
    ]);
    expect(total).toBe(8);
    // What the tour opened is closed again, and no game was started.
    await expect(menu).toBeHidden();
    await expect(setup).toBeHidden();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(menu.getByLabel(/Have a code/)).toBeVisible();
    await expect(
        menu.getByRole("button", { name: "Start a shared game" }),
    ).toHaveCount(0);
    await menu.press("Escape");

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
        if (step === "example") {
            await expect(mark(page)).toContainText("start at Zürich HB");
        }
        if (step === "radar") {
            // The example is drawn: shading and zones in its own layer, and
            // the game's own layers wait meanwhile.
            await expect(demo(page).first()).toBeAttached();
            await expect(page.locator(".tour-demo-label")).toContainText([
                "Seekers",
            ]);
            await expect(page.locator(".leaflet-overlay-pane")).toHaveCSS(
                "visibility",
                "hidden",
            );
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
            if (onPhone(page)) {
                await page.getByRole("radio", { name: /^Questions/ }).click();
            } else {
                await page
                    .locator('[data-tutorial-id="left-sidebar-trigger"] button')
                    .click();
            }
            await expect(mark(page)).toHaveAttribute("data-tour-step", "ask");
            seen.push("ask");
            await expect(
                page.getByRole("button", { name: "Ask a question" }),
            ).toBeVisible();
        }
        if (step === "clock") {
            await expect(page.getByTestId("round-clock")).toBeVisible();
        }
        if (step === "follow-me") {
            // The Menu opens on Settings, at the switch.
            await expect(
                menuScreen(page).getByRole("switch", {
                    name: /Follow me \(GPS\)/,
                }),
            ).toBeInViewport();
        }
        if (step === "menu") {
            await expect(
                menuScreen(page).getByRole("heading", { name: "Help" }),
            ).toBeInViewport();
        }
    });
    expect(seen).toEqual(
        expect.arrayContaining([
            "how-to-play",
            "example",
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
            "follow-me",
            "menu",
        ]),
    );
    expect(total).toBeLessThanOrEqual(18);
    // The Menu the tour opened is closed again.
    await expect(menuScreen(page)).toHaveCount(0);
    // The game's layers are back.
    await expect(page.locator(".leaflet-overlay-pane")).toHaveCSS(
        "visibility",
        "visible",
    );
    // The examples are gone with the tour, names and all.
    await expect(demo(page)).toHaveCount(0);
    await expect(page.locator(".tour-demo-label")).toHaveCount(0);
    // The game is as it was: no question was made.
    await expect(page.getByTestId("question-game-state")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});

test("skipping a tour while it shows the Menu closes it, and the Menu works as before", async ({
    page,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts;
    await page.goto("/");
    await mark(page).getByRole("button", { name: "Show Tutorial" }).click();
    await mark(page).getByRole("button", { name: "Next" }).click();
    const menu = menuScreen(page);
    await expect(mark(page)).toHaveAttribute("data-tour-step", "start");
    await expect(menu).toBeVisible();
    await mark(page).getByRole("button", { name: "Skip tutorial" }).click();
    await expect(mark(page)).toHaveCount(0);
    await expect(menu).toHaveCount(0);
    // The Menu as always.
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});

test("skipping a tour halfway leaves the sidebar as it was", async ({
    page,
    request,
    externalHosts,
    pageErrors,
}, testInfo) => {
    void externalHosts;
    const id = await newGame(request);
    await openLink(page, id, "Ana");
    await page.getByRole("button", { name: "I'm a seeker" }).click();
    const open = testInfo.project.name === "desktop";
    // The desktop's sidebar starts open, the phone's sheet closed.
    const addQuestion = page
        .locator('[data-sidebar="sidebar"]')
        .getByRole("button", { name: "Ask a question" });
    // (The desktop's closed sidebar slides off the screen.)
    if (open) await expect(addQuestion).toBeInViewport();
    await mark(page).getByRole("button", { name: "Show Tutorial" }).click();
    // The first step, drawn, before its Next (a click on the offer's note
    // as it turns into the first step was lost now and then).
    await expect(mark(page)).toHaveAttribute("data-tour-step", "how-to-play");
    await mark(page).getByRole("button", { name: "Next" }).click();
    // An example: the sidebar makes way for the map.
    await expect(mark(page)).toHaveAttribute("data-tour-step", "example");
    if (open) await expect(addQuestion).not.toBeInViewport();
    await mark(page).getByRole("button", { name: "Skip tutorial" }).click();
    await expect(mark(page)).toHaveCount(0);
    if (open) await expect(addQuestion).toBeInViewport();
    else await expect(addQuestion).toBeHidden();
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
    await expect(page.getByTestId("join-dialog")).toBeHidden();

    await expect(mark(page)).toContainText("How hiding works");
    await mark(page).getByRole("button", { name: "No thanks" }).click();
    await expect(mark(page)).toContainText("Pick your hiding spot");
    await mark(page).getByRole("button", { name: "Got it" }).click();
    await expect(mark(page)).toHaveCount(0);

    // Menu → Help → Tutorial: Hider.
    await openMenu(page, "Help");
    await page.getByRole("button", { name: "Hider tutorial" }).click();
    await expect(menuScreen(page)).toHaveCount(0);
    const seen: string[] = [];
    await clickThrough(page, async (step) => {
        seen.push(step);
        if (step === "pick") {
            await expect(page.getByTestId("hider-panel")).toContainText(
                "Pick your station",
            );
        }
        if (step === "zone") {
            // The hider's own zone in the example, and none of the real
            // stations they're choosing from drawn over it.
            await expect(
                page.locator(".tour-demo-label", {
                    hasText: "Your zone: Wipkingen",
                }),
            ).toBeVisible();
            await expect(page.locator(".leaflet-overlay-pane")).toHaveCSS(
                "visibility",
                "hidden",
            );
            await expect(page.locator(".leaflet-marker-pane")).toHaveCSS(
                "visibility",
                "hidden",
            );
        }
        if (step === "endgame") {
            await expect(mark(page)).toContainText("Start the end game");
        }
    });
    // Before the station is set, the Research tab is there to point at.
    expect(seen).toEqual(
        expect.arrayContaining([
            "how-to-play",
            "zone",
            "answering",
            "station-decides",
            "endgame",
            "pin",
            "pick",
            "research",
            "answer",
            "hand",
            "menu",
        ]),
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
    await askQuestion(ana, "Radius", "draft");
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
