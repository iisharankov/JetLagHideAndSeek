import { expect, test } from "./fixtures";

const playArea = {
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

const point = { lat: 47.3779, lng: 8.5403 };

const questions = [
    { id: "radius", key: 1, data: { ...point, radius: 5 } },
    {
        id: "thermometer",
        key: 2,
        data: { latA: 47.37, lngA: 8.54, latB: 47.4, lngB: 8.6 },
    },
    {
        id: "tentacles",
        key: 3,
        data: { ...point, radius: 1, unit: "miles", locationType: "museum" },
    },
    { id: "measuring", key: 4, data: { ...point, type: "airport" } },
    { id: "matching", key: 5, data: { ...point, type: "airport" } },
];

test("every question type can be hidden and shown again", async ({
    page,
    externalHosts,
}, testInfo) => {
    void externalHosts;

    await page.route("**/overpass/api/interpreter", (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ elements: [] }),
        }),
    );

    await page.goto("/");
    await page.evaluate(
        ({ playArea, questions }) => {
            localStorage.setItem("showTutorials", "false");
            localStorage.setItem("polyGeoJSON", JSON.stringify(playArea));
            localStorage.setItem("questions", JSON.stringify(questions));
        },
        { playArea, questions },
    );
    await page.reload();
    // On a phone the questions are in a sheet: open it.
    if (testInfo.project.name !== "desktop") {
        await page.getByTestId("sidebar-trigger").click();
    }

    const hidden = () =>
        page.evaluate(() =>
            JSON.parse(localStorage.getItem("questions")!).map(
                (q: { data: { hidden: boolean } }) => q.data.hidden,
            ),
        );

    const hideButtons = page.getByRole("button", { name: "Hide question" });
    await expect(hideButtons).toHaveCount(questions.length, {
        timeout: 20_000,
    });

    for (let i = 0; i < questions.length; i++) {
        const button = page
            .getByRole("button", { name: "Hide question" })
            .first();
        await expect(button).toBeEnabled({ timeout: 20_000 });
        await button.click();
    }
    await expect.poll(hidden).toEqual(questions.map(() => true));

    for (let i = 0; i < questions.length; i++) {
        const button = page
            .getByRole("button", { name: "Show question" })
            .first();
        await expect(button).toBeEnabled({ timeout: 20_000 });
        await button.click();
    }
    await expect.poll(hidden).toEqual(questions.map(() => false));
});
