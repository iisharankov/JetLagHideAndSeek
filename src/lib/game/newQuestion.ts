// New questions from the ask flow's choices, and whether one was asked
// before this round (the ×2 badge). Pure: the screens pass the start point
// (where the phone is, or the map's centre) and what was chosen.
import * as turf from "@turf/turf";

import {
    timesAnsweredBefore,
    timesPhotoAnsweredBefore,
} from "./questionIdentity";
import type { GameState, SharedQuestion } from "./types";

export type Start = { lat: number; lng: number };

export const radarQuestion = (start: Start, km: number) => ({
    id: "radius" as const,
    data: {
        lat: start.lat,
        lng: start.lng,
        radius: km,
        unit: "kilometers" as const,
        // Radars are blue (round 42).
        color: "blue" as const,
    },
});

/**
 * In a shared game a thermometer has no end until it's asked (the seekers
 * travel first); alone, the end sits east of the start, to drag.
 */
export const thermometerQuestion = (
    start: Start,
    km: number,
    shared: boolean,
) => {
    if (shared) {
        return {
            id: "thermometer" as const,
            data: {
                latA: start.lat,
                lngA: start.lng,
                latB: null,
                lngB: null,
                distanceKm: km,
                // Thermometers are purple (round 42): the start pin.
                colorA: "violet" as const,
            },
        };
    }
    const [lngB, latB] = turf.destination([start.lng, start.lat], km, 90, {
        units: "kilometers",
    }).geometry.coordinates;
    return {
        id: "thermometer" as const,
        data: {
            latA: start.lat,
            lngA: start.lng,
            latB,
            lngB,
            distanceKm: km,
            colorA: "violet" as const,
        },
    };
};

export const matchingQuestion = (start: Start, type: string) => ({
    id: "matching" as const,
    data: { lat: start.lat, lng: start.lng, type },
});

export const measuringQuestion = (start: Start, type: string) => ({
    id: "measuring" as const,
    data: { lat: start.lat, lng: start.lng, type },
});

export const tentacleQuestion = (
    start: Start,
    locationType: string,
    km: number,
) => ({
    id: "tentacles" as const,
    data: {
        lat: start.lat,
        lng: start.lng,
        locationType,
        radius: km,
        unit: "kilometers" as const,
    },
});

/** How often a question like this one was answered this round (0: not asked before). */
export const askedBefore = (
    state: Pick<GameState, "questions"> | null,
    question: { id: string; data: Record<string, unknown> },
) =>
    state
        ? timesAnsweredBefore(state, {
              ...question,
              key: -1,
          } as SharedQuestion)
        : 0;

/** The same for a photo question, by its name. */
export const photoAskedBefore = (
    state: Pick<GameState, "photoRequests"> | null,
    name: string,
) => (state ? timesPhotoAnsweredBefore(state, name) : 0);
