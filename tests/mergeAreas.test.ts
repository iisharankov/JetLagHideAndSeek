import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { describe, expect, it } from "vitest";

import { mergeAreas } from "@/maps/mergeAreas";

/** A box from its south-west corner, `w` × `h` km at Zürich's latitude. */
const box = (lng: number, lat: number, wKm: number, hKm: number) => {
    const dLng = wKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    const dLat = hKm / 111.32;
    return turf.bboxPolygon([
        lng,
        lat,
        lng + dLng,
        lat + dLat,
    ]) as Feature<Polygon>;
};
const kmToLng = (km: number, lat = 47.4) =>
    km / (111.32 * Math.cos((lat * Math.PI) / 180));

describe("mergeAreas", () => {
    it("closes the slivers between neighbours simplified apart", () => {
        // Two 2 km municipalities whose shared border drifted 15 m apart.
        const west = box(8.5, 47.4, 2, 2);
        const east = box(8.5 + kmToLng(2.015), 47.4, 2, 2);
        const merged = mergeAreas([west, east]);
        // A point in the gap belongs to the play area…
        const gap = turf.point([8.5 + kmToLng(2.0075), 47.409]);
        expect(turf.booleanPointInPolygon(gap, merged)).toBe(true);
        // …and the result is one piece without holes.
        const parts = turf.flatten(merged).features;
        expect(parts).toHaveLength(1);
        expect(parts[0].geometry.coordinates).toHaveLength(1);
        // The outside stays where it was (well within 1 %).
        const area = turf.area(merged);
        const sum = turf.area(west) + turf.area(east);
        expect(Math.abs(area - sum) / sum).toBeLessThan(0.01);
    });

    it("keeps a real hole: a municipality left out in the middle", () => {
        // A ring of eight 1 km squares around a 1 km square not chosen.
        const ring = [];
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                if (x === 1 && y === 1) continue;
                ring.push(box(8.5 + kmToLng(x), 47.4 + y / 111.32, 1, 1));
            }
        }
        const merged = mergeAreas(ring);
        const middle = turf.point([8.5 + kmToLng(1.5), 47.4 + 1.5 / 111.32]);
        expect(turf.booleanPointInPolygon(middle, merged)).toBe(false);
        const edge = turf.point([8.5 + kmToLng(0.5), 47.4 + 0.5 / 111.32]);
        expect(turf.booleanPointInPolygon(edge, merged)).toBe(true);
    });

    it("leaves a single area as it is", () => {
        const one = box(8.5, 47.4, 2, 2);
        expect(mergeAreas([one])).toBe(one);
    });

    it("keeps areas far apart as separate pieces", () => {
        const merged = mergeAreas([
            box(8.5, 47.4, 1, 1),
            box(8.5 + kmToLng(5), 47.4, 1, 1),
        ]);
        expect(turf.flatten(merged).features).toHaveLength(2);
    });
});
