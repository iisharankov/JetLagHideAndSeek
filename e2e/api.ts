import type { APIRequestContext, Page } from "@playwright/test";

/** The test API server started by playwright.config.ts. */
export const API_PORT = 8788;
const API = `http://127.0.0.1:${API_PORT}/api`;
/** The test API's admin code (playwright.config.ts): made-up, not a secret. */
export const ADMIN_CODE = "e2e-admin-code-not-a-secret";

/** Sends the page's /api/ requests (shared games) to the test API server. */
export const routeApi = (page: Page) =>
    page.route("**/api/**", (route) =>
        route.continue({
            url: route
                .request()
                .url()
                .replace(/^http:\/\/[^/]+/, `http://127.0.0.1:${API_PORT}`),
        }),
    );

/** A fresh creator code (five games a day), made with the admin code. */
export const newCreatorCode = async (
    request: APIRequestContext,
    name = "Tests",
) => {
    const response = await request.post(`${API}/admin/codes`, {
        headers: { "X-Admin-Code": ADMIN_CODE },
        data: { name },
    });
    if (!response.ok()) {
        throw new Error(`No creator code: ${await response.text()}`);
    }
    return ((await response.json()) as { code: string }).code;
};

/** Makes a game straight on the test API, with a fresh creator code. */
export const createGameOnApi = async (
    request: APIRequestContext,
    data: Record<string, unknown>,
) =>
    request.post(`${API}/games`, {
        headers: { "X-Creator-Code": await newCreatorCode(request) },
        data,
    });

/**
 * Lets the page start games: a creator code in its storage, as if typed in
 * Menu → Game. Call before the page loads the app (an init script).
 */
export const giveCreatorCode = async (page: Page) => {
    const code = await newCreatorCode(page.request);
    await page.addInitScript((code) => {
        if (!localStorage.getItem("gameCode")) {
            localStorage.setItem(
                "gameCode",
                JSON.stringify({ code, kind: "creator", name: "Tests" }),
            );
        }
    }, code);
};
