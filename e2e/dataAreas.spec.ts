import { expect, test } from "./fixtures";

// Far areas (round 49): the server's main pack (Switzerland) at /data/, a
// Toronto pack at /data/areas/toronto/ listed in /data/areas.json, and its
// basemap at /tiles/toronto.pmtiles. Picking Toronto finds it in its own
// pack, the map draws Toronto's tiles there, and the game's rules follow
// the country (Canada).

const square = (box: [number, number, number, number]) => ({
    type: "Polygon",
    coordinates: [
        [
            [box[0], box[1]],
            [box[2], box[1]],
            [box[2], box[3]],
            [box[0], box[3]],
            [box[0], box[1]],
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
    geometry: square(box),
});
const collection = (features: unknown[]) => ({
    type: "FeatureCollection",
    features,
});

const MAIN: Record<string, unknown> = {
    manifest: { version: 1, built: "", bbox: [5.5, 45.6, 11, 48.1], files: {} },
    areas: {
        areas: [
            {
                id: "toronto",
                name: "Toronto",
                bbox: [-79.7, 43.55, -79.05, 43.9],
            },
        ],
    },
    "admin-2": collection([
        zone(51701, 2, "Schweiz", [5.9, 45.8, 10.5, 47.8], {
            "ISO3166-1:alpha2": "CH",
        }),
    ]),
};
const TORONTO: Record<string, unknown> = {
    manifest: {
        version: 1,
        built: "",
        bbox: [-79.7, 43.55, -79.05, 43.9],
        files: {},
    },
    "admin-2": collection([
        zone(1428125, 2, "Canada", [-79.7, 43.55, -79.05, 43.9], {
            "ISO3166-1:alpha2": "CA",
        }),
    ]),
    "admin-4": collection([
        zone(68841, 4, "Ontario", [-79.7, 43.55, -79.05, 43.9]),
    ]),
    "admin-6": collection([
        zone(324211, 6, "Toronto", [-79.64, 43.58, -79.12, 43.86]),
    ]),
};

test("a far area's pack: Toronto is found, drawn from its own tiles, and gets Canada's rules", async ({
    page,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts;
    await page.route("**/data/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        const name = path
            .split("/")
            .pop()!
            .replace(/\.json$/, "");
        const body = path.includes("/data/areas/toronto/")
            ? TORONTO[name]
            : path.includes("/data/areas/")
              ? undefined
              : MAIN[name];
        return body
            ? route.fulfill({ json: body })
            : route.fulfill({ status: 404 });
    });
    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({ json: { elements: [] } }),
    );
    const tiles: string[] = [];
    page.on("request", (request) => {
        const url = request.url();
        if (url.includes("/tiles/")) tiles.push(new URL(url).pathname);
    });
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("showTutorials", "false"));
    await page.reload();

    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("radio", { name: "Game" }).click();
    await page.getByRole("button", { name: "Change game settings" }).click();
    await page.getByTestId("change-play-area").click();
    const bar = page.getByTestId("play-area-bar");
    await bar.getByText("Search or draw instead").click();
    await bar.getByRole("combobox").click();
    const search = page.getByPlaceholder("Search place...");
    await search.fill("Toront");
    await search.press("Space");
    await search.press("Backspace");
    // Found in Toronto's pack, named from it.
    await page
        .getByRole("option", { name: /^Toronto, Ontario, Canada/ })
        .click();
    await page.keyboard.press("Escape");
    await bar.getByRole("button", { name: "Done" }).click();

    // The map is in Toronto: its tiles come from Toronto's file.
    await expect
        .poll(() => tiles.filter((path) => path.endsWith("/toronto.pmtiles")))
        .not.toHaveLength(0);
    // Toronto alone: a place in another area starts a new play area.
    const summary = page.getByTestId("play-area-summary");
    await expect(summary).toContainText("Toronto");
    await expect(summary).not.toContainText("Switzerland");
    // The rules follow the country (the same screen as the play area).
    await expect(
        page.getByRole("radio", { name: "Canada", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    expect(pageErrors).toEqual([]);
});
