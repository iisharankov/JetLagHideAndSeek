import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The hider's hand with the digital deck, playing alone: picking cards to
// discard (over the hand limit, or a card's cost) happens on the cards, and
// the bar pinned to the bottom says what for and does it.

/** The hider's phone, playing alone with a digital deck holding `hand`. */
const openHand = async (
    page: Page,
    hand: string[],
    project: string,
): Promise<void> => {
    await page.route("**/data/**", (route) => route.fulfill({ status: 404 }));
    await page.addInitScript((hand) => {
        const hb = { id: "hb", name: "Zürich HB", lat: 47.3779, lng: 8.5403 };
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem(
            "gameSettings",
            JSON.stringify({ deck: "virtual" }),
        );
        localStorage.setItem(
            "isHiderMode",
            JSON.stringify({ latitude: hb.lat, longitude: hb.lng }),
        );
        localStorage.setItem("hiderStation", JSON.stringify(hb));
        localStorage.setItem(
            "localDeck",
            JSON.stringify({
                remaining: [],
                discard: [],
                hand,
                pending: [],
                pendingKeep: 0,
                owed: [],
                limit: 6,
                log: [],
            }),
        );
    }, hand);
    await page.goto("/");
    if (project === "phone") {
        await page.getByRole("radio", { name: /^Questions/ }).click();
    }
    await page.getByRole("radio", { name: /^Cards/ }).click();
};

test("over the hand limit: pick cards anywhere in the hand, discard them from the bar", async ({
    page,
    pageErrors,
}, testInfo) => {
    await openHand(
        page,
        [
            "time_bonus_5",
            "time_bonus_10",
            "powerup_veto_question",
            "curse_jammed_door",
            "time_bonus_15",
            "time_bonus_20",
            "time_bonus_30",
            "powerup_randomize_question",
        ],
        testInfo.project.name,
    );
    const bar = page.getByTestId("hand-bar");
    await expect(bar).toContainText(
        "8 in your hand, the limit is 6. Select 2 to discard",
    );
    const discard = bar.getByRole("button", { name: /^Discard \d selected/ });
    await expect(discard).toBeDisabled();

    const tiles = page.getByTestId("hand-card");
    // The last two, at the bottom of the hand.
    await tiles.nth(7).getByRole("button", { name: "Select" }).click();
    await tiles.nth(6).getByRole("button", { name: "Select" }).click();
    // Two is all it takes.
    await expect(
        tiles.nth(0).getByRole("button", { name: "Select" }),
    ).toBeDisabled();
    // The bar is in reach without scrolling back.
    await expect(bar).toBeInViewport();
    await bar.getByRole("button", { name: "Discard 2 selected" }).click();

    const hand = page.getByTestId("hand");
    await expect(hand).toContainText("Your hand (6/6)");
    await expect(hand).not.toContainText("Randomize Question");
    await expect(bar).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});

test("a curse's cost: pick the cards it takes, cast it from the bar", async ({
    page,
    pageErrors,
}, testInfo) => {
    await openHand(
        page,
        [
            "curse_jammed_door",
            "time_bonus_5",
            "time_bonus_10",
            "powerup_veto_question",
            "time_bonus_15",
        ],
        testInfo.project.name,
    );
    const bar = page.getByTestId("hand-bar");
    await expect(bar).toHaveCount(0);
    const tiles = page.getByTestId("hand-card");
    await tiles.nth(0).getByRole("button", { name: "Cast" }).click();

    await expect(bar).toContainText("costs 2 cards: select them in your hand");
    await expect(tiles.nth(0)).toContainText("Casting");
    // Nothing else is played meanwhile.
    await expect(
        page.getByRole("button", { name: /^(Cast|Play)$/ }),
    ).toHaveCount(0);
    await tiles.nth(1).getByRole("button", { name: "Select" }).click();
    await expect(
        bar.getByRole("button", { name: "Cast it (1/2)" }),
    ).toBeDisabled();
    await tiles.nth(4).getByRole("button", { name: "Select" }).click();
    await expect(bar).toBeInViewport();
    await bar.getByRole("button", { name: "Cast it (2/2)" }).click();

    await expect(page.getByTestId("hand")).toContainText("Your hand (2/6)");
    await expect(bar).toHaveCount(0);
    expect(pageErrors).toEqual([]);
});
