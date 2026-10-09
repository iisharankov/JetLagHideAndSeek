import esriConfig from "@arcgis/core/config.js";

// Load ArcGIS's geometry engine from our own origin (copied there by
// scripts/copy-arcgis-assets.mjs) instead of js.arcgis.com. Node tests set
// their own path in tests/setup/arcgis-node.ts.
if (typeof window !== "undefined") {
    esriConfig.assetsPath = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}arcgis`;
}
