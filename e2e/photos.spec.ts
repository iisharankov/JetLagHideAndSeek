import type { APIRequestContext, Browser, Page } from "@playwright/test";

import { API_PORT, createGameOnApi, routeApi } from "./api";
import { openPhoto, openQuestions } from "./ask";
import { expect, test } from "./fixtures";

// Photo questions in the shell: a row under the questions opens the photo
// question with its rule and its time; the hider sends it from the camera
// (or the gallery when the game allows), can't answer it, or randomizes
// it; the seekers see each, and the history says what was randomized.

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
const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);

/** A game with Ben hiding at Zürich HB and Ana seeking, made through the API. */
const newGame = async (
    request: APIRequestContext,
    project: string,
    gallery: boolean,
) => {
    const created = await createGameOnApi(request, {
        playArea: { kind: "polygon", polygon: PLAY_AREA },
        zone: null,
        settings: { size: "medium", galleryPhotos: gallery },
        questions: [],
        by: "Org",
    });
    const id = ((await created.json()) as { state: { id: string } }).state.id;
    const keys = {
        hider: `photos-hider-${project}-${gallery}-00001`,
        seeker: `photos-seeker-${project}-${gallery}-0001`,
    };
    const as = (key: string) => ({ "X-Player-Key": key });
    await request.post(`${API}/games/${id}/join`, {
        headers: as(keys.hider),
        data: { name: "Ben", hider: true },
    });
    await request.post(`${API}/games/${id}/join`, {
        headers: as(keys.seeker),
        data: { name: "Ana" },
    });
    const op = (key: string, body: unknown) =>
        request.post(`${API}/games/${id}/ops`, {
            headers: as(key),
            data: { op: body },
        });
    await op(keys.hider, {
        type: "hiderReady",
        station: { id: "node/1", name: "Zürich HB", lat: 47.3779, lng: 8.5403 },
    });
    return { id, keys, op };
};

/** A phone of the project's size, as one player. */
const phoneAs = async (
    browser: Browser,
    viewport: { width: number; height: number },
    id: string,
    key: string,
    name: string,
): Promise<Page> => {
    const page = await (await browser.newContext({ viewport })).newPage();
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await routeApi(page);
    await page.addInitScript(
        ({ key, name, area }) => {
            localStorage.setItem("showTutorials", "false");
            localStorage.setItem("playerKey", key);
            localStorage.setItem("playerName", name);
            localStorage.setItem("polyGeoJSON", JSON.stringify(area));
        },
        { key, name, area: PLAY_AREA },
    );
    await page.goto(`/?game=${id}`);
    await expect(page.getByTestId("join-dialog")).toHaveCount(0);
    return page;
};

test("a photo question shows its rule and time; the hider sends it, can't answer one, randomizes one; the seekers see each", async ({
    browser,
    request,
}, testInfo) => {
    test.setTimeout(120_000);
    const viewport = testInfo.project.use.viewport!;
    const { id, keys, op } = await newGame(
        request,
        testInfo.project.name,
        false,
    );
    for (const name of ["Tree", "Widest Street", "The Sky"]) {
        await op(keys.seeker, { type: "askPhoto", name });
    }
    const ana = await phoneAs(browser, viewport, id, keys.seeker, "Ana");
    const ben = await phoneAs(browser, viewport, id, keys.hider, "Ben");

    // Ana: the row opens the question, with what the photo must show and
    // the game's time to send it.
    const anaTree = await openPhoto(ana, "Tree");
    await expect(anaTree.getByTestId("photo-rule-text")).toContainText(
        "entire tree",
    );
    await expect(anaTree).toContainText("10 minutes (medium game)");
    await expect(anaTree.getByTestId("photo-timer")).toContainText("to answer");
    await expect(anaTree).toContainText("Waiting for the photo");

    // Ben: the camera only (this game doesn't allow the gallery); he sends it.
    const benTree = await openPhoto(ben, "Tree");
    await expect(benTree.getByTestId("photo-camera")).toHaveCount(1);
    await expect(benTree.getByTestId("photo-gallery")).toHaveCount(0);
    await expect(benTree.getByTestId("photo-camera")).toHaveAttribute(
        "capture",
        "environment",
    );
    await benTree.getByTestId("photo-camera").setInputFiles({
        name: "tree.png",
        mimeType: "image/png",
        buffer: PNG,
    });
    await expect(anaTree.getByRole("img", { name: "Photo" })).toBeVisible();
    await ben.getByRole("button", { name: "Back" }).click();
    await ana.getByRole("button", { name: "Back" }).click();
    // Answered, the row says Show and opens the photo itself, full screen,
    // with a quarter turn for a landscape photo (round 43).
    const treeRow = ana
        .getByTestId("photo-request")
        .filter({ hasText: "Photo · Tree" });
    await expect(treeRow).toContainText("Show");
    await treeRow.click();
    const viewer = ana.getByTestId("photo-viewer");
    await expect(viewer.getByRole("img", { name: "Photo" })).toBeVisible();
    await viewer.getByRole("button", { name: "Turn the photo" }).click();
    await expect(viewer.getByRole("img", { name: "Photo" })).toHaveAttribute(
        "data-turn",
        "90",
    );
    await viewer.getByRole("button", { name: "Close the photo" }).click();
    await expect(viewer).toHaveCount(0);
    await expect(ana.getByTestId("photo-screen")).toHaveCount(0);

    // Ben can't answer the sky (say): Ana's row and screen say so.
    const benSky = await openPhoto(ben, "The Sky");
    await benSky.getByRole("button", { name: "I cannot answer" }).click();
    await ben.getByRole("button", { name: "Send: I cannot answer" }).click();
    await expect(benSky.getByTestId("photo-null-answer")).toBeVisible();
    await expect(
        ana
            .getByTestId("photo-request")
            .filter({ hasText: "The Sky" })
            .getByText("Can't be answered"),
    ).toBeVisible();
    await ben.getByRole("button", { name: "Back" }).click();

    // Ben randomizes the widest street (a real deck: the card is his to
    // play), shown with its card first.
    const benStreet = await openPhoto(ben, "Widest Street");
    await benStreet.getByRole("button", { name: "Randomize" }).click();
    await ben.getByRole("button", { name: "Play Randomize" }).click();
    await expect(benStreet.getByTestId("photo-randomized")).toContainText(
        "was Widest Street",
    );
    // Ana hears it: the card, and what the question became.
    const popup = ana.getByRole("dialog", {
        name: "Ben played Randomize Question",
    });
    await expect(popup).toContainText("Photo: Widest Street became Photo:");
    await popup.getByRole("button", { name: "OK" }).click();
    // The row says Randomized, the screen what it was.
    const row = ana
        .getByTestId("photo-request")
        .filter({ hasText: "Randomized" });
    await expect(row).toHaveCount(1);
    await row.click();
    await expect(ana.getByTestId("photo-randomized")).toContainText(
        "was Widest Street",
    );
    // …and Cards → History names the change.
    await ana.getByRole("button", { name: "Back" }).click();
    await ana.getByRole("radio", { name: /^Cards/ }).click();
    // History is open by itself: the card played, and what it changed.
    await expect(ana.getByTestId("played-powerup")).toContainText(
        "Photo: Widest Street →",
    );
    // …and the rest of the round: who asked, what came back.
    const history = ana.getByTestId("history");
    await expect(history).toContainText("Ana asked for a photo: Tree");
    await expect(history).toContainText("The hider sent the photo: Tree");
    await expect(history).toContainText(
        "The hider can't answer the photo: The Sky",
    );
});

test("a game that allows the gallery gives the hider both, camera and gallery", async ({
    browser,
    request,
}, testInfo) => {
    const viewport = testInfo.project.use.viewport!;
    const { id, keys, op } = await newGame(
        request,
        testInfo.project.name,
        true,
    );
    await op(keys.seeker, { type: "askPhoto", name: "Tree" });
    const ben = await phoneAs(browser, viewport, id, keys.hider, "Ben");
    await openQuestions(ben);
    const screen = await openPhoto(ben, "Tree");
    await expect(screen.getByTestId("photo-camera")).toHaveAttribute(
        "capture",
        "environment",
    );
    const gallery = screen.getByTestId("photo-gallery");
    await expect(gallery).toHaveCount(1);
    expect(await gallery.getAttribute("capture")).toBeNull();
    await expect(
        screen.getByRole("button", { name: "From the gallery" }),
    ).toBeVisible();
});
