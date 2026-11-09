import { expect, test } from "./fixtures";
import { menuScreen, openMenu } from "./menu";

test("one Menu holds game and settings, and no hider switch", async ({
    page,
    externalHosts,
}, testInfo) => {
    void externalHosts;
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("showTutorials", "false"));
    await page.reload();

    // The old bottom buttons are gone, and so is the hider badge.
    await expect(page.getByRole("button", { name: "Save File" })).toHaveCount(
        0,
    );
    await expect(page.getByRole("button", { name: "Options" })).toHaveCount(0);

    await openMenu(page, "Help");
    await expect(page.getByRole("radio", { name: "Hider" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Rules" })).toHaveAttribute(
        "href",
        "/rules/",
    );
    // No snapshot sharing: questions live in the shared game only.
    await expect(
        page.getByRole("button", { name: /Share a copy/ }),
    ).toHaveCount(0);

    // No hider switch: the role is chosen when starting or joining a game.
    await expect(page.getByRole("switch", { name: /Hider mode/ })).toHaveCount(
        0,
    );
    await expect(
        page.getByRole("button", { name: "I'm the hider" }),
    ).toHaveCount(0);
    await expect(page.getByText("Playing alone")).toHaveCount(0);
    await openMenu(page, "Settings");
    const autoZoom = page.getByRole("switch", { name: /Auto zoom/ });
    const before = await autoZoom.getAttribute("aria-checked");
    await autoZoom.click();
    await expect(autoZoom).not.toHaveAttribute("aria-checked", before!);
    // Escape closes it, back to where it was opened from.
    await page.keyboard.press("Escape");
    await expect(menuScreen(page)).toHaveCount(0);

    // On a phone the Menu is the sheet, opened from the tab bar; Map hides it.
    if (testInfo.project.name !== "desktop") {
        await page.getByRole("radio", { name: /^Questions/ }).click();
        await expect(page.getByTestId("sidebar-sheet")).toBeVisible();
        await page.getByRole("button", { name: "Menu" }).click();
        await expect(menuScreen(page)).toBeInViewport();
        await page.getByRole("button", { name: "Map" }).click();
        await expect(menuScreen(page)).not.toBeInViewport();
    }
});
