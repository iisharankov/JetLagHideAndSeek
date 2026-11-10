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
    const screen = page.getByTestId("question-subtype");
    if (["matching", "measuring", "tentacles"].includes(id)) {
        await screen.locator("button[aria-pressed]").first().click();
    }
    if (how === "ask") {
        await screen.locator('[data-tutorial-id="ask-send"]').click();
    } else {
        await screen
            .getByRole("button", {
                name:
                    how === "draft"
                        ? "Add as a draft (plan first)"
                        : "Add the question",
            })
            .click();
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
