import { test as base } from "@playwright/test";

type Fixtures = {
    /** Hosts other than the app's own origin that the page tried to reach. */
    externalHosts: Set<string>;
    /** Uncaught page errors, which should always stay empty. */
    pageErrors: string[];
};

/**
 * Every e2e test runs offline from the outside world: requests to other
 * origins are recorded and aborted, so tests are deterministic and any new
 * third-party dependency shows up as a failure in the privacy test.
 */
export const test = base.extend<Fixtures>({
    externalHosts: async ({ page, baseURL }, use) => {
        const origin = new URL(baseURL!).origin;
        const hosts = new Set<string>();

        await page.route("**/*", (route) => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) {
                hosts.add(url.host);
                return route.abort();
            }
            return route.fallback();
        });

        await use(hosts);
    },
    pageErrors: async ({ page }, use) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await use(errors);
    },
});

export { expect } from "@playwright/test";
