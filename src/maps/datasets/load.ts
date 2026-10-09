import { DATA_URL } from "@/lib/config";

import { createDatasets } from "./index";

/** The reference datasets served next to the app (in dev: public/data/). */
export const datasets = createDatasets(async (name) => {
    try {
        const response = await fetch(`${DATA_URL}/${name}.json`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        // Not installed (or not JSON, e.g. a dev server's fallback page).
        return null;
    }
});
