import type { Page } from "@playwright/test";

import { API_PORT, createGameOnApi, routeApi } from "./api";
import { expect, test } from "./fixtures";

// The phone's shell: the tab bar, Map and back to where you were, Back on
// every pushed screen (and the phone's own Back), and the ask flow.

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

const prepare = async (page: Page, storage: Record<string, string> = {}) => {
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    await page.addInitScript(
        ({ storage, area }) => {
            localStorage.setItem("showTutorials", "false");
            localStorage.setItem("polyGeoJSON", JSON.stringify(area));
            for (const [key, value] of Object.entries(storage)) {
                localStorage.setItem(key, value);
            }
        },
        { storage, area: PLAY_AREA },
    );
};

test("the tab bar: Map hides the sheet, Questions comes back to the same question; Back pops one screen", async ({
    page,
    pageErrors,
}, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the tab bar is the phone's");
    await prepare(page);
    await page.goto("/");
    const bar = page.getByTestId("tab-bar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("radio", { name: /^Questions/ })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Menu" })).toBeVisible();

    // Ask a question from the map: the types, then the radar's choices.
    await page.getByRole("button", { name: "Ask a question" }).click();
    await expect(page.getByTestId("question-types")).toBeInViewport();
    await page.getByTestId("ask-radius").click();
    const choices = page.getByTestId("question-subtype");
    await expect(choices).toContainText("Radar");
    // The phone's Back: one screen back, to the types.
    await page.goBack();
    await expect(page.getByTestId("question-types")).toBeInViewport();
    await page.getByTestId("ask-radius").click();
    await choices.getByRole("button", { name: "5 km", exact: true }).click();
    await choices.getByRole("button", { name: "Add the question" }).click();
    // It's made, and open on its card with the chosen distance.
    const back = page.getByRole("button", { name: "All questions" });
    await expect(back).toBeInViewport();
    await expect(
        page.getByRole("button", { name: "5 km", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // Map: the sheet goes; Questions: the same open question again.
    await bar.getByRole("button", { name: "Map" }).click();
    await expect(back).not.toBeInViewport();
    await bar.getByRole("radio", { name: /^Questions/ }).click();
    await expect(back).toBeInViewport();
    // The phone's Back closes the card.
    await page.goBack();
    await expect(page.getByTestId("question-list")).toBeInViewport();
    expect(pageErrors).toEqual([]);
});

test("the ask flow marks what was asked before (×2) and unfolds each photo's rule", async ({
    page,
    request,
}) => {
    const created = await createGameOnApi(request, {
        playArea: { kind: "polygon", polygon: PLAY_AREA },
        zone: null,
        settings: { size: "medium" },
        questions: [],
        by: "Org",
    });
    const { state } = await created.json();
    const id = state.id as string;
    const as = (key: string) => ({ "X-Player-Key": key });
    const SEEKER = "shell-seeker-key-000001";
    const HIDER = "shell-hider-key-0000001";
    await request.post(`${API}/games/${id}/join`, {
        headers: as(HIDER),
        data: { name: "Ben", hider: true },
    });
    await request.post(`${API}/games/${id}/join`, {
        headers: as(SEEKER),
        data: { name: "Ana" },
    });
    const op = (key: string, body: unknown) =>
        request.post(`${API}/games/${id}/ops`, {
            headers: as(key),
            data: { op: body },
        });
    // A 5 km radar asked and answered this round.
    await op(SEEKER, {
        type: "putQuestion",
        question: {
            id: "radius",
            key: 0.5,
            data: { lat: 47.38, lng: 8.54, radius: 5, unit: "kilometers" },
        },
    });
    await op(SEEKER, { type: "sendQuestion", key: 0.5 });
    await op(HIDER, {
        type: "answerQuestion",
        key: 0.5,
        answer: { within: true },
        basedOn: Date.now() + 60_000,
    });

    // Ana's phone (her player's key): Ask → Radar shows ×2 on 5 km only.
    await prepare(page, { playerKey: SEEKER, playerName: "Ana" });
    await page.goto(`/?game=${id}`);
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 1000) < 768) {
        await page.getByRole("radio", { name: /^Questions/ }).click();
    }
    await page.getByRole("button", { name: "Ask a question" }).click();
    await page.getByTestId("ask-radius").click();
    const choices = page.getByTestId("question-subtype");
    await expect(
        choices
            .getByRole("button", { name: /^5 km/ })
            .getByTestId("twice-badge"),
    ).toBeVisible();
    await expect(choices.getByTestId("twice-badge")).toHaveCount(1);
    await expect(choices.getByTestId("draw-badge")).toHaveText("2/1");

    // Photo: a row unfolds what the photo must show; the time is the game's.
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByTestId("ask-photo").click();
    await expect(choices).toContainText("The hider has 10 minutes");
    const rows = choices.getByTestId("photo-choices");
    await rows.getByRole("button").first().click();
    await expect(choices.getByTestId("photo-rule")).toBeVisible();
    await expect(
        choices.getByRole("button", { name: /^Ask for: / }),
    ).toBeEnabled();
});
