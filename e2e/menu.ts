import { expect, type Page } from "@playwright/test";

// The Menu: a tab of the sidebar (the phone's sheet, the desktop's left
// column), opened by the Menu button (the tab bar's, or the desktop's
// round button at the top right). Escape closes it.

/** The Menu's screen. */
export const menuScreen = (page: Page) => page.getByTestId("menu-screen");

/** Opens the Menu on a section ("Game", "Settings", "Help", "Admin"). */
export const openMenu = async (page: Page, section?: string) => {
    if (!(await menuScreen(page).isVisible())) {
        await page.getByRole("button", { name: "Menu", exact: true }).click();
    }
    await expect(menuScreen(page)).toBeVisible();
    if (section) {
        await menuScreen(page)
            .getByRole("radio", { name: section, exact: true })
            .click();
    }
};

/**
 * Closes the Menu (Escape). Joining ends when the join dialog closes,
 * which can come after the game shows "Live"; a dialog takes the Escape
 * itself, so that waits first.
 */
export const closeMenu = async (page: Page) => {
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    // A dialog still closing takes the Escape itself: wait it out.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (await menuScreen(page).isVisible()) {
        await page.keyboard.press("Escape");
    }
    await expect(menuScreen(page)).toHaveCount(0);
};
