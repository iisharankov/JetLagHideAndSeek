import * as turf from "@turf/turf";
import type { Feature, FeatureCollection } from "geojson";

import { errorMessage, NotApplicableError } from "./errors";
import {
    adjustPerMatching,
    hiderifyMatching,
    matchingPlanningPolygon,
} from "./questions/matching";
import {
    adjustPerMeasuring,
    hiderifyMeasuring,
    measuringPlanningPolygon,
} from "./questions/measuring";
import {
    adjustPerRadius,
    hiderifyRadius,
    radiusPlanningPolygon,
} from "./questions/radius";
import {
    adjustPerTentacle,
    hiderifyTentacles,
    tentaclesPlanningPolygon,
} from "./questions/tentacles";
import {
    adjustPerThermometer,
    hiderifyThermometer,
    thermometerPlanningPolygon,
} from "./questions/thermometer";
import type { Question, Questions } from "./schema";

export * from "./geo-utils";

export const hiderifyQuestion = async (question: Question) => {
    if (question.data.drag) {
        switch (question.id) {
            case "radius":
                question.data = await hiderifyRadius(question.data);
                break;
            case "thermometer":
                question.data = await hiderifyThermometer(question.data);
                break;
            case "tentacles":
                question.data = await hiderifyTentacles(question.data);
                break;
            case "matching":
                question.data = await hiderifyMatching(question.data);
                break;
            case "measuring":
                question.data = await hiderifyMeasuring(question.data);
                break;
        }
    }

    return question;
};

export const determinePlanningPolygon = async (
    question: Question,
    planningModeEnabled: boolean,
) => {
    if (planningModeEnabled && question.data.drag && !question.data.hidden) {
        switch (question.id) {
            case "radius":
                return radiusPlanningPolygon(question.data);
            case "thermometer":
                return thermometerPlanningPolygon(question.data);
            case "tentacles":
                return tentaclesPlanningPolygon(question.data);
            case "matching":
                return matchingPlanningPolygon(question.data);
            case "measuring":
                return measuringPlanningPolygon(question.data);
        }
    }
};

/** A question's shape on the map (circle, split line…), lock or no lock. */
export const questionOutline = async (question: Question) => {
    if (question.data.hidden) return undefined;
    switch (question.id) {
        case "radius":
            return radiusPlanningPolygon(question.data);
        case "thermometer":
            return thermometerPlanningPolygon(question.data);
        case "tentacles":
            return tentaclesPlanningPolygon(question.data);
        case "matching":
            return matchingPlanningPolygon(question.data);
        case "measuring":
            return measuringPlanningPolygon(question.data);
    }
};

export async function adjustMapGeoDataForQuestion(
    question: Question,
    mapGeoData: any,
) {
    switch (question.id) {
        case "radius":
            return await adjustPerRadius(question.data, mapGeoData);
        case "thermometer":
            return await adjustPerThermometer(question.data, mapGeoData);
        case "tentacles":
            if (question.data.location === false) {
                return adjustPerRadius(
                    { ...question.data, within: false },
                    mapGeoData,
                );
            }
            return await adjustPerTentacle(question.data, mapGeoData);
        case "matching":
            return await adjustPerMatching(question.data, mapGeoData);
        case "measuring":
            return await adjustPerMeasuring(question.data, mapGeoData);
        default:
            return mapGeoData;
    }
}

/** What happened to a question during the last map refresh. */
export type QuestionStatus =
    | { state: "ok" }
    | {
          state: "skipped";
          reason: "hidden" | "planning" | "waiting" | "before-endgame";
      }
    | { state: "not-applicable"; message: string }
    | { state: "error"; message: string };

export const NO_AREA_LEFT =
    "This answer contradicts the earlier ones: no area is left.";

const asFeatureCollection = (data: any) =>
    data.type === "FeatureCollection"
        ? data
        : { type: "FeatureCollection", features: [data] };

/**
 * Narrows the play area by each question in turn. A question that fails, or
 * whose answer would leave no area at all, is recorded in `statuses` and
 * skipped, so one bad question can't silently break the others.
 */
export async function applyQuestionsToMapGeoData(
    questions: Questions,
    mapGeoData: any,
    planningModeEnabled: boolean,
    planningModeCallback?: (
        polygon: FeatureCollection | Feature,
        question: Question,
    ) => void,
): Promise<{ mapGeoData: any; statuses: Map<number, QuestionStatus> }> {
    const statuses = new Map<number, QuestionStatus>();

    for (const question of questions) {
        if (question.data.hidden) {
            statuses.set(question.key, { state: "skipped", reason: "hidden" });
            continue;
        }

        try {
            if (planningModeEnabled && question.data.drag) {
                const polygon = await determinePlanningPolygon(question, true);
                if (polygon && planningModeCallback) {
                    planningModeCallback(polygon, question);
                }
                statuses.set(question.key, {
                    state: "skipped",
                    reason: "planning",
                });
                continue;
            }

            const adjusted = await adjustMapGeoDataForQuestion(
                question,
                mapGeoData,
            );
            if (!adjusted || turf.area(adjusted) === 0) {
                statuses.set(question.key, {
                    state: "error",
                    message: NO_AREA_LEFT,
                });
                continue;
            }

            mapGeoData = asFeatureCollection(adjusted);
            statuses.set(question.key, { state: "ok" });
        } catch (error) {
            statuses.set(
                question.key,
                error instanceof NotApplicableError
                    ? { state: "not-applicable", message: error.message }
                    : { state: "error", message: errorMessage(error) },
            );
        }
    }

    return { mapGeoData, statuses };
}
