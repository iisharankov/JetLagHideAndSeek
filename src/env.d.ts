/// <reference types="astro/client" />

interface ImportMetaEnv {
    /** Overpass endpoints (comma-separated); default: self-hosted /overpass/api/interpreter. */
    readonly PUBLIC_OVERPASS_URL?: string;
    /** Reference data directory; defaults to the self-hosted /data. */
    readonly PUBLIC_DATA_URL?: string;
    /** Basemap .pmtiles URL; defaults to the self-hosted /tiles/basemap.pmtiles. */
    readonly PUBLIC_TILES_URL?: string;
    /** A Photon place search, used only without reference data (development); none by default. */
    readonly PUBLIC_GEOCODER_URL?: string;
    /** API base URL; defaults to the self-hosted /api. */
    readonly PUBLIC_API_URL?: string;
    /** Initial base map for new visitors (see baseTileLayer in lib/context). */
    readonly PUBLIC_DEFAULT_TILE_LAYER?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
