// Bundles the API server. The rules the server shares with the phones
// (src/lib/game, src/lib/rules) read rulebook pages the way the site does,
// with Vite's `?raw` imports, so those are loaded here as text.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const raw = {
    name: "raw-text",
    setup(build) {
        build.onResolve({ filter: /\?raw$/ }, (args) => {
            const path = args.path.replace(/\?raw$/, "");
            return {
                path: path.startsWith("@/")
                    ? resolve(root, "src", path.slice(2))
                    : resolve(args.resolveDir, path),
                namespace: "raw-text",
            };
        });
        build.onLoad({ filter: /.*/, namespace: "raw-text" }, (args) => ({
            contents: readFileSync(args.path, "utf8"),
            loader: "text",
        }));
    },
};

await build({
    entryPoints: [resolve(root, "server/src/index.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    banner: {
        js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
    outfile: resolve(root, "server/dist/index.mjs"),
    plugins: [raw],
    logLevel: "info",
});
