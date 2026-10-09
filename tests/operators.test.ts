import * as turf from "@turf/turf";
import { expect, test } from "vitest";

import {
    geoSpatialVoronoi,
    holedMask,
    modifyMapData,
    safeUnion,
} from "@/maps/geo-utils/operators";

test("voronoi diagram", () => {
    const BASE_POINT_COUNT = 25;
    const TEST_POINT_COUNT = 500;

    const basePoints = turf.randomPoint(BASE_POINT_COUNT);
    const voronoi = geoSpatialVoronoi(basePoints);

    expect(voronoi).toBeDefined();
    expect(voronoi.features.length).toBe(BASE_POINT_COUNT);

    const testPoints = turf.randomPoint(TEST_POINT_COUNT);

    testPoints.features.forEach((point) => {
        const voronoiIndex = voronoi.features.findIndex((feature) =>
            turf.booleanPointInPolygon(point, feature),
        );
        const nearestBasePoint = turf.nearestPoint(point, basePoints);
        const basePointIndex = basePoints.features.findIndex(
            (feature) =>
                feature.geometry.coordinates[0] ===
                    nearestBasePoint.geometry.coordinates[0] &&
                feature.geometry.coordinates[1] ===
                    nearestBasePoint.geometry.coordinates[1],
        );

        if (voronoiIndex === -1) {
            return; // A glitch with turf where overlapping polygons can cause this
        }

        expect(voronoiIndex).toBe(basePointIndex);
    });
});

// Regression: "Must have at least 2 geometries" crashed the hiding zone
// sidebar (and kept crashing after a reload) when no stations were left.
test("combining no areas gives an empty area instead of crashing", () => {
    const empty = safeUnion(turf.featureCollection([]));
    expect(turf.area(empty)).toBe(0);

    const square = turf.bboxPolygon([8, 47, 8.1, 47.1]);
    // Nothing removed from the square, everything kept outside nothing.
    expect(
        turf.area(safeUnion(turf.featureCollection([square, empty]))),
    ).toBeCloseTo(turf.area(square), -3);
    expect(turf.area(holedMask(turf.featureCollection([]))!)).toBeGreaterThan(
        turf.area(square),
    );
    expect(
        modifyMapData(turf.featureCollection([square]), empty, false),
    ).not.toBeNull();
});
