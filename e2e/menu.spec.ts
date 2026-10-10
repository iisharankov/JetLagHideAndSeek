import { expect, test } from "./fixtures";

test("one Menu holds game and settings; hider mode is a switch in Game", async ({
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

    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("radio", { name: "Hider" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Rules" })).toHaveAttribute(
        "href",
        "/rules/",
    );
    // No snapshot sharing: questions live in the shared game only.
    await expect(
        page.getByRole("button", { name: /Share a copy/ }),
    ).toHaveCount(0);

    const hiderMode = page.getByRole("switch", { name: /^Hider mode/ });
    await expect(hiderMode).toHaveAttribute("aria-checked", "false");
    await hiderMode.click();
    // Switching it on closes the menu and shows the Hider tab.
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
    await expect(page.locator('img[title="Hider location"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Hider mode" })).toHaveCount(
        0,
    );
    // The Hider tab shows (on a phone, in the sheet that slid up).
    await expect(page.getByRole("radio", { name: "Hider" })).toHaveAttribute(
        "aria-checked",
        "true",
    );
    await expect(page.getByTestId("hider-panel")).toContainText(
        "Pick your station",
    );

    // On a phone the sheet covers half the screen: close it first.
    if (testInfo.project.name !== "desktop") {
        await page.getByRole("button", { name: "Close sidebar" }).click();
    }
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(hiderMode).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Settings" }).click();
    const autoZoom = page.getByRole("switch", { name: /Auto zoom/ });
    const before = await autoZoom.getAttribute("aria-checked");
    await autoZoom.click();
    await expect(autoZoom).not.toHaveAttribute("aria-checked", before!);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();

    // On a phone the Menu opens over the sheet too.
    if (testInfo.project.name !== "desktop") {
        await page.getByTestId("sidebar-trigger").click();
        await expect(page.getByTestId("sidebar-sheet")).toBeVisible();
        await page.getByRole("button", { name: "Menu" }).click();
        await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    }
});
