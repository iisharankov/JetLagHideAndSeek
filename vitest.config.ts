import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        alias: {
            "@/": new URL("./src/", import.meta.url).pathname,
        },
        include: ["tests/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
        setupFiles: ["tests/setup/arcgis-node.ts"],
    },
});
