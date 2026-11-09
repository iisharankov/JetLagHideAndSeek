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

/** Opens the questions: the phone's tab bar (the sheet), or nothing on a desktop. */
export const openQuestions = async (page: Page) => {
    if (onPhone(page)) {
        await page.getByRole("radio", { name: /^Questions/ }).click();
    }
};
