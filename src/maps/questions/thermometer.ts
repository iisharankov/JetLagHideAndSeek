import * as turf from "@turf/turf";

import { hiderAnswerPosition } from "@/lib/hiderSpot";
import { safeUnion } from "@/maps/geo-utils";
import { geoSpatialVoronoi } from "@/maps/geo-utils/voronoi";
import type { ThermometerQuestion } from "@/maps/schema";

/** Both pins placed: a thermometer in a shared game has its end only once asked. */
const hasEnd = (
    question: ThermometerQuestion,
): question is ThermometerQuestion & { latB: number; lngB: number } =>
    question.latB !== null && question.lngB !== null;

export const adjustPerThermometer = (
    question: ThermometerQuestion,
    mapData: any,
) => {
    if (mapData === null) return;
    // Started, not asked: nothing is known yet.
    if (!hasEnd(question)) return mapData;

    const pointA = turf.point([question.lngA, question.latA]);
    const pointB = turf.point([question.lngB, question.latB]);

    const voronoi = geoSpatialVoronoi(turf.featureCollection([pointA, pointB]));

    if (question.warmer) {
        return turf.intersect(
            turf.featureCollection([safeUnion(mapData), voronoi.features[1]]),
        );
    } else {
        return turf.intersect(
            turf.featureCollection([safeUnion(mapData), voronoi.features[0]]),
        );
    }
};

export const hiderifyThermometer = (question: ThermometerQuestion) => {
    const $hiderMode = hiderAnswerPosition();
    if ($hiderMode === false || !hasEnd(question)) {
        return question;
    }

    const pointA = turf.point([question.lngA, question.latA]);
    const pointB = turf.point([question.lngB, question.latB]);

    const voronoi = geoSpatialVoronoi(turf.featureCollection([pointA, pointB]));

    const hiderPoint = turf.point([$hiderMode.longitude, $hiderMode.latitude]);
    const hiderRegion = turf.booleanPointInPolygon(
        hiderPoint,
        voronoi.features[1],
    )
        ? 1
        : 0;

    if (hiderRegion === 1) {
        question.warmer = true;
    } else {
        question.warmer = false;
    }

    return question;
};

/** The way the seekers travelled: a line from the start to the end, with an arrowhead. */
const travelArrow = (question: ThermometerQuestion) => {
    if (!hasEnd(question)) return [];
    const start = turf.point([question.lngA, question.latA]);
    const end = turf.point([question.lngB, question.latB]);
    const length = turf.distance(start, end, { units: "kilometers" });
    if (!(length > 0)) return [];
    const bearing = turf.bearing(start, end);
    const head = Math.max(0.05, length * 0.08);
    const left = turf.destination(end, head, bearing + 150, {
        units: "kilometers",
    });
    const right = turf.destination(end, head, bearing - 150, {
        units: "kilometers",
    });
    return [
        turf.lineString([start.geometry.coordinates, end.geometry.coordinates]),
        turf.lineString([
            left.geometry.coordinates,
            end.geometry.coordinates,
            right.geometry.coordinates,
        ]),
    ];
};

/**
 * What a thermometer looks like on the map: the two halves' border and the
 * way travelled; before it's asked, the circle of its distance around the
 * start (leave it, then ask).
 */
export const thermometerPlanningPolygon = (question: ThermometerQuestion) => {
    if (!hasEnd(question)) {
        return turf.featureCollection([
            turf.polygonToLine(
                turf.circle(
                    [question.lngA, question.latA],
                    question.distanceKm,
                    {
                        units: "kilometers",
                        steps: 96,
                    },
                ),
            ) as GeoJSON.Feature<GeoJSON.LineString>,
        ]);
    }
    const pointA = turf.point([question.lngA, question.latA]);
    const pointB = turf.point([question.lngB, question.latB]);

    const voronoi = geoSpatialVoronoi(turf.featureCollection([pointA, pointB]));

    return turf.featureCollection([
        ...voronoi.features
            .map((x: any) => turf.polygonToLine(x))
            .flatMap((line) =>
                line.type === "FeatureCollection" ? line.features : [line],
            ),
        ...travelArrow(question),
    ]);
};
