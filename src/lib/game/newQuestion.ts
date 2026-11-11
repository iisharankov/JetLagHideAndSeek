// New questions from the ask flow's choices, and whether one was asked
// before this round (the ×2 badge). Pure: the screens pass the start point
// (where the phone is, or the map's centre) and what was chosen.
import * as turf from "@turf/turf";

import { timesAskedBefore, timesPhotoAnsweredBefore } from "./questionIdentity";
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
 * A thermometer's end sits east of the start, on the circle of its
 * distance: alone, to drag to where the seekers went; in a shared game, a
 * plan to drag before starting (round 47; the game clears it at Start and
 * sets the real end when it's asked).
 */
export const thermometerQuestion = (start: Start, km: number) => {
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
            // Thermometers are purple (round 42); on the map the start's pin
            // is a darker purple than the end's (round 48).
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
        ? timesAskedBefore(state, {
              ...question,
              key: -1,
          } as SharedQuestion)
        : 0;

/** The same for a photo question, by its name. */
export const photoAskedBefore = (
    state: Pick<GameState, "photoRequests"> | null,
    name: string,
) => (state ? timesPhotoAnsweredBefore(state, name) : 0);
