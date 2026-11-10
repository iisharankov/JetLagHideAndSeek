import { openQuestions } from "./ask";
import { expect, test } from "./fixtures";

test("ⓘ shows a question's rules and links into the in-app rulebook", async ({
    page,
    externalHosts,
}) => {
    void externalHosts;

    await page.goto("/");
    await page.evaluate(() => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem(
            "questions",
            JSON.stringify([
                {
                    id: "measuring",
                    key: 1,
                    data: { lat: 47.38, lng: 8.54, type: "lake" },
                },
            ]),
        );
    });
    await page.reload();

    await openQuestions(page);
    await page
        .getByTestId("question-list")
        .getByRole("button", { name: /^Question 1 · Measuring/ })
        .click();
    // The "i" unfolds the rule in place (not a popover), and folds it again.
    const info = page.getByRole("button", { name: "About this question" });
    await info.click();
    await expect(info).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("rule-info")).toBeInViewport();
    await expect(page.getByText("Measuring: Lake shore")).toBeVisible();
    // The rulebook's text for the question, not a link elsewhere.
    await expect(
        page.getByText("Any named body of water on your maps app"),
    ).toBeVisible();
    await expect(
        page.getByRole("link", { name: "Full rules" }),
    ).toHaveAttribute(
        "href",
        "/rules/seeking/measuring-questions/#body-of-water",
    );
    await expect(
        page.getByRole("link", { name: "All questions" }),
    ).toHaveAttribute("href", "/reference/");
    await info.click();
    await expect(page.getByTestId("rule-info")).toHaveCount(0);
});

test("the reference page lists the questions and the hider deck", async ({
    page,
    externalHosts,
}) => {
    await page.goto("/reference/");
    await expect(
        page.getByRole("heading", { name: "Question & card reference" }),
    ).toBeVisible();
    for (const name of [
        "Matching",
        "Measuring",
        "Thermometer",
        "Radar",
        "Tentacles",
        "Photos",
        "Curses",
        "Powerups",
        "Time bonuses",
    ]) {
        await expect(
            page.getByRole("heading", { name, exact: true }),
        ).toBeVisible();
    }
    await expect(
        page.getByRole("heading", { name: "Curse of the Cairn" }),
    ).toBeVisible();
    await expect(page.getByText("Casting cost:").first()).toBeVisible();
    // Everything is served by the app itself.
    expect([...externalHosts]).toEqual([]);
    expect(await page.locator('a[href*="lifack"]').count()).toBe(0);
});

test("the rulebook pages work and link to each other", async ({
    page,
    externalHosts,
}) => {
    await page.goto("/rules/");
    await expect(
        page.getByRole("heading", { name: "Hide and Seek rules", level: 1 }),
    ).toBeVisible();
    await page
        .getByRole("link", { name: "Measuring Questions" })
        .first()
        .click();
    await expect(
        page.getByRole("heading", { name: "Measuring Questions", level: 1 }),
    ).toBeVisible();
    await expect(page.locator("#body-of-water")).toBeVisible();
    await expect(
        page.getByRole("img", {
            name: "Compared to me, are you closer to or further from an airport?",
        }),
    ).toBeVisible();
    expect([...externalHosts]).toEqual([]);
});

test("metric only: the rules in km, no miles to choose, an old question in miles loads in km", async ({
    page,
    externalHosts,
}) => {
    void externalHosts;
    // The rulebook's tentacle questions, by their distance in km.
    await page.goto("/rules/seeking/tentacle-questions/");
    await expect(
        page.getByRole("heading", { name: "Museums within 2 km" }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Zoos within 25 km" }),
    ).toBeVisible();
    await expect(page.getByText(/\bmiles?\b/i)).toHaveCount(0);

    // A radar saved before, in miles: it loads as the same distance in km.
    await page.goto("/");
    await page.evaluate(() => {
        localStorage.setItem("showTutorials", "false");
        localStorage.setItem(
            "questions",
            JSON.stringify([
                {
                    id: "radius",
                    key: 1,
                    data: { lat: 47.38, lng: 8.54, radius: 5, unit: "miles" },
                },
            ]),
        );
    });
    await page.reload();
    await openQuestions(page);
    await page
        .getByTestId("question-list")
        .getByRole("button", { name: /^Question 1 · Radar/ })
        .click();
    await expect(page.getByTestId("distance-picker")).toContainText("8.047 km");
    await expect(page.getByText(/\bmiles?\b/i)).toHaveCount(0);
    // The map's scale bar: metres and kilometres only.
    await expect(page.locator(".leaflet-control-scale-imperial")).toHaveCount(
        0,
    );
});
