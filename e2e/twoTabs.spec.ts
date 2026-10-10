import type { Page } from "@playwright/test";

import { routeApi } from "./api";
import { expect, test } from "./fixtures";

// Two tabs of the same browser (shared storage): the hider's tab must not
// turn the seeker's tab into the hider's, and nothing may crash.

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

const prepare = async (page: Page) => {
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
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

const openMenu = async (page: Page) => {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("radio", { name: "Game" }).click();
};

test("a second tab becoming the hider leaves the first tab a seeker", async ({
    page,
    externalHosts,
    pageErrors,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar open on desktop");
    void externalHosts;
    await prepare(page);
    await page.goto("/");
    await page.evaluate((area) => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem("polyGeoJSON", JSON.stringify(area));
    }, PLAY_AREA);
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: "Start a shared game" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Start the game" }).click();
    await expect(page.getByTestId("game-connection")).toHaveText(/Live/);
    const link = page.url();
    await closeMenu(page);

    // The same browser, a second tab: it becomes the hider.
    const other = await page.context().newPage();
    await prepare(other);
    await other.goto(link);
    // Every tab joins for itself: the join dialog asks for a name and the
    // role, and the hider's password.
    await other.getByLabel("Your name").fill("Ben");
    await other.getByRole("button", { name: "I'm the hider" }).click();
    await other.getByLabel("Hider password").fill("secret");
    await other.getByRole("button", { name: "Become the hider" }).click();
    await expect(other.getByTestId("hider-panel")).toBeVisible();

    // The first tab is still a seeker: its new question is a draft, and
    // nothing broke on the way.
    await page.getByRole("button", { name: "Add Question" }).click();
    await page.getByRole("button", { name: "Add Radius" }).click();
    await expect(page.getByTestId("question-game-state")).toHaveAttribute(
        "data-state",
        "draft",
    );
    await expect(page.getByText(/Couldn't apply the shared game/)).toHaveCount(
        0,
    );
    expect(pageErrors).toEqual([]);
    await other.close();
});
