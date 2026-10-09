import { defineConfig } from "@playwright/test";

const PORT = 4329;

export default defineConfig({
    testDir: "e2e",
    timeout: 90_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: `http://127.0.0.1:${PORT}/`,
        browserName: "firefox",
        serviceWorkers: "block",
        trace: "retain-on-failure",
    },
    projects: [
        { name: "desktop", use: { viewport: { width: 1366, height: 900 } } },
        { name: "phone", use: { viewport: { width: 390, height: 844 } } },
    ],
    webServer: {
        // Tests run against the production build (`pnpm build` first).
        command: `npx astro preview --port ${PORT} --host 127.0.0.1`,
        url: `http://127.0.0.1:${PORT}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
