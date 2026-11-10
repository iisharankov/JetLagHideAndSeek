import type { Page } from "@playwright/test";

import { API_PORT, createGameOnApi, routeApi } from "./api";
import { openDistances, openQuestions, setDistance } from "./ask";
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
    // Nothing over the map but the map: asking is in the Questions tab.
    await expect(
        page.getByRole("button", { name: "Ask a question" }),
    ).not.toBeInViewport();
    // The items are evenly spaced, however many sections there are.
    const widths = await bar
        .locator(":scope > button, [role=radiogroup] > button")
        .evaluateAll((items) =>
            items.map((item) => Math.round(item.getBoundingClientRect().width)),
        );
    expect(widths.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);

    // Ask a question from the Questions tab: the types; the phone's Back
    // goes back to the list.
    await bar.getByRole("radio", { name: /^Questions/ }).click();
    await page.getByRole("button", { name: "Ask a question" }).click();
    await expect(page.getByTestId("question-types")).toBeInViewport();
    await page.goBack();
    await expect(page.getByTestId("question-types")).not.toBeInViewport();
    // Radar: a draft at once, open on its card (round 42); the distance
    // changes there, in its pop-up.
    await page.getByRole("button", { name: "Ask a question" }).click();
    await page.getByTestId("ask-radius").click();
    const back = page.getByRole("button", { name: "All questions" });
    await expect(back).toBeInViewport();
    await setDistance(page, "5 km");
    await expect(page.getByTestId("distance-picker")).toContainText("5 km");

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

test("the ask flow marks what was asked before (×2, ×3) and unfolds each photo's rule", async ({
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
    // Asked again and vetoed: still asked (the rulebook's Veto), so a
    // third 5 km radar costs ×3 (round 44). A 10 km one vetoed: ×2.
    for (const [key, radius] of [
        [0.6, 5],
        [0.7, 10],
    ]) {
        await op(SEEKER, {
            type: "putQuestion",
            question: {
                id: "radius",
                key,
                data: { lat: 47.38, lng: 8.54, radius, unit: "kilometers" },
            },
        });
        await op(SEEKER, { type: "sendQuestion", key });
        await op(HIDER, { type: "vetoQuestion", key });
    }

    // Ana's phone (her player's key): Ask → Radar shows ×3 on 5 km, ×2 on 10 km.
    await prepare(page, { playerKey: SEEKER, playerName: "Ana" });
    await page.goto(`/?game=${id}`);
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 1000) < 768) {
        await page.getByRole("radio", { name: /^Questions/ }).click();
    }
    await page.getByRole("button", { name: "Ask a question" }).click();
    await page.getByTestId("ask-radius").click();
    // A draft at once; its distance pop-up marks 5 km ×3, 10 km ×2, only those.
    await expect(page.getByTestId("draw-badge").first()).toHaveText("2/1");
    await openDistances(page);
    const options = page.getByTestId("distance-options");
    await expect(
        options
            .getByRole("button", { name: /^5 km/ })
            .getByTestId("repeat-badge"),
    ).toHaveText("×3");
    await expect(
        options
            .getByRole("button", { name: /^10 km/ })
            .getByTestId("repeat-badge"),
    ).toHaveText("×2");
    await expect(options.getByTestId("repeat-badge")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "All questions" }).click();
    await page.getByRole("button", { name: "Ask a question" }).click();
    const choices = page.getByTestId("question-subtype");

    // Photo: a row unfolds what the photo must show; the time is the game's.
    await page.getByTestId("ask-photo").click();
    await expect(choices).toContainText("The hider has 10 minutes");
    const rows = choices.getByTestId("photo-choices");
    await rows.getByRole("button").first().click();
    await expect(choices.getByTestId("photo-rule")).toBeVisible();
    await expect(
        choices.getByRole("button", { name: /^Ask for: / }),
    ).toBeEnabled();
});

test("the Questions tab has the clock on top and Ask at the bottom; an answered question leaves no pin on the map", async ({
    page,
    request,
    pageErrors,
}, testInfo) => {
    const phone = testInfo.project.name === "phone";
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
    const SEEKER = "layout-seeker-key-00001";
    const HIDER = "layout-hider-key-000001";
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
    // Two radars sent: the first answered, the second still waiting.
    for (const [key, lat] of [
        [0.5, 47.38],
        [0.8, 47.45],
    ]) {
        await op(SEEKER, {
            type: "putQuestion",
            question: {
                id: "radius",
                key,
                data: { lat, lng: 8.54, radius: 5, unit: "kilometers" },
            },
        });
        await op(SEEKER, { type: "sendQuestion", key });
    }
    await op(HIDER, {
        type: "answerQuestion",
        key: 0.5,
        answer: { within: true },
        basedOn: Date.now() + 60_000,
    });

    await prepare(page, { playerKey: SEEKER, playerName: "Ana" });
    await page.goto(`/?game=${id}`);
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    if (phone) await page.getByRole("radio", { name: /^Questions/ }).click();
    const list = page.getByTestId("question-list");
    await expect(list.getByRole("button")).toHaveCount(2);

    // The clock above the list, Ask a question under it (round 45); on a
    // phone Ask sits at the foot of the tab, over the tab bar.
    const clock = await page.getByTestId("round-clock").boundingBox();
    const rows = await list.boundingBox();
    const ask = await page
        .getByRole("button", { name: "Ask a question" })
        .boundingBox();
    expect(clock!.y + clock!.height).toBeLessThanOrEqual(rows!.y);
    expect(rows!.y + rows!.height).toBeLessThanOrEqual(ask!.y);
    if (phone) {
        const bar = await page.getByTestId("tab-bar").boundingBox();
        expect(bar!.y - (ask!.y + ask!.height)).toBeLessThan(40);
        await page
            .getByTestId("tab-bar")
            .getByRole("button", { name: "Map" })
            .click();
    }

    // The map: the waiting question's pin, none for the answered one.
    await expect(
        page.locator('img.leaflet-marker-icon[alt="Question"]'),
    ).toHaveCount(1);
    expect(pageErrors).toEqual([]);
});

test("the ? on Ask a question explains the screen in four notes; a toast closes by its full-height ×", async ({
    page,
    pageErrors,
}) => {
    await prepare(page);
    await page.goto("/");
    await openQuestions(page);
    await page.getByRole("button", { name: "Ask a question" }).click();
    await page.getByRole("button", { name: "How this screen works" }).click();
    const note = page.getByTestId("coach-mark");
    await expect(note).toContainText("Six kinds");
    for (const title of ["What it costs", "Asked before", "The rules"]) {
        await note.getByRole("button", { name: "Next" }).click();
        await expect(note).toContainText(title);
    }
    await note.getByRole("button", { name: "Finish" }).click();
    await expect(note).toHaveCount(0);
    // The types screen is still there: the tour opened nothing of its own.
    await expect(page.getByTestId("question-types")).toBeInViewport();

    // Radar: a draft at once; its card's "i" unfolds the rule.
    await page.getByTestId("ask-radius").click();
    await page.getByRole("button", { name: "About this question" }).click();
    await expect(page.getByTestId("rule-info")).toContainText("Are you within");

    // A notification (deleting the question made here says "undo"): the ×
    // is as tall as the toast, and closes it.
    await page.getByRole("button", { name: "Delete question" }).click();
    await page.getByRole("button", { name: "Delete Question" }).click();
    const toast = page.locator(".Toastify__toast").first();
    await expect(toast).toBeVisible();
    const close = toast.getByRole("button", { name: "Close" });
    const [toastBox, closeBox] = [
        (await toast.boundingBox())!,
        (await close.boundingBox())!,
    ];
    expect(closeBox.height).toBeGreaterThanOrEqual(toastBox.height - 1);
    expect(closeBox.width).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(page.locator(".Toastify__toast")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});
