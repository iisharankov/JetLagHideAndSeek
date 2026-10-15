// Where the app finds its own server. Everything defaults to the same origin
// the app is served from (see deploy/), and can be overridden at build time
// with PUBLIC_* environment variables (e.g. in .env.development).
const env = import.meta.env;
const base = (env.BASE_URL ?? "/").replace(/\/?$/, "/");

/** Joins a path onto the app's base path: "api" -> "/api". */
export const withBase = (path: string) => base + path.replace(/^\/+/, "");

/**
 * Overpass servers for OpenStreetMap queries, tried in order: the self-hosted
 * one unless PUBLIC_OVERPASS_URL lists others (comma-separated).
 */
export const OVERPASS_URLS: string[] = (
    env.PUBLIC_OVERPASS_URL || withBase("overpass/api/interpreter")
)
    .split(",")
    .map((url: string) => url.trim())
    .filter(Boolean);

/** Pre-built reference data (places, stations, borders) from deploy/. */
export const DATA_URL: string = env.PUBLIC_DATA_URL || withBase("data");

/** Self-hosted basemap: a Protomaps .pmtiles archive. */
export const TILES_URL: string =
    env.PUBLIC_TILES_URL || withBase("tiles/basemap.pmtiles");

/** The app's own API (share links). */
export const API_URL: string = env.PUBLIC_API_URL || withBase("api");

/**
 * A Photon place search (same API as photon.komoot.io), used only where
 * there's no reference data; none by default: the data answers searches.
 */
export const GEOCODER_URL: string = env.PUBLIC_GEOCODER_URL || "";
