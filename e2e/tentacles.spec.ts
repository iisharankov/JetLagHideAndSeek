import { expect, test } from "./fixtures";

const zoo = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [8.574, 47.385] },
    properties: { name: "Zoo Zürich" },
};

test("a saved tentacles answer survives reloading the page", async ({
    page,
    externalHosts,
}, testInfo) => {
    test.skip(
        testInfo.project.name !== "desktop",
        "sidebar is open on desktop",
    );
    void externalHosts;

    // Our own Overpass endpoint answers with the zoo.
    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                elements: [
                    {
                        type: "node",
                        id: 1,
                        lat: 47.385,
                        lon: 8.574,
                        tags: { name: "Zoo Zürich", tourism: "zoo" },
                    },
                ],
            }),
        }),
    );

    await page.goto("/");
    await page.evaluate((location) => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem(
            "polyGeoJSON",
            JSON.stringify({
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
            }),
        );
        localStorage.setItem(
            "questions",
            JSON.stringify([
                {
                    id: "tentacles",
                    key: 0.5,
                    data: {
                        lat: 47.3779,
                        lng: 8.5403,
                        radius: 25,
                        unit: "kilometers",
                        locationType: "zoo",
                        location,
                    },
                },
            ]),
        );
    }, zoo);

    await page.reload();
    await expect(page.getByText("Zoo Zürich").first()).toBeVisible({
        timeout: 20_000,
    });

    const saved = await page.evaluate(
        () => JSON.parse(localStorage.getItem("questions")!)[0].data.location,
    );
    expect(saved?.properties?.name).toBe("Zoo Zürich");
});
