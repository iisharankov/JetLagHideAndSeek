// The thermometer as the rulebook plays it: started where the seekers are,
// asked once they've travelled its distance as the crow flies. Shared by
// the phones (the progress, the Ask button) and the server (the check).
import * as turf from "@turf/turf";

type Point = { lat: number; lng: number };
type Here = { latitude: number; longitude: number };

/**
 * The server lets a phone ask a little short of the distance (GPS fixes
 * wander); the phone itself waits for the whole distance.
 */
export const ASK_SLACK = 0.98;

/** Kilometres from the start to here, as the crow flies. */
export const coveredKm = (start: Point, here: Here) =>
    turf.distance([start.lng, start.lat], [here.longitude, here.latitude], {
        units: "kilometers",
    });

type Started = { latA: number; lngA: number; distanceKm?: number };

const startOf = (question: Started) => ({
    lat: question.latA,
    lng: question.lngA,
});

/** Kilometres still to travel before the thermometer can be asked. */
export const remainingKm = (question: Started, here: Here | null) => {
    const distance = question.distanceKm ?? 0;
    if (!here) return distance;
    return Math.max(0, distance - coveredKm(startOf(question), here));
};

/** Whether the seekers have travelled the whole distance from the start. */
export const canAsk = (question: Started, here: Here | null) =>
    !!here &&
    coveredKm(startOf(question), here) >= (question.distanceKm ?? Infinity);

/** "2.3", "0.45", "15": a distance in km for the card and messages. */
export const kmText = (km: number) =>
    String(
        Number(
            km >= 10 ? km.toFixed(0) : km >= 1 ? km.toFixed(1) : km.toFixed(2),
        ),
    );

type Planned = Started & { latB: number | null; lngB: number | null };

/**
 * A game's draft thermometer gets a planned end (round 47): a second pin
 * on the circle of its distance, east of the start, to drag to where the
 * seekers mean to go and see what the answer would cut in half.
 */
export const plannedEnd = (question: Started) => {
    const [lngB, latB] = turf.getCoord(
        turf.destination(
            [question.lngA, question.latA],
            question.distanceKm ?? 5,
            90,
            { units: "kilometers" },
        ),
    );
    return { latB, lngB };
};

/**
 * The planned end can't be nearer than the distance (the least the seekers
 * travel): inside the circle, it's moved out to it, the same way round.
 * Null when it's fine where it is (or there's no end).
 */
export const endOutside = (question: Planned) => {
    if (question.latB === null || question.lngB === null) return null;
    const start: [number, number] = [question.lngA, question.latA];
    const end: [number, number] = [question.lngB, question.latB];
    const distance = question.distanceKm ?? 0;
    const apart = turf.distance(start, end, { units: "kilometers" });
    if (apart >= distance) return null;
    const bearing = apart > 0 ? turf.bearing(start, end) : 90;
    const [lngB, latB] = turf.getCoord(
        turf.destination(start, distance, bearing, { units: "kilometers" }),
    );
    return { latB, lngB };
};
