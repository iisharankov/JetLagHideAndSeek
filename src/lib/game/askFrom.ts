// Questions are asked from where the seekers are ("Are you within ___ of
// me?"), but a draft's pin may have gone down a while ago, or been dragged
// away. Before it's sent, it's checked against the phone's position.
import * as turf from "@turf/turf";

import type { Question } from "@/maps/schema";

type Here = { latitude: number; longitude: number; accuracy?: number };

/** Closer than this to the phone (or than twice its fix's accuracy): no need to ask. */
const NEAR_METRES = 50;

/**
 * The point a question is asked from: its pin, or where a thermometer's
 * seekers ended up. A custom zone has none.
 */
export const askedFrom = (
    question: Question,
): { lat: number; lng: number; end: boolean } | null => {
    const data = question.data as {
        lat?: number;
        lng?: number;
        latB?: number | null;
        lngB?: number | null;
        type?: string;
    };
    if (question.id === "thermometer") {
        // Asked from where the seekers ended up; until then, from nowhere.
        return data.latB == null || data.lngB == null
            ? null
            : { lat: data.latB, lng: data.lngB, end: true };
    }
    if (question.id === "matching" && data.type === "custom-zone") return null;
    return data.lat === undefined || data.lng === undefined
        ? null
        : { lat: data.lat, lng: data.lng, end: false };
};

/** How far (m) the question's pin is from the phone, when that's far enough to ask. */
export const pinAway = (question: Question, here: Here | null) => {
    const from = here && askedFrom(question);
    if (!here || !from) return null;
    const metres =
        turf.distance([from.lng, from.lat], [here.longitude, here.latitude], {
            units: "kilometers",
        }) * 1000;
    return metres > Math.max(NEAR_METRES, 2 * (here.accuracy ?? 0))
        ? metres
        : null;
};

/** The change that asks it from the phone's position instead. */
export const fromHere = (question: Question, here: Here) =>
    askedFrom(question)?.end
        ? { latB: here.latitude, lngB: here.longitude }
        : { lat: here.latitude, lng: here.longitude };
