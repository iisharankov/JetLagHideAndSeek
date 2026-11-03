import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The Questions tab: one row per question ("Question 2 · Thermometer"),
// which opens its whole card in the tab's place; back to the list.

const add = async (page: Page, kind: string) => {
    await page.getByRole("button", { name: "Add Question" }).click();
    await page.getByRole("button", { name: `Add ${kind}` }).click();
};

test("questions are rows; a row, or a pin, opens its card", async ({
    page,
    pageErrors,
}, testInfo) => {
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await page.addInitScript(() =>
        localStorage.setItem("showTutorials", "false"),
    );
    await page.goto("/");
    if (testInfo.project.name === "phone") {
        await page
            .locator('[data-tutorial-id="left-sidebar-trigger"] button')
            .click();
    }
    const back = page.getByRole("button", { name: "All questions" });
    const list = page.getByTestId("question-list");

    // A new question opens at once, to be set up.
    await add(page, "Radius");
    await expect(page.getByText("Question 1 · Radar")).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Add Question" }),
    ).toBeHidden();
    await back.click();
    for (const kind of ["Thermometer", "Matching", "Measuring", "Tentacles"]) {
        await add(page, kind);
        await back.click();
    }

    // The list: short rows, in order.
    const rows = list.getByRole("button");
    await expect(rows).toHaveText([
        /^Question 1 · Radar/,
        /^Question 2 · Thermometer/,
        /^Question 3 · Matching/,
        /^Question 4 · Measuring/,
        /^Question 5 · Tentacles/,
    ]);
    // On a phone's half-open sheet three at least; all on a desktop.
    await expect(
        rows.nth(testInfo.project.name === "phone" ? 2 : 4),
    ).toBeInViewport();

    await rows.nth(1).click();
    await expect(page.getByText("Question 2 · Thermometer")).toBeVisible();
    await expect(list).toHaveCount(0);
    await back.click();
    await expect(list).toBeVisible();

    // A question's pin on the map opens its card too.
    if (testInfo.project.name === "phone") {
        await page.getByRole("button", { name: "Close sidebar" }).click();
    }
    await page
        .locator('img.leaflet-marker-icon[alt="Question"]')
        .first()
        .click({ force: true });
    await expect(back).toBeVisible();
    await expect(page.getByText(/^Question \d · /)).toBeVisible();
    expect(pageErrors).toEqual([]);
});
