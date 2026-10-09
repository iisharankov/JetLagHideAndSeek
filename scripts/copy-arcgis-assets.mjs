// Copies the one ArcGIS runtime asset the app needs (the projection engine
// used by geodesic distance/buffer) into public/, so browsers load it from our
// own server instead of js.arcgis.com. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const coreDir = dirname(require.resolve("@arcgis/core/package.json"));
const asset = "esri/geometry/support/pe-wasm.wasm";
const target = join("public", "arcgis", asset);

mkdirSync(dirname(target), { recursive: true });
copyFileSync(join(coreDir, "assets", asset), target);
