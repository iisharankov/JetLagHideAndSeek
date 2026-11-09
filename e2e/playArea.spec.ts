import { onPhone } from "./ask";
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
}) => {
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
    await bar.getByText("Search or draw instead").click();
    for (const name of ["Kilchberg", "Adliswil"]) {
        await bar.getByRole("combobox").click();
        const search = page.getByPlaceholder("Search place...");
        await search.fill(name.slice(0, 4));
        await search.press("Space");
        await search.press("Backspace");
        await page
            .getByRole("option", { name: `${name}, Zürich, Switzerland` })
            .click();
        await expect(bar.getByTestId("play-area-list")).toContainText(name);
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

// Two neighbouring municipalities covering the west and east of the
// country square, big enough to tap at the country's zoom.
const PICK_DATA: Record<string, unknown> = {
    ...DATA,
    "admin-8": collection([
        zone(9001, 8, "Westdorf", [5.9, 45.8, 8.2, 47.8]),
        zone(9002, 8, "Ostdorf", [8.2, 45.8, 10.5, 47.8]),
    ]),
};

test("areas tapped on the map make the play area, and the map follows at once", async ({
    page,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts;
    await page.route("**/data/**", (route) => {
        const name = new URL(route.request().url()).pathname
            .split("/")
            .pop()!
            .replace(/\.json$/, "");
        const body = PICK_DATA[name];
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

    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("radio", { name: "Game" }).click();
    await page.getByRole("button", { name: "Change game settings" }).click();
    await page.getByTestId("change-play-area").click();
    const bar = page.getByTestId("play-area-bar");
    const list = bar.getByTestId("play-area-list");
    await expect(list).toContainText("Switzerland");
    // Municipalities are shown to tap.
    await expect(
        bar.getByRole("radio", { name: "Municipalities" }),
    ).toHaveAttribute("aria-checked", "true");
    const areas = page.locator(".leaflet-playAreaPick-pane path");
    await expect(areas).toHaveCount(2);
    const tapArea = async (index: number) => {
        const box = (await areas.nth(index).boundingBox())!;
        // Low in the shape: the bar covers the top of the map.
        await page.mouse.click(
            box.x + box.width / 2,
            box.y + box.height * 0.85,
        );
    };
    const shading = page.locator(".leaflet-overlay-pane path").first();
    const shape = () => shading.getAttribute("d");
    /** The shading once the map has stopped moving (its path is in pixels). */
    const settledShape = async () => {
        let last = await shape();
        for (;;) {
            await page.waitForTimeout(800);
            const now = await shape();
            if (now === last) return now;
            last = now;
        }
    };

    // Westdorf lies inside Switzerland: it replaces it, on the map too.
    await expect.poll(shape).not.toBeNull();
    const country = await shape();
    await tapArea(0);
    await expect(list).toContainText("Westdorf");
    await expect(list).not.toContainText("Switzerland");
    await expect.poll(shape, { timeout: 15_000 }).not.toBe(country);
    const westOnly = await settledShape();
    // Ostdorf joins it, and the map's play area follows without a reload.
    await tapArea(1);
    await expect(list).toContainText("Ostdorf");
    await expect.poll(shape, { timeout: 15_000 }).not.toBe(westOnly);

    // Tapped again, Westdorf goes; the list can't empty the play area.
    await tapArea(0);
    await expect(list).not.toContainText("Westdorf");
    // A phone folds the list away: open it.
    if (onPhone(page)) await bar.getByText(/^Chosen areas/).click();
    await list.getByRole("button", { name: "Remove Ostdorf" }).click();
    await expect(
        page.getByText("The play area needs at least one area."),
    ).toBeVisible();
    await expect(list).toContainText("Ostdorf");

    // Cut out and put back from the list.
    await tapArea(0);
    await list
        .locator("li", { hasText: "Westdorf" })
        .getByRole("button", { name: "Cut out" })
        .click();
    await expect(
        list.locator("li", { hasText: "Westdorf" }).getByRole("button", {
            name: "Put back",
        }),
    ).toBeVisible();

    await bar.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("play-area-summary")).toContainText(
        "Ostdorf",
    );
    expect(pageErrors).toEqual([]);
});
