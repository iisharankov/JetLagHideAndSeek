import { deflateSync } from "node:zlib";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const sharedGame = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [8.45, 47.32],
                        [8.62, 47.32],
                        [8.62, 47.43],
                        [8.45, 47.43],
                        [8.45, 47.32],
                    ],
                ],
            },
        },
    ],
    questions: [
        { id: "radius", key: 0.1, data: { lat: 47.37, lng: 8.54 } },
        { id: "radius", key: 0.2, data: { lat: 47.38, lng: 8.53 } },
    ],
};

const link = () =>
    `/?hzc=${deflateSync(Buffer.from(JSON.stringify(sharedGame))).toString("base64url")}`;

/** Gives the player an existing game with one question. */
const withExistingGame = async (page: Page) => {
    await page.goto("/");
    await page.evaluate(() => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem(
            "questions",
            JSON.stringify([
                { id: "radius", key: 0.9, data: { lat: 46.95, lng: 7.44 } },
            ]),
        );
    });
};

const storedQuestionKeys = (page: Page) =>
    page.evaluate(() =>
        JSON.parse(localStorage.getItem("questions") ?? "[]").map(
            (q: { key: number }) => q.key,
        ),
    );

test("a shared link asks before replacing your game, and can be declined", async ({
    page,
    externalHosts,
}) => {
    void externalHosts;
    await withExistingGame(page);
    await page.goto(link());

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Load the shared game?");
    await expect(dialog).toContainText("2 questions in a drawn play area");
    await dialog.getByRole("button", { name: "Keep my game" }).click();

    await expect(dialog).toBeHidden();
    expect(await storedQuestionKeys(page)).toEqual([0.9]);
});

test("accepting a shared link loads it", async ({ page, externalHosts }) => {
    void externalHosts;
    await withExistingGame(page);
    await page.goto(link());

    await page.getByRole("button", { name: "Load shared game" }).click();

    await expect.poll(() => storedQuestionKeys(page)).toEqual([0.1, 0.2]);
});
