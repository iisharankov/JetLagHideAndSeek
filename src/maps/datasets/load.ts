import { DATA_URL } from "@/lib/config";
import { memoizeAsync } from "@/lib/memoizeAsync";

import { areaDataUrl, type AreasFile, createAreaDatasets } from "./areas";
import { createDatasets } from "./index";

/** A pack's files, served next to the app (in dev: public/data/). */
const filesAt = (base: string) => async (name: string) => {
    try {
        const response = await fetch(`${base}/${name}.json`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        // Not installed (or not JSON, e.g. a dev server's fallback page).
        return null;
    }
};

/** The far areas installed on this server (areas.json; none: just the main pack). */
export const dataAreas = memoizeAsync(
    async () =>
        (((await filesAt(DATA_URL)("areas")) as AreasFile | null)?.areas ??
            []) as AreasFile["areas"],
    () => "areas",
);

const main = createDatasets(filesAt(DATA_URL));

/** Every pack, the main one first; made once. */
const packs = memoizeAsync(
    async () => [
        { id: "main", datasets: main },
        ...(await dataAreas()).map((area) => ({
            id: area.id,
            datasets: createDatasets(filesAt(areaDataUrl(DATA_URL, area.id))),
        })),
    ],
    () => "packs",
);

/** The reference datasets: each question answered by the pack covering it. */
export const datasets = createAreaDatasets(packs);

/** Where a pack's files are, by the box it must cover (elevation tiles). */
export const dataUrlAt = async (lng: number, lat: number) => {
    for (const area of await dataAreas()) {
        const [w, s, e, n] = area.bbox;
        if (lng >= w && lng <= e && lat >= s && lat <= n) {
            return areaDataUrl(DATA_URL, area.id);
        }
    }
    return DATA_URL;
};
