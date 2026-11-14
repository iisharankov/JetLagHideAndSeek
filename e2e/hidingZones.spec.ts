import { API_PORT, createGameOnApi, routeApi } from "./api";
import { expect, test } from "./fixtures";

// The hiding zones and stations on the map (round 49): drawn on one canvas,
// not one element per station, so a big play area zooms and pans smoothly;
// a tap on a station still picks it.

const API = `http://127.0.0.1:${API_PORT}/api`;
const PLAY_AREA = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [8.3, 47.2],
                        [8.8, 47.2],
                        [8.8, 47.6],
                        [8.3, 47.6],
                        [8.3, 47.2],
                    ],
                ],
            },
        },
    ],
};

// Forty stations on a grid across the play area.
const STATIONS = {
    elements: Array.from({ length: 40 }, (_, i) => ({
        type: "node",
        id: i + 1,
        lat: 47.25 + Math.floor(i / 8) * 0.07,
        lon: 8.35 + (i % 8) * 0.055,
        tags: { name: `Station ${i + 1}`, railway: "station" },
    })),
};

test("forty stations on one canvas, and a tap on one picks it", async ({
    page,
    request,
    pageErrors,
}, testInfo) => {
    const created = await createGameOnApi(request, {
        playArea: { kind: "polygon", polygon: PLAY_AREA },
        zone: null,
        settings: {},
        questions: [],
        by: "Org",
    });
    const id = ((await created.json()) as { state: { id: string } }).state.id;
    const hider = `zones-hider-${testInfo.project.name}-0001`;
    await request.post(`${API}/games/${id}/join`, {
        headers: { "X-Player-Key": hider },
        data: { name: "Ben", hider: true },
    });
    // Two tiny radars, one due north of Station 20 and one due east: their
    // pins give its place on the screen (the stations are on a canvas).
    const seeker = `zones-seeker-${testInfo.project.name}-001`;
    await request.post(`${API}/games/${id}/join`, {
        headers: { "X-Player-Key": seeker },
        data: { name: "Ana" },
    });
    const station20 = STATIONS.elements[19];
    const rulers = [
        { key: 0.5, lat: station20.lat + 0.02, lng: station20.lon },
        { key: 0.6, lat: station20.lat, lng: station20.lon + 0.02 },
    ];
    for (const { key, lat, lng } of rulers) {
        for (const op of [
            {
                type: "putQuestion",
                question: {
                    id: "radius",
                    key,
                    data: { lat, lng, radius: 0.05, unit: "kilometers" },
                },
            },
            { type: "sendQuestion", key },
        ]) {
            await request.post(`${API}/games/${id}/ops`, {
                headers: { "X-Player-Key": seeker },
                data: { op },
            });
        }
    }
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({
            json: (route.request().postData() ?? "").includes("railway")
                ? STATIONS
                : { elements: [] },
        }),
    );
    await page.addInitScript((key) => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem("playerKey", key);
        localStorage.setItem("playerName", "Ben");
    }, hider);
    await page.goto(`/?game=${id}`);
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    // The hider picks a station: every station shows on the map.
    await page
        .getByTestId("hider-choose")
        .waitFor({ state: "attached", timeout: 30_000 });
    if (testInfo.project.name === "phone") {
        await page
            .getByTestId("tab-bar")
            .getByRole("button", { name: "Map" })
            .click();
    }
    const canvas = page.locator(".leaflet-overlay-pane canvas");
    await expect(canvas.first()).toBeAttached({ timeout: 20_000 });
    // No HTML marker per station.
    await expect(
        page.locator(".leaflet-marker-pane .station-marker"),
    ).toHaveCount(0);
    expect(await page.locator(".leaflet-marker-pane > *").count()).toBeLessThan(
        10,
    );

    // A tap on Station 20: x from the northern pin, y from the eastern one
    // (a pin's tip is its point).
    const pins = page.locator('img.leaflet-marker-icon[alt="Question"]');
    await expect(pins).toHaveCount(2);
    const tips = await pins.evaluateAll((images) =>
        images.map((image) => {
            const box = image.getBoundingClientRect();
            return { x: box.left + box.width / 2, y: box.bottom };
        }),
    );
    const north = tips.reduce((a, b) => (a.y < b.y ? a : b));
    const east = tips.reduce((a, b) => (a.x > b.x ? a : b));
    await page.mouse.click(north.x, east.y);
    if (testInfo.project.name === "phone") {
        await page.getByRole("radio", { name: /^Hider/ }).click();
    }
    await expect(page.getByTestId("hider-panel")).toContainText("Station 20");
    expect(pageErrors).toEqual([]);
});
