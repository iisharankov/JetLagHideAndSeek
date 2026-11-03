// Several admin areas joined into one play area. The reference data
// simplifies each boundary on its own (server/datasets/build.ts), so the
// border two neighbours share no longer lines up: a plain union leaves
// slivers up to ~20 m wide between them, and a station or place in one
// counts as outside the play area. Growing every area a little before the
// union and shrinking the result back by as much closes those gaps (a
// morphological closing) and leaves anything wider, such as a municipality
// left out in the middle, as it was.
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

/** Gaps up to twice this wide are closed. */
const GAP_KM = 0.03;

export const mergeAreas = (
    areas: Feature<Polygon | MultiPolygon>[],
): Feature<Polygon | MultiPolygon> => {
    if (areas.length === 0) return turf.multiPolygon([]);
    if (areas.length === 1) return areas[0];
    const grown = areas
        .map((area) =>
            turf.buffer(area, GAP_KM, { units: "kilometers", steps: 4 }),
        )
        .filter((area): area is Feature<Polygon | MultiPolygon> => !!area);
    const joined = turf.union(turf.featureCollection(grown));
    if (!joined) return areas[0];
    return (
        (turf.buffer(joined, -GAP_KM, {
            units: "kilometers",
            steps: 4,
        }) as Feature<Polygon | MultiPolygon> | undefined) ?? joined
    );
};
