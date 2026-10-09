// @ts-check
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
    integrations: [
        react(),
        tailwind({
            applyBaseStyles: false,
        }),
        AstroPWA({
            registerType: "autoUpdate",
            injectRegister: false, // registered in src/pwa.ts
            // The site sits behind Authelia, so the manifest request must
            // carry the login cookie.
            useCredentials: true,
            manifest: {
                name: "Jet Lag Hide and Seek",
                short_name: "Hide & Seek",
                description:
                    "Map tool for Jet Lag: The Game, Hide and Seek. Add the seekers' questions and see where the hider can still be.",
                icons: [
                    {
                        src: "android-chrome-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "android-chrome-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
                theme_color: "#1F2F3F",
                background_color: "#1F2F3F",
                display: "standalone",
            },
            workbox: {
                // Pages are deliberately not precached: navigations go to the
                // network first so an expired login reaches the Authelia
                // portal instead of a stale cached page.
                globPatterns: ["**/*.{js,css,woff2,png,svg,ico,wasm}"],
                // Fonts: only the Latin subsets; browsers fetch others on demand.
                globIgnores: ["JLIcon.png", "**/*devanagari*"],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                navigateFallback: null,
                runtimeCaching: [
                    {
                        urlPattern: ({ request }) =>
                            request.mode === "navigate",
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "pages",
                            networkTimeoutSeconds: 5,
                        },
                    },
                ],
            },
        }),
    ],
    devToolbar: {
        enabled: false,
    },
    // `pnpm dev`: shared games and share links go to a local API server
    // (`pnpm build:server && pnpm start:server` in another terminal).
    vite: {
        server: {
            proxy: { "/api": "http://127.0.0.1:8787" },
        },
    },
    // Override at build time, e.g. `BASE_PATH=/jetlag/ pnpm build`.
    site: process.env.SITE_URL ?? "https://jetlag.sharankov.com",
    base: process.env.BASE_PATH ?? "/",
});
