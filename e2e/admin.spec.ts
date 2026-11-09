import type { Browser, Page, TestInfo } from "@playwright/test";

import { ADMIN_CODE, routeApi } from "./api";
import { expect, test } from "./fixtures";

// Who may make games: the admin code opens Menu → Admin, where the admin
// makes a creator code for a friend; the friend starts games with it until
// it's revoked. Everyone else only joins by link.

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

/** A phone (the project's size) with a play area drawn, no tutorial, no code. */
const phone = async (browser: Browser, testInfo: TestInfo, name: string) => {
    const context = await browser.newContext({
        viewport: testInfo.project.use.viewport ?? { width: 1366, height: 900 },
    });
    const page = await context.newPage();
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    await page.addInitScript(
        ({ name, area }) => {
            localStorage.setItem("showTutorials", "false");
            localStorage.setItem("playerName", name);
            if (!localStorage.getItem("polyGeoJSON")) {
                localStorage.setItem("polyGeoJSON", JSON.stringify(area));
            }
        },
        { name, area: PLAY_AREA },
    );
    await page.goto("/");
    return page;
};

const menu = (page: Page) => page.getByRole("dialog", { name: "Menu" });

const openMenu = async (page: Page, section = "Game") => {
    if (!(await menu(page).isVisible())) {
        await page.getByRole("button", { name: "Menu", exact: true }).click();
    }
    await menu(page).getByRole("radio", { name: section }).click();
};

const typeCode = async (page: Page, code: string) => {
    await menu(page)
        .getByLabel(/Have a code/)
        .fill(code);
    await menu(page).getByRole("button", { name: "Save" }).click();
};

const startGame = async (page: Page) => {
    await menu(page)
        .getByRole("button", { name: "Start a shared game" })
        .click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Start the game" }).click();
};

test("only a code starts games: the admin makes one for a friend, and revokes it", async ({
    browser,
}, testInfo) => {
    // Ben has no code: he can join games, not start them. (Each project's
    // run has its own Ben: they share the test server.)
    const friend = `Ben ${testInfo.project.name}`;
    const ben = await phone(browser, testInfo, "Ben");
    await openMenu(ben);
    await expect(menu(ben).getByLabel(/Have a code/)).toBeVisible();
    await expect(
        menu(ben).getByRole("button", { name: "Start a shared game" }),
    ).toHaveCount(0);
    // A made-up code is refused.
    await typeCode(ben, "AAAA-BBBB-CCCC");
    await expect(ben.getByText(/That code doesn't work/)).toBeVisible();

    // The admin types the admin code: Menu → Admin, and a code for Ben.
    const admin = await phone(browser, testInfo, "Ivan");
    await openMenu(admin);
    await typeCode(admin, ADMIN_CODE);
    await openMenu(admin, "Admin");
    const panel = admin.getByTestId("admin-panel");
    await panel.getByPlaceholder(/Whose code/).fill(friend);
    await panel.getByRole("button", { name: "New code" }).click();
    const made = panel.getByTestId("new-code");
    await expect(made).toContainText(`${friend}'s code`);
    const code = (await made.locator("p.font-mono").innerText()).trim();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // Ben types it: he can start a game now.
    await typeCode(ben, code);
    await expect(menu(ben).getByTestId("my-code")).toContainText(
        `Creator code "${friend}"`,
    );
    await startGame(ben);
    await expect(ben.getByTestId("join-dialog")).toBeVisible();
    await ben.getByRole("button", { name: "I'm a seeker" }).click();
    await expect(ben.getByTestId("join-dialog")).toHaveCount(0);

    // The admin sees the game and that Ben's code made one today, and
    // revokes the code.
    await openMenu(admin, "Game");
    await openMenu(admin, "Admin");
    await expect(panel.getByTestId("admin-games")).toContainText(`(${friend})`);
    const row = panel.getByTestId("codes-list").locator("li", {
        hasText: friend,
    });
    await expect(row).toContainText("1 of 5 today");
    admin.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(row).toContainText("revoked");

    // Ben's next game is refused, with the reason; the code is forgotten.
    await openMenu(ben);
    await menu(ben).getByRole("button", { name: "Leave game" }).click();
    await startGame(ben);
    await expect(ben.getByText(/no longer works/)).toBeVisible();
    await ben.keyboard.press("Escape");
    await openMenu(ben);
    await expect(menu(ben).getByLabel(/Have a code/)).toBeVisible();
});
