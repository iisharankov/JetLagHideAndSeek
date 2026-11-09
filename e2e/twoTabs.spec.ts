import type { Page } from "@playwright/test";

import { giveCreatorCode, routeApi } from "./api";
import { askQuestion } from "./ask";
import { expect, test } from "./fixtures";
import { closeMenu, openMenu } from "./menu";

// Two tabs of the same browser (shared storage) are the same player: the
// second tab doesn't ask who you are, has the first tab's role, and nothing
// crashes.

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

test("a second tab of the same browser is the same player, with nothing to type", async ({
    page,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts;
    await prepare(page);
    await giveCreatorCode(page);
    await page.goto("/");
    await page.evaluate((area) => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem("polyGeoJSON", JSON.stringify(area));
    }, PLAY_AREA);
    await page.goto("/");
    await openMenu(page, "Game");
    await page.getByRole("button", { name: "Start a shared game" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Start the game" }).click();
    // Starting asks who you are, like opening the link does.
    const join = page.getByTestId("join-dialog");
    await join.getByLabel("Your name").fill("Ana");
    await join.getByRole("button", { name: "I'm a seeker" }).click();
    await expect(page.getByTestId("game-connection")).toHaveText(/Live/);
    const link = page.url();
    await closeMenu(page);

    // The same browser, a second tab: Ana again, a seeker, no questions.
    const other = await page.context().newPage();
    await prepare(other);
    await other.goto(link);
    await openMenu(other, "Game");
    await expect(other.getByTestId("game-connection")).toHaveText(/Live/);
    await expect(other.getByTestId("join-dialog")).toHaveCount(0);
    await expect(other.getByTestId("game-role")).toContainText(
        "Ana · a seeker",
    );
    await expect(other.getByTestId("players-list")).toContainText(
        "Players (1)",
    );
    await closeMenu(other);

    // A question from the first tab is a seeker's draft, and nothing broke.
    await askQuestion(page, "Radius", "draft");
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
