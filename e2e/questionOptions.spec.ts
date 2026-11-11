import type { APIRequestContext, Page } from "@playwright/test";

import { API_PORT, createGameOnApi, routeApi } from "./api";
import { askQuestion } from "./ask";
import { expect, test } from "./fixtures";

// The Questions tab's ⚙ (round 48): what the map shows of the questions,
// next to them: every pin or only the active question's, every draft shaded
// or only the active one's (the others outlined), and the card's layout.
// The map follows each at once (the drafts' setting didn't, before).

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

/** A game with Ana (a seeker) and Ben (the hider); Ana's phone opens it. */
const seekerInGame = async (
    page: Page,
    request: APIRequestContext,
    name: string,
) => {
    const created = await createGameOnApi(request, {
        playArea: { kind: "polygon", polygon: PLAY_AREA },
        zone: null,
        settings: { size: "medium" },
        questions: [],
        by: "Org",
    });
    const id = ((await created.json()) as { state: { id: string } }).state.id;
    const as = (key: string) => ({ "X-Player-Key": key });
    const seeker = `${name}-seeker-key-00001`;
    await request.post(`${API}/games/${id}/join`, {
        headers: as(`${name}-hider-key-000001`),
        data: { name: "Ben", hider: true },
    });
    await request.post(`${API}/games/${id}/join`, {
        headers: as(seeker),
        data: { name: "Ana" },
    });
    const op = (body: unknown) =>
        request.post(`${API}/games/${id}/ops`, {
            headers: as(seeker),
            data: { op: body },
        });
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    await page.addInitScript(
        ({ seeker, area }) => {
            localStorage.setItem("showTutorials", "false");
            localStorage.setItem("polyGeoJSON", JSON.stringify(area));
            localStorage.setItem("playerKey", seeker);
            localStorage.setItem("playerName", "Ana");
        },
        { seeker, area: PLAY_AREA },
    );
    return { id, op };
};

/** The ⚙ at the top of Questions, one of its choices. */
const option = async (page: Page, group: string, choice: string) => {
    await page.getByRole("button", { name: "Question options" }).click();
    const options = page.getByTestId("question-options");
    await options
        .getByRole("radiogroup", { name: group })
        .getByRole("radio", { name: choice, exact: true })
        .click();
    await page.keyboard.press("Escape");
    await expect(options).toHaveCount(0);
};

test("the Questions tab's ⚙: pins and drafts, all or the active question's, and the map follows at once", async ({
    page,
    request,
    pageErrors,
}, testInfo) => {
    const { id, op } = await seekerInGame(
        page,
        request,
        `options-${testInfo.project.name}`,
    );
    // Two radar drafts, overlapping: each shades what it would rule out.
    for (const [key, lat] of [
        [0.5, 47.38],
        [0.6, 47.42],
    ]) {
        await op({
            type: "putQuestion",
            question: {
                id: "radius",
                key,
                data: { lat, lng: 8.55, radius: 10, unit: "kilometers" },
            },
        });
    }
    await page.goto(`/?game=${id}`);
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    if (testInfo.project.name === "phone") {
        await page.getByRole("radio", { name: /^Questions/ }).click();
    }
    const pins = page.locator('img.leaflet-marker-icon[alt="Question"]');
    const shaded = page.locator('path[stroke-dasharray="6 4"]');
    const outlined = page.locator('path[stroke-dasharray="4 4"]');
    await expect(pins).toHaveCount(2);
    await expect(shaded.first()).toBeAttached({ timeout: 20_000 });
    await expect(outlined).toHaveCount(0);

    // The ⚙ holds all three, the layout too.
    await page.getByRole("button", { name: "Question options" }).click();
    for (const group of ["Pins", "Drafts", "Card"]) {
        await expect(
            page
                .getByTestId("question-options")
                .getByRole("radiogroup", { name: group }),
        ).toBeVisible();
    }
    await page.keyboard.press("Escape");

    // Drafts: only the active one's. None is active yet: both outlined,
    // nothing shaded, without anything else changing.
    await option(page, "Drafts", "Active");
    await expect(outlined).toHaveCount(2, { timeout: 20_000 });
    await expect(shaded).toHaveCount(0);
    // Opening the first makes it active: shaded; the other outlined.
    await page.getByTestId("question-list").getByRole("button").first().click();
    await expect(outlined).toHaveCount(1, { timeout: 20_000 });
    await expect(shaded.first()).toBeAttached();
    await page.getByRole("button", { name: "All questions" }).click();

    // Pins: only the active question's.
    await option(page, "Pins", "Active");
    await expect(pins).toHaveCount(1);
    await option(page, "Pins", "All");
    await expect(pins).toHaveCount(2);
    expect(pageErrors).toEqual([]);
});

test("a thermometer's two pins are purple, the start darker, with a faint dashed line between them", async ({
    page,
    request,
    pageErrors,
}, testInfo) => {
    const { id } = await seekerInGame(
        page,
        request,
        `thermo-pins-${testInfo.project.name}`,
    );
    await page.goto(`/?game=${id}`);
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    await askQuestion(page, "Thermometer");
    const pins = page.locator('img.leaflet-marker-icon[alt="Question"]');
    await expect(pins).toHaveCount(2);
    const sources = await pins.evaluateAll((images) =>
        images.map((image) =>
            decodeURIComponent(image.getAttribute("src") ?? ""),
        ),
    );
    // The end: the thermometers' purple; the start: a darker one.
    expect(sources.some((src) => src.includes('fill="#9C2BCB"'))).toBe(true);
    expect(sources.some((src) => src.includes('fill="#5B1478"'))).toBe(true);
    await expect(page.locator("path.thermometer-link")).toHaveCount(1);
    expect(pageErrors).toEqual([]);
});
