// ArcGIS's geometry engine (pe-wasm.js) is an Emscripten module. Under Node it
// expects CommonJS globals and reads `pe-wasm.wasm` from disk, so point it at
// the copy inside node_modules instead of Esri's CDN.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import esriConfig from "@arcgis/core/config.js";

const require = createRequire(import.meta.url);
const coreDir = dirname(require.resolve("@arcgis/core/package.json"));

Object.assign(globalThis, {
    require,
    __dirname: dirname(fileURLToPath(import.meta.url)),
});

esriConfig.assetsPath = join(coreDir, "assets");
