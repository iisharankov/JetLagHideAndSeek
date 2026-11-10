import type { Page } from "@playwright/test";

import { API_PORT, createGameOnApi, routeApi } from "./api";
import { askQuestion, onPhone, setDistance } from "./ask";
import { expect, test } from "./fixtures";
import { closeMenu, openMenu } from "./menu";

// The question card's three layouts (round 46, the owner's pick of the
// round 45 pictures): Sections (A), Sentence (B), Summary (C), switched in
// Menu → Settings. Every one: the map over the card on a phone, What if as
// a chip that flips, Location's pop-up, Hide · Send · Delete at the foot.

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

/** The card's layout, from Menu → Settings. */
const chooseLayout = async (page: Page, name: string) => {
    await openMenu(page, "Settings");
    await page.getByRole("radio", { name, exact: true }).click();
    await closeMenu(page);
    if (onPhone(page)) {
        await page.getByRole("radio", { name: /^Questions/ }).click();
    }
};

/** Left to right: the x of each element's middle. */
const xs = async (page: Page, labels: string[]) => {
    const out: number[] = [];
    for (const label of labels) {
        const box = await page
            .getByRole("button", { name: label, exact: true })
            .boundingBox();
        out.push(box!.x + box!.width / 2);
    }
    return out;
};

test("the card's three layouts, switched in Settings; What if flips; Location's choices", async ({
    page,
    pageErrors,
}, testInfo) => {
    await prepare(page);
    await page.goto("/");
    await askQuestion(page, "Radius");
    await setDistance(page, "5 km");
    const body = page.getByTestId("card-body");

    // A · Sections (the first time): Distance and Location side by side on
    // a phone; one under the other in the desktop's narrow sidebar.
    await expect(body).toHaveAttribute("data-layout", "sections");
    const distance = await page.getByTestId("distance-picker").boundingBox();
    const where = await page.getByTestId("location-button").boundingBox();
    if (testInfo.project.name === "phone") {
        expect(Math.abs(distance!.y - where!.y)).toBeLessThan(4);
        expect(distance!.x).toBeLessThan(where!.x);
    } else {
        expect(where!.y).toBeGreaterThan(distance!.y + distance!.height);
    }
    // No position on this machine: the question is at its pin.
    await expect(page.getByTestId("location-button")).toContainText("Pin");

    // What if (alone: the answer) is one chip; a tap flips it.
    const whatIf = page.getByTestId("what-if");
    await expect(whatIf).toContainText("Inside");
    await whatIf.click();
    await expect(whatIf).toContainText("Outside");

    // Location: GPS, the pin, typed, copy.
    await page.getByTestId("location-button").click();
    const choices = page.getByTestId("location-choices");
    for (const name of [
        /^Me · GPS/,
        /^The pin/,
        "Type or paste coordinates",
        "Copy the coordinates",
    ]) {
        await expect(choices.getByRole("button", { name })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(choices).toHaveCount(0);

    // Playing alone the foot is Hide · Lock · Delete.
    const [hide, lock, remove] = await xs(page, [
        "Hide question",
        "Lock question",
        "Delete question",
    ]);
    expect(hide).toBeLessThan(lock);
    expect(lock).toBeLessThan(remove);

    // On a phone the map shows between the card's header and its controls,
    // and takes touches there.
    if (testInfo.project.name === "phone") {
        const window = await page.getByTestId("card-map-window").boundingBox();
        expect(window!.height).toBeGreaterThan(250);
        const onMap = await page.evaluate(
            ([x, y]) =>
                !!document
                    .elementFromPoint(x, y)
                    ?.closest(".leaflet-container"),
            [window!.x + window!.width / 2, window!.y + window!.height / 2],
        );
        expect(onMap).toBe(true);
    }

    // B · Sentence: the question on one line, its words to tap.
    await chooseLayout(page, "Sentence");
    await expect(body).toHaveAttribute("data-layout", "sentence");
    const sentence = page.getByTestId("card-sentence");
    await expect(sentence).toHaveText(/^Are you within 5 km.* of the pin.*\?$/);
    // One line on a phone (two would be over 80 px); the desktop's narrow
    // sidebar wraps it.
    if (testInfo.project.name === "phone") {
        expect((await sentence.boundingBox())!.height).toBeLessThan(60);
    }
    await expect(page.getByTestId("distance-picker")).toBeVisible();

    // C · Summary: one line; Edit shows the choices, Done folds them.
    await chooseLayout(page, "Summary");
    await expect(body).toHaveAttribute("data-layout", "summary");
    await expect(page.getByTestId("card-summary")).toContainText(
        "Within 5 km of the pin?",
    );
    await expect(page.getByTestId("distance-picker")).toHaveCount(0);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByTestId("distance-picker")).toBeVisible();
    await expect(page.getByTestId("location-button")).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByTestId("distance-picker")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});

test("in a game: no Draft strip, ×2 beside the cost, Send between Hide and Delete, then the time left in its place", async ({
    page,
    request,
    pageErrors,
}, testInfo) => {
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
    const SEEKER = `cards-seeker-${testInfo.project.name}-0001`;
    const HIDER = `cards-hider-${testInfo.project.name}-00001`;
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
    // A 5 km radar asked and answered: a second one costs double.
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

    await prepare(page, { playerKey: SEEKER, playerName: "Ana" });
    await page.goto(`/?game=${id}`);
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    await askQuestion(page, "Radius");
    await setDistance(page, "5 km");

    // The header: 2/1 and ×2 side by side, who made it under the title.
    const cost = await page.getByTestId("draw-badge").boundingBox();
    const twice = page.getByTestId("card-header").getByTestId("repeat-badge");
    await expect(twice).toHaveText("×2");
    const box = await twice.boundingBox();
    expect(Math.abs(cost!.y - box!.y)).toBeLessThan(6);
    expect(box!.x).toBeGreaterThan(cost!.x);
    await expect(page.getByTestId("card-header")).toContainText("By Ana");
    await expect(page.getByText("Draft: only seekers see this")).toHaveCount(0);
    // In a game the chip is the guess.
    await expect(page.getByTestId("what-if")).toContainText("What if");

    // Hide · Send · Delete.
    const [hide, send, remove] = await xs(page, [
        "Hide question",
        "Send",
        "Delete question",
    ]);
    expect(hide).toBeLessThan(send);
    expect(send).toBeLessThan(remove);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByTestId("question-game-state")).toHaveAttribute(
        "data-state",
        "asked",
    );
    // Where Send was: the hider's time to answer.
    await expect(
        page.getByTestId("card-actions").getByTestId("answer-timer"),
    ).toContainText("to answer");
    await expect(
        page.getByRole("button", { name: "Send", exact: true }),
    ).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});
