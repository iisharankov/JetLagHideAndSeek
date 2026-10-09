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

const openMenu = async (page: Page, section: "Game" | "Hider" | "Settings") => {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("radio", { name: section }).click();
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
    await page.keyboard.press("Escape");

    // Ana adds a radius question: a draft only seekers see.
    await page.getByRole("button", { name: "Add Question" }).click();
    await page.getByRole("button", { name: "Add Radius" }).click();
    const anaState = page.getByTestId("question-game-state");
    await expect(anaState).toHaveAttribute("data-state", "draft");
    // A draft's guessed answer shades the map as speculation (amber). The
    // default 50 km radar covers this whole play area, so make it 5 km.
    await page.locator('input[type="number"]').first().fill("5");
    const speculation = page.locator('path[stroke="#f59e0b"]');
    await expect(speculation.first()).toBeAttached({ timeout: 20_000 });

    // Ben opens the link and becomes the hider (Menu → Hider); until then the
    // hider controls are faded. He doesn't see the draft.
    const ben = await newPhone(browser);
    await preparePhone(ben, "Ben", link);
    await openMenu(ben, "Hider");
    await expect(ben.getByTestId("hider-controls")).toHaveAttribute(
        "aria-disabled",
        "true",
    );
    await ben.getByRole("button", { name: "I'm the hider" }).click();
    await ben.getByLabel(/hider password/i).fill("secret");
    await ben.getByRole("button", { name: "Become the hider" }).click();
    await expect(ben.getByTestId("hider-status")).toContainText(
        "the hider in this game",
    );
    await expect(ben.getByTestId("hider-controls")).not.toHaveAttribute(
        "aria-disabled",
        "true",
    );
    await ben.keyboard.press("Escape");
    await expect(ben.getByTestId("question-game-state")).toHaveCount(0);
    // The settings came with the game: a small game.
    await openMenu(ben, "Game");
    await expect(ben.getByTestId("game-settings-summary")).toContainText(
        "Small",
    );
    await ben.keyboard.press("Escape");

    // Ana sends it; Ben sees it. With hider mode on (his pin starts at the
    // map's centre, next to Ana's question) his phone suggests "Yes", and
    // nothing is sent until he picks an answer. He answers "No".
    await page.getByRole("button", { name: "Send to the hider" }).click();
    const benState = ben.getByTestId("question-game-state");
    await expect(benState).toHaveAttribute("data-state", "asked");
    // Before answering, Ben's map shows the question's pin and its outline.
    await expect(ben.locator('img[alt="Question"]')).toHaveCount(1);
    await expect(ben.locator('path[stroke="#60a5fa"]').first()).toBeAttached({
        timeout: 20_000,
    });
    await openMenu(ben, "Hider");
    await ben.getByRole("switch", { name: /^Hider mode/ }).click();
    await ben.keyboard.press("Escape");
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
    // Seekers can't delete an answered question (so no "deleted" banner).
    await expect(
        page.getByRole("button", {
            name: "Answered: only the hider can delete it",
        }),
    ).toBeDisabled();

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
    await ben.getByRole("radio", { name: /Curses/ }).click();
    await ben.getByRole("button", { name: "Cast a curse" }).click();
    await ben.getByRole("button", { name: "Curse of the Cairn" }).click();
    await ben.getByRole("button", { name: /Cast it/ }).click();
    await page.getByRole("radio", { name: /Curses/ }).click();
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
