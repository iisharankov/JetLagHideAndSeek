import { readFileSync } from "node:fs";

import { expect, test } from "./fixtures";

// The exact policy the production nginx sends (deploy/nginx/...conf).
const policy = readFileSync(
    new URL("../deploy/nginx/jetlag.sharankov.com.conf", import.meta.url),
    "utf8",
).match(/Content-Security-Policy "([^"]+)"/)![1];

test("the app works under the production Content-Security-Policy", async ({
    page,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts;
    const violations: string[] = [];
    page.on("console", (message) => {
        if (/Content[- ]Security[- ]Policy/i.test(message.text())) {
            violations.push(message.text());
        }
    });

    // Serve the page with the same CSP header nginx adds.
    await page.route("**/", async (route) => {
        const response = await route.fetch();
        await route.fulfill({
            response,
            headers: {
                ...response.headers(),
                "content-security-policy": policy,
            },
        });
    });

    await page.goto("/");
    await expect(page.getByText(/^\d+ of \d+$/)).toBeVisible();
    // Let islands hydrate, the map draw and the service worker register.
    await page.waitForTimeout(3000);

    expect(violations).toEqual([]);
    expect(pageErrors).toEqual([]);
});
