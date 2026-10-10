import { expect, test } from "./fixtures";

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

    // No hider switch: the role is chosen when starting or joining a game.
    await expect(page.getByRole("switch", { name: /Hider mode/ })).toHaveCount(
        0,
    );
    await expect(
        page.getByRole("button", { name: "I'm the hider" }),
    ).toHaveCount(0);
    await expect(page.getByText("Playing alone")).toHaveCount(0);
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
