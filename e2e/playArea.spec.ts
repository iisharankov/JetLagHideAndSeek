import { expect, test } from "./fixtures";

// Place search (Photon) as the server would answer it.
const place = (name: string, osm_id: number, lng: number, lat: number) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
        osm_type: "R",
        osm_id,
        osm_key: "place",
        osm_value: "village",
        type: "city",
        name,
        country: "Switzerland",
        countrycode: "CH",
        extent: [lng - 0.02, lat + 0.02, lng + 0.02, lat - 0.02],
    },
});
const PLACES = [
    place("Kilchberg", 1683904, 8.545, 47.32),
    place("Adliswil", 1683900, 8.525, 47.31),
];

test("places added to the play area show up where the game is set up", async ({
    page,
    externalHosts,
    pageErrors,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "menus open on desktop");
    void externalHosts;
    await page.route("**/photon/api/**", (route) => {
        const q = new URL(route.request().url()).searchParams.get("q") ?? "";
        return route.fulfill({
            json: {
                features: PLACES.filter((p) =>
                    p.properties.name.toLowerCase().startsWith(q.toLowerCase()),
                ),
            },
        });
    });
    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({ json: { elements: [] } }),
    );
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("showTutorials", "false"));
    await page.reload();

    // Menu → Game → Change game settings → Change (the play area).
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("radio", { name: "Game" }).click();
    await page.getByRole("button", { name: "Change game settings" }).click();
    await page.getByTestId("change-play-area").click();
    const bar = page.getByTestId("play-area-bar");
    await expect(bar).toBeVisible();

    // Two places added through the search.
    for (const name of ["Kilchberg", "Adliswil"]) {
        await bar.getByRole("combobox").click();
        const search = page.getByPlaceholder("Search place...");
        await search.fill(name.slice(0, 4));
        await search.press("Space");
        await search.press("Backspace");
        await page
            .getByRole("option", { name: `${name}, Switzerland` })
            .click();
        await expect(bar.getByRole("combobox")).toContainText(name);
        await page.keyboard.press("Escape");
    }
    await bar.getByRole("button", { name: "Done" }).click();

    // Back in game setup, both are listed, not cut off.
    const summary = page.getByTestId("play-area-summary");
    await expect(summary).toContainText("+ Kilchberg");
    await expect(summary).toContainText("+ Adliswil");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    // And Menu → Game says so too.
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("radio", { name: "Game" }).click();
    await expect(page.getByTestId("play-area-name")).toContainText(
        "Switzerland + Kilchberg + Adliswil",
    );
    expect(pageErrors).toEqual([]);
});
