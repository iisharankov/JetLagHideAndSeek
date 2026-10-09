import type { Page } from "@playwright/test";

/** The test API server started by playwright.config.ts. */
export const API_PORT = 8788;

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
