import { expect, test } from "./fixtures";

// Regression: with hiding zones on, the "No Overlap" style and no stations
// (yet), the sidebar crashed with "Must have at least 2 geometries", and the
// saved style made it crash again after every reload.
test("hiding zones survive having no stations in the no-overlap style", async ({
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
        page.getByText("The hiding zone sidebar ran into a problem."),
    ).toHaveCount(0);
});
