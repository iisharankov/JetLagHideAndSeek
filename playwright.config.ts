import { defineConfig } from "@playwright/test";

const PORT = 4329;
const API_PORT = 8788; // also in e2e/api.ts

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
    webServer: [
        {
            // Tests run against the production build (`pnpm build` first).
            command: `npx astro preview --port ${PORT} --host 127.0.0.1`,
            url: `http://127.0.0.1:${PORT}/`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
        {
            // The API for shared games (`pnpm build:server` first), with a
            // throwaway data folder. Tests route /api/ to it (e2e/api.ts).
            command: `PORT=${API_PORT} DATA_DIR=$(mktemp -d) node server/dist/index.mjs`,
            url: `http://127.0.0.1:${API_PORT}/api/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
    ],
});
