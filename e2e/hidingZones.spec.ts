import { expect, test } from "./fixtures";

// Regression: with hiding zones on and no stations (yet), the sidebar
// crashed with "Must have at least 2 geometries", and a saved style made it
// crash again after every reload. (The "no-overlap" style no longer exists;
// an old saved value must not break anything either.)
test("hiding zones survive having no stations, and an old saved style", async ({
    page,
    externalHosts,
}) => {
    void externalHosts;
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ elements: [] }),
        }),
    );

    await page.goto("/");
    await page.evaluate(() => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem("displayHidingZones", "true");
        localStorage.setItem("displayHidingZonesStyle", "no-overlap");
    });
    await page.reload();
    await page.waitForTimeout(3000);

    await expect(
        page.getByText("The stations panel ran into a problem."),
    ).toHaveCount(0);
});

test("the Stations tab holds the hiding zone controls", async ({
    page,
    externalHosts,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar open on desktop");
    void externalHosts;
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("showTutorials", "false"));
    await page.reload();

    await page.getByRole("radio", { name: "Stations" }).click();
    const zones = page.getByRole("switch", { name: /Show hiding zones/ });
    await expect(zones).toBeVisible();
    // No second sidebar on the right any more.
    await expect(page.getByText("Hiding Zone", { exact: true })).toHaveCount(0);
});
