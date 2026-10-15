import { expect, test } from "./fixtures";

// Reference data as the server would serve it: the country, a canton and
// two municipalities, as squares. The picker searches these.
const square = (
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
) => ({
    type: "Polygon",
    coordinates: [
        [
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
            [minLng, minLat],
        ],
    ],
});
const zone = (
    id: number,
    level: number,
    name: string,
    box: [number, number, number, number],
    extra: Record<string, string> = {},
) => ({
    type: "Feature",
    id,
    bbox: box,
    properties: { id, admin_level: level, name, ...extra },
    geometry: square(...box),
});
const collection = (features: unknown[]) => ({
    type: "FeatureCollection",
    features,
});
const DATA: Record<string, unknown> = {
    manifest: { version: 1, built: "", bbox: [5.5, 45.6, 11, 48.1], files: {} },
    "admin-2": collection([
        zone(51701, 2, "Schweiz", [5.9, 45.8, 10.5, 47.8], {
            "name:en": "Switzerland",
            "ISO3166-1:alpha2": "CH",
        }),
    ]),
    "admin-4": collection([
        zone(1682248, 4, "Zürich", [8.3, 47.2, 9.0, 47.7], {
            "ISO3166-2": "CH-ZH",
        }),
    ]),
    "admin-8": collection([
        zone(1683904, 8, "Kilchberg", [8.53, 47.31, 8.56, 47.33]),
        zone(1683900, 8, "Adliswil", [8.51, 47.3, 8.54, 47.32]),
    ]),
};

test("places added to the play area show up where the game is set up", async ({
    page,
    externalHosts,
    pageErrors,
}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "menus open on desktop");
    void externalHosts;
    await page.route("**/data/**", (route) => {
        const name = new URL(route.request().url()).pathname
            .split("/")
            .pop()!
            .replace(/\.json$/, "");
        const body = DATA[name];
        return body
            ? route.fulfill({ json: body })
            : route.fulfill({ status: 404 });
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
            .getByRole("option", { name: `${name}, Zürich, Switzerland` })
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
