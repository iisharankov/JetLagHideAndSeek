import type { Browser, Page } from "@playwright/test";

import { routeApi } from "./api";
import { expect, test } from "./fixtures";

// Two phones in one shared game: a seeker (Ana) and the hider (Ben).

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

// A tiny valid PNG (1 × 1 pixel).
const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);

/** A phone: no tutorial, a name, only our own server (plus the test API). */
const preparePhone = async (page: Page, name: string, url = "/") => {
    await page.route("**/*", (route) =>
        new URL(route.request().url()).hostname === "127.0.0.1"
            ? route.fallback()
            : route.abort(),
    );
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    await page.goto("/");
    await page.evaluate(
        ({ name, area }) => {
            localStorage.setItem("showTutorials", "false");
            localStorage.setItem("playerName", name);
            localStorage.setItem("polyGeoJSON", JSON.stringify(area));
        },
        { name, area: PLAY_AREA },
    );
    await page.goto(url);
};

const openMenu = async (page: Page, section: "Game" | "Settings") => {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("radio", { name: section }).click();
};

/** Closes the menu; a dialog that is still closing may swallow an Escape. */
const closeMenu = async (page: Page) => {
    const menu = page.getByRole("dialog", { name: "Menu" });
    for (let tries = 0; tries < 10 && (await menu.isVisible()); tries++) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
    }
    await expect(menu).toBeHidden();
};

const newPhone = async (browser: Browser) =>
    (
        await browser.newContext({ viewport: { width: 1366, height: 900 } })
    ).newPage();

test("a seeker asks, the hider answers, and both phones stay in step", async ({
    page,
    browser,
    externalHosts,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar open on desktop");
    void externalHosts;

    // Ana starts a shared game: the settings screens, then start.
    await preparePhone(page, "Ana");
    await openMenu(page, "Game");
    await page.getByRole("button", { name: "Start a shared game" }).click();
    await expect(page.getByText("1 of 3: Game")).toBeVisible();
    await page.getByRole("radio", { name: "Small" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Hiding zone radius (km)")).toHaveValue("0.5");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("3 of 3: Questions")).toBeVisible();
    await page.getByRole("button", { name: "Start the game" }).click();
    await expect(page).toHaveURL(/[?&]game=[A-Za-z0-9]{8}/);
    await expect(page.getByTestId("game-connection")).toHaveText(/Live/);
    const link = page.url();
    await closeMenu(page);

    // Ana adds a radius question: a draft only seekers see.
    await page.getByRole("button", { name: "Add Question" }).click();
    await page.getByRole("button", { name: "Add Radius" }).click();
    const anaState = page.getByTestId("question-game-state");
    await expect(anaState).toHaveAttribute("data-state", "draft");
    // A draft's guessed answer shades the map as speculation (amber); the
    // 5 km radar card keeps it inside this play area.
    await page.getByRole("button", { name: "5 km", exact: true }).click();
    // Drafts shade the map dashed, in the question's own colour.
    const speculation = page.locator('path[stroke-dasharray="6 4"]');
    await expect(speculation.first()).toBeAttached({ timeout: 20_000 });

    // Ben opens the link and becomes the hider (the join dialog asks for
    // his name and role; the hider gives a password). The sidebar shows
    // his Hider tab. He doesn't see the draft.
    const ben = await newPhone(browser);
    await preparePhone(ben, "Ben", link);
    // Opening the link asks who he is: the hider, with a password.
    await ben.getByRole("button", { name: "I'm the hider" }).click();
    await ben.getByLabel("Hider password").fill("secret");
    await ben.getByRole("button", { name: "Become the hider" }).click();
    await expect(ben.getByTestId("join-dialog")).toBeHidden();
    await expect(ben.getByTestId("hider-panel")).toContainText(
        "Pick your station",
    );
    await expect(ben.getByTestId("question-game-state")).toHaveCount(0);
    // The hider doesn't ask questions.
    await expect(ben.getByRole("button", { name: "Add Question" })).toHaveCount(
        0,
    );
    // The settings came with the game: a small game, and he's the hider.
    await openMenu(ben, "Game");
    await expect(ben.getByTestId("game-settings-summary")).toContainText(
        "Small",
    );
    await expect(ben.getByTestId("game-role")).toContainText("the hider");
    await closeMenu(ben);

    // Ana sends it; Ben sees it. With hider mode on (his pin starts at the
    // map's centre, next to Ana's question) his phone suggests "Yes", and
    // nothing is sent until he picks an answer. He answers "No".
    await page.getByRole("button", { name: "Send to the hider" }).click();
    // His phone says so (a toast; a buzz and a beep on a real phone).
    await expect(ben.getByText(/New question: Radar/)).toBeVisible();
    // His sidebar is on the Hider tab; the Questions tab counts what waits.
    await ben.getByRole("radio", { name: /^Questions/ }).click();
    const benState = ben.getByTestId("question-game-state");
    await expect(benState).toHaveAttribute("data-state", "asked");
    // Before answering, Ben's map shows the question's pin and its outline.
    await expect(ben.locator('img[alt="Question"]')).toHaveCount(1);
    await expect(ben.locator('path[stroke="#60a5fa"]').first()).toBeAttached({
        timeout: 20_000,
    });
    await expect(benState).toContainText("Hider mode suggests: Yes", {
        timeout: 20_000,
    });
    await expect(anaState).toHaveAttribute("data-state", "asked");
    // The buttons keep their order (Yes, No) whatever is suggested.
    await expect(
        benState.getByRole("button", { name: /^(Yes|No)$/ }),
    ).toHaveText(["Yes", "No"]);
    await ben.getByRole("button", { name: "No", exact: true }).click();

    // Ana's phone shows the answer, now as a confirmed answer on the map.
    await expect(anaState).toHaveAttribute("data-state", "answered");
    await expect(anaState).toContainText("Answered: No");
    await expect(speculation).toHaveCount(0, { timeout: 20_000 });
    // Seekers can't delete an answered question (so no "deleted" banner),
    // and the answer isn't theirs to toggle any more: the card shows none.
    await expect(
        page.getByRole("button", { name: "Delete question" }),
    ).toBeDisabled();
    await expect(page.getByRole("radio", { name: "Inside" })).toHaveCount(0);

    // Photos: Ana asks for a tree, Ben sends one, Ana sees it.
    await page.getByRole("radio", { name: /Photos/ }).click();
    await page
        .locator("summary")
        .filter({ has: page.getByText("Tree", { exact: true }) })
        .getByRole("button", { name: "Ask" })
        .click();
    await ben.getByRole("radio", { name: /Photos/ }).click();
    await ben
        .getByTestId("photo-request")
        .locator('input[type="file"]')
        .setInputFiles({
            name: "tree.png",
            mimeType: "image/png",
            buffer: PNG,
        });
    await expect(
        page.getByTestId("photo-request").getByRole("img"),
    ).toBeVisible();

    // Curses: Ben casts one, Ana sees it and clears it.
    await ben.getByRole("radio", { name: /Cards/ }).click();
    // Ben (real deck) records the curse he drew, then casts it from his hand.
    await ben.getByRole("button", { name: "Draw cards" }).click();
    await ben.getByRole("button", { name: /^Radar/ }).click();
    await ben
        .locator("li", { hasText: "Curse of the Cairn" })
        .getByRole("button")
        .click();
    await expect(ben.getByTestId("hand")).toContainText("Your hand (1/6)");
    await ben
        .getByTestId("hand-card")
        .getByRole("button", { name: "Cast" })
        .click();
    // The curse pops up on Ana's phone; she reads it and closes it.
    await expect(
        page.getByRole("dialog", { name: /cast Curse of the Cairn/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^OK/ }).click();
    await page.getByRole("radio", { name: /Cards/ }).click();
    const curse = page.getByTestId("active-curse");
    await expect(curse).toContainText("Curse of the Cairn");
    await curse.getByRole("button", { name: "Cleared" }).click();
    await expect(ben.getByTestId("active-curse")).toHaveCount(0);
    // Opening the plain address later doesn't drop Ana back into the game;
    // the Game tab offers to rejoin.
    await page.goto("/");
    await openMenu(page, "Game");
    await expect(page.getByTestId("game-connection")).toHaveCount(0);
    await page.getByRole("button", { name: "Rejoin it" }).click();
    await expect(page.getByTestId("game-connection")).toHaveText(/Live/);
    await expect(page).toHaveURL(/[?&]game=/);

    await ben.context().close();
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

/** The app's own Overpass answers with two stations, and nothing else. */
const mockStations = (page: Page) =>
    page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
                (route.request().postData() ?? "").includes("railway")
                    ? STATION_QUERY
                    : { elements: [] },
            ),
        }),
    );

test("the hider picks a station; the seekers' pick starts the end game", async ({
    page,
    browser,
    externalHosts,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar open on desktop");
    void externalHosts;

    await preparePhone(page, "Ana");
    await mockStations(page);
    await openMenu(page, "Game");
    await page.getByRole("button", { name: "Start a shared game" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Start the game" }).click();
    await expect(page.getByTestId("game-connection")).toHaveText(/Live/);
    const link = page.url();
    await closeMenu(page);

    // Ben, the hider, picks Altstetten in his Hider tab and is done.
    const ben = await newPhone(browser);
    await preparePhone(ben, "Ben", link);
    await mockStations(ben);
    // Opening the link asks who he is: the hider, with a password.
    await ben.getByRole("button", { name: "I'm the hider" }).click();
    await ben.getByLabel("Hider password").fill("secret");
    await ben.getByRole("button", { name: "Become the hider" }).click();
    const benPanel = ben.getByTestId("hider-panel");
    await expect(benPanel).toContainText("Pick your station");
    await benPanel
        .locator("li", { hasText: "Zürich Altstetten" })
        .getByRole("button", { name: "Mine" })
        .click({ timeout: 30_000 });
    await expect(ben.getByTestId("hider-station")).toContainText(
        "Zürich Altstetten",
    );
    await ben.getByTestId("hider-done").click();
    await expect(ben.getByTestId("hider-station")).toContainText(
        "Your station: Zürich Altstetten",
    );
    await expect(
        benPanel.getByRole("switch", { name: /Show my pin/ }),
    ).toBeVisible();

    // Ana turns the zones on, finds the station and starts the end game.
    await page.getByRole("radio", { name: "Stations" }).click();
    await page.getByRole("switch", { name: /Show hiding zones/ }).click();
    await expect(page.getByTestId("remaining-stations-count")).toContainText(
        "2 stations left",
        { timeout: 30_000 },
    );
    await page
        .locator("li", { hasText: "Zürich Altstetten" })
        .getByRole("button", { name: "Found it" })
        .click();
    await page.getByRole("button", { name: "Start the end game" }).click();
    await expect(page.getByTestId("endgame")).toContainText(
        "End game at Zürich Altstetten",
    );
    // Only that zone is left: the other station is out.
    await expect(page.getByTestId("remaining-stations-count")).toContainText(
        "1 station left",
        { timeout: 30_000 },
    );
    // The hider's phone knows: answers come from the pin now.
    await expect(ben.getByTestId("hider-endgame")).toContainText(
        "your station",
    );

    // The hiding clock: Ben (real deck) records a time bonus he drew; Ana
    // starts the clock and, being in the end game, can stop it; Ben sends
    // his bonuses and Ana sees the total.
    await ben.getByRole("radio", { name: /Cards/ }).click();
    await ben.getByRole("button", { name: "Draw cards" }).click();
    await ben.getByRole("button", { name: /^Radar/ }).click();
    await ben
        .locator("li", { hasText: "Time bonus 3 min" })
        .getByRole("button")
        .click();
    await expect(ben.getByTestId("hand")).toContainText("Your hand (1/6)");
    const anaClock = page.getByTestId("round-clock");
    await anaClock.getByRole("button", { name: "Start" }).click();
    await expect(ben.getByTestId("round-clock")).toHaveAttribute(
        "data-state",
        "running",
    );
    await anaClock.getByRole("button", { name: "Found!" }).click();
    await page.getByRole("button", { name: "Yes, found" }).click();
    await expect(ben.getByTestId("round-clock")).toContainText("Found after");
    await ben.getByRole("button", { name: "Send my bonuses (3 min)" }).click();
    await expect(anaClock).toContainText("+ 3 min bonuses");

    // Wrong station? Back to the whole map, for everyone.
    await page.getByRole("button", { name: "Wrong station? Undo" }).click();
    await expect(page.getByTestId("endgame")).toHaveCount(0);
    await expect(ben.getByTestId("hider-endgame")).toHaveCount(0);

    await ben.context().close();
});

test("with the virtual deck the game deals the hider's cards", async ({
    page,
    browser,
    externalHosts,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar open on desktop");
    void externalHosts;

    await preparePhone(page, "Ana");
    await openMenu(page, "Game");
    await page.getByRole("button", { name: "Start a shared game" }).click();
    await page.getByRole("radio", { name: /Digital deck/ }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Start the game" }).click();
    await expect(page.getByTestId("game-connection")).toHaveText(/Live/);
    const link = page.url();
    await closeMenu(page);
    await page.getByRole("button", { name: "Add Question" }).click();
    await page.getByRole("button", { name: "Add Radius" }).click();
    await page.getByRole("button", { name: "Send to the hider" }).click();

    const ben = await newPhone(browser);
    await preparePhone(ben, "Ben", link);
    // Opening the link asks who he is: the hider, with a password.
    await ben.getByRole("button", { name: "I'm the hider" }).click();
    await ben.getByLabel("Hider password").fill("secret");
    await ben.getByRole("button", { name: "Become the hider" }).click();
    await expect(ben.getByTestId("hider-panel")).toBeVisible();
    await ben.getByRole("radio", { name: /^Questions/ }).click();
    await ben.getByRole("button", { name: "No", exact: true }).click();

    // Answering earned a draw, dealt at once: 2 cards, Ben keeps 1.
    await ben.getByRole("radio", { name: /Cards/ }).click();
    const pending = ben.getByTestId("pending-cards");
    await expect(
        pending.getByRole("button", { name: /^Keep \d+\/\d+/ }),
    ).toBeDisabled();
    await pending
        .getByRole("listitem")
        .first()
        .getByRole("button", { name: "Keep", exact: true })
        .click();
    await pending.getByRole("button", { name: "Keep 1/1" }).click();
    await expect(ben.getByTestId("hand")).toContainText("Your hand (1/6)");
    await expect(ben.getByTestId("clock-bonus")).toHaveCount(0);

    // Ana only learns how many cards Ben holds.
    await page.getByRole("radio", { name: /Cards/ }).click();
    await expect(page.getByText(/The hider holds 1 card/)).toBeVisible();
    await expect(page.getByTestId("hand")).toHaveCount(0);

    await ben.context().close();
});

/** Ben (real deck) records a card he drew, then casts it from his hand. */
const castFromRealDeck = async (ben: Page, name: string) => {
    await ben.getByRole("button", { name: "Draw cards" }).click();
    await ben.getByRole("button", { name: /^Radar/ }).click();
    await ben.locator("li", { hasText: name }).getByRole("button").click();
    await ben
        .getByTestId("hand-card")
        .filter({ hasText: name })
        .getByRole("button", { name: "Cast" })
        .click();
};

test("curses on the seekers: no asking until cleared, questions taken away, the memory's die, awards", async ({
    page,
    browser,
    externalHosts,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar open on desktop");
    void externalHosts;

    await preparePhone(page, "Ana");
    await openMenu(page, "Game");
    await page.getByRole("button", { name: "Start a shared game" }).click();
    await page.getByRole("radio", { name: "Small" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Start the game" }).click();
    await expect(page.getByTestId("game-connection")).toHaveText(/Live/);
    const link = page.url();
    await closeMenu(page);
    await page.getByRole("button", { name: "Add Question" }).click();
    await page.getByRole("button", { name: "Add Radius" }).click();
    await page.getByRole("button", { name: "5 km", exact: true }).click();
    const send = page.getByRole("button", { name: "Send to the hider" });
    await expect(send).toBeEnabled();
    const banner = page.getByTestId("curse-banner");
    await expect(banner).toHaveCount(0);

    const ben = await newPhone(browser);
    await preparePhone(ben, "Ben", link);
    await ben.getByRole("button", { name: "I'm the hider" }).click();
    await ben.getByLabel("Hider password").fill("secret");
    await ben.getByRole("button", { name: "Become the hider" }).click();
    await expect(ben.getByTestId("hider-panel")).toBeVisible();
    await ben.getByRole("radio", { name: /Cards/ }).click();

    // A curse that stops the asking: Ana can't send until it's cleared.
    await castFromRealDeck(ben, "Curse of the Luxury Car");
    await page.getByRole("button", { name: /^OK/ }).click();
    await expect(banner).toContainText("Curse of the Luxury Car");
    await expect(send).toBeDisabled();
    await expect(page.getByTestId("send-refusal")).toContainText(
        "Curse of the Luxury Car",
    );
    await page.getByRole("radio", { name: /Cards/ }).click();
    await page
        .getByTestId("active-curse")
        .getByRole("button", { name: "Cleared" })
        .click();
    await page.getByRole("radio", { name: /^Questions/ }).click();
    await expect(banner).toHaveCount(0);
    await expect(send).toBeEnabled();

    // The Drained Brain: Ben chooses three questions, gone for his run.
    await castFromRealDeck(ben, "Curse of the Drained Brain");
    await page.getByRole("button", { name: /^OK/ }).click();
    await expect(page.getByTestId("send-refusal")).toContainText(
        "Curse of the Drained Brain",
    );
    const chooser = ben.getByTestId("drained-brain-chooser");
    const take = chooser.getByRole("button", { name: /^Take these away/ });
    await expect(take).toBeDisabled();
    await chooser.getByRole("button", { name: "Radar 500 m" }).click();
    await chooser
        .getByRole("button", { name: "Thermometer", exact: true })
        .click();
    // Only one per category: a second radar replaces the first.
    await chooser.getByRole("button", { name: "Radar 1 km" }).click();
    await expect(take).toHaveText("Take these away (2/3)");
    await chooser.getByRole("button", { name: "Radar 500 m" }).click();
    await chooser
        .locator("section", {
            has: ben.locator("h3", { hasText: "Tentacles" }),
        })
        .getByRole("button")
        .first()
        .click();
    await expect(take).toHaveText("Take these away (3/3)");
    await take.click();
    await expect(chooser).toBeHidden();
    // Ana's phone shows what she lost.
    await expect(
        page.getByRole("dialog", { name: /took questions away/ }),
    ).toContainText("Radar 500 m, Thermometer, Tentacles: Museums");
    await page.getByRole("button", { name: /^OK/ }).click();
    await expect(banner).toContainText(
        "took away: Radar 500 m, Thermometer, Tentacles: Museums.",
    );
    await expect(ben.getByTestId("taken-away")).toContainText("Taken away");
    // It lasts the run: nobody clears it.
    await expect(
        ben
            .getByTestId("active-curse")
            .getByRole("button", { name: "Cleared" }),
    ).toHaveCount(0);
    // Ana's 5 km question is fine; the 500 m radar and the thermometer aren't.
    await expect(send).toBeEnabled();
    await expect(
        page.getByRole("button", { name: "500 m", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Add Question" }).click();
    await expect(
        page.getByRole("button", { name: "Add Thermometer" }),
    ).toBeDisabled();
    await expect(
        page.getByRole("button", { name: "Add Matching" }),
    ).toBeEnabled();
    await page.keyboard.press("Escape");

    // The Spotty Memory: Ana's die names a category she loses until her
    // next question.
    await castFromRealDeck(ben, "Curse of the Spotty Memory");
    await page.getByRole("button", { name: /^OK/ }).click();
    await expect(send).toBeDisabled();
    await banner.getByRole("button", { name: "4: Matching" }).click();
    await expect(banner).toContainText("Matching questions are disabled");
    await expect(send).toBeEnabled();
    await page.getByRole("button", { name: "Add Question" }).click();
    await expect(
        page.getByRole("button", { name: "Add Matching" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    // Her next question makes her roll again.
    await send.click();
    await expect(page.getByTestId("question-game-state")).toHaveAttribute(
        "data-state",
        "asked",
    );
    await expect(banner).toContainText("roll a die");

    // Awards: minutes the hider gets on top of the hand's time bonuses.
    await ben.getByLabel("Minutes to award").fill("10");
    await ben.getByLabel("Reason").fill("the egg cracked");
    await ben.getByRole("button", { name: "Award", exact: true }).click();
    await expect(ben.getByTestId("awards")).toContainText(
        "+10 min: the egg cracked",
    );
    await page.getByRole("radio", { name: /Cards/ }).click();
    await expect(page.getByTestId("awards")).toContainText("+10 min");
    await ben.getByRole("radio", { name: /^Questions/ }).click();
    await ben
        .getByTestId("round-clock")
        .getByRole("button", { name: "Start" })
        .click();
    await expect(ben.getByTestId("clock-bonus")).toHaveText("+10:00");

    await ben.context().close();
});
