import type { Page } from "@playwright/test";

// The ask flow (Ask a question → a kind → its choices), and the phone's tab
// bar, for the specs.

const IDS: Record<string, string> = {
    Radius: "radius",
    Radar: "radius",
    Thermometer: "thermometer",
    Matching: "matching",
    Measuring: "measuring",
    Tentacles: "tentacles",
};

/** Whether the page is phone-sized (the tab bar, the bottom sheet). */
export const onPhone = (page: Page) =>
    (page.viewportSize()?.width ?? 1000) < 768;

/**
 * Makes a question through the ask flow: its kind, the first type where
 * it needs one, then "add" (playing alone, or research), "draft" (plan
 * first in a game) or "ask" (sent to the hider).
 */
export const askQuestion = async (
    page: Page,
    kind: string,
    how: "add" | "draft" | "ask" = "add",
) => {
    const id = IDS[kind] ?? kind;
    // On a phone, asking is in the Questions tab (nothing over the map).
    if (onPhone(page)) await openQuestions(page);
    await page.getByRole("button", { name: "Ask a question" }).click();
    await page.getByTestId(`ask-${id}`).click();
    // Radar and Thermometer: a draft at once, open on its card (round 42).
    if (id === "radius" || id === "thermometer") {
        if (how === "ask") {
            await page
                .getByRole("button", {
                    name: id === "radius" ? "Send" : /^Start the thermometer/,
                    exact: id === "radius",
                })
                .click();
        }
        return;
    }
    // The others: a tap on a type makes it (a draft in a game) and opens
    // its card (round 47); Send is on the card.
    const screen = page.getByTestId("question-subtype");
    await screen.locator("button[aria-pressed]").first().click();
    if (how === "ask") {
        await page.getByRole("button", { name: "Send", exact: true }).click();
    }
};

/** Opens the questions: the phone's tab bar (the sheet), the desktop's tab. */
export const openQuestions = async (page: Page) => {
    await page.getByRole("radio", { name: /^Questions/ }).click();
};

/** Asks for a photo: Ask a question → Photo → its row → "Ask for: …". */
export const askPhoto = async (page: Page, name: string) => {
    if (onPhone(page)) await openQuestions(page);
    await page.getByRole("button", { name: "Ask a question" }).click();
    await page.getByTestId("ask-photo").click();
    const screen = page.getByTestId("question-subtype");
    await screen
        .getByTestId("photo-choices")
        .getByRole("button", { name, exact: true })
        .click();
    await screen.getByRole("button", { name: `Ask for: ${name}` }).click();
};

/**
 * Closes the notifications showing. On a phone they cover the top of the
 * sheet, and a test's pointer over one pauses it (pause on hover) for good.
 */
export const dismissToasts = async (page: Page) => {
    const close = page.locator(".toast-close");
    for (let i = await close.count(); i > 0; i--) {
        await close
            .first()
            .click({ timeout: 2000 })
            .catch(() => undefined);
    }
};

/** Opens a photo question from the Questions list. */
export const openPhoto = async (page: Page, name: string) => {
    await dismissToasts(page);
    await openQuestions(page);
    // The rows are under the list, not under an open question's card.
    const list = page.getByRole("button", { name: "All questions" });
    if (await list.isVisible()) await list.click();
    await page
        .getByTestId("photo-request")
        .filter({ hasText: `Photo · ${name}` })
        .click();
    return page.getByTestId("photo-screen");
};

/**
 * The hider picks a station: Hider tab → "Choose from the list" → its name
 * (the button waits for the stations to load).
 */
export const chooseStation = async (page: Page, name: string) => {
    if (onPhone(page))
        await page.getByRole("radio", { name: /^Hider/ }).click();
    await page.getByTestId("hider-choose").click({ timeout: 30_000 });
    await page
        .getByTestId("station-choices")
        .getByRole("button", { name, exact: true })
        .click();
    // A phone shows the map (the zone in red): back to the Hider tab.
    if (onPhone(page)) {
        await dismissToasts(page);
        await page.getByRole("radio", { name: /^Hider/ }).click();
    }
};

/** A card's distance: its button, then the distance in the pop-up. */
export const setDistance = async (page: Page, label: string) => {
    await openDistances(page);
    await page
        .getByTestId("distance-options")
        .getByRole("button", { name: new RegExp(`^${label}`) })
        .click();
};

/**
 * Opens a card's distance pop-up. A new draft re-renders once the game
 * echoes it, which can close a pop-up opened just before: it's opened again.
 */
export const openDistances = async (page: Page) => {
    const options = page.getByTestId("distance-options");
    for (let tries = 0; tries < 3; tries++) {
        await page.getByTestId("distance-picker").click();
        try {
            await options.waitFor({ state: "visible", timeout: 2000 });
            return;
        } catch {
            // Closed again by the re-render: try once more.
        }
    }
    await options.waitFor({ state: "visible" });
};
