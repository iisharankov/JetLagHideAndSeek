import { expect, test } from "./fixtures";

test("one Menu holds game, hider and settings; hider mode shows the hider pin", async ({
    page,
    externalHosts,
}) => {
    void externalHosts;
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("showTutorials", "false"));
    await page.reload();

    // The old bottom buttons are gone.
    await expect(page.getByRole("button", { name: "Save File" })).toHaveCount(
        0,
    );
    await expect(page.getByRole("button", { name: "Options" })).toHaveCount(0);

    await page.getByRole("button", { name: "Menu" }).click();
    await expect(
        page.getByRole("button", { name: "Share link" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Rules" })).toHaveAttribute(
        "href",
        "/rules/",
    );

    await page.getByRole("radio", { name: "Hider" }).click();
    const hiderMode = page.getByRole("switch", {
        name: /I'm the hider/,
    });
    await expect(hiderMode).toHaveAttribute("aria-checked", "false");
    await hiderMode.click();
    await expect(hiderMode).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('img[title="Hider location"]')).toHaveCount(1);

    await page.getByRole("radio", { name: "Settings" }).click();
    const autoZoom = page.getByRole("switch", { name: /Auto zoom/ });
    const before = await autoZoom.getAttribute("aria-checked");
    await autoZoom.click();
    await expect(autoZoom).not.toHaveAttribute("aria-checked", before!);

    // With hider mode on, a badge outside the menu says so.
    await page.keyboard.press("Escape");
    await expect(
        page.getByRole("button", { name: "Hider mode" }),
    ).toBeVisible();
});
