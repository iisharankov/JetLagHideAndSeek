// The question card's words and sums (round 46): its one-line summary
// (layout C), whether a question's point is where the phone is ("me") or
// not ("the pin"), what the map frames when a card opens over it, and the
// What if chip's next answer.
import { TYPES } from "@/lib/questionInfo";
import type { Question } from "@/maps/schema";

/** Where a question is asked from, in its sentence: the phone, or its pin. */
export type Where = "me" | "the pin";

/** "500 m", "10 km". */
export const distanceLabel = (km: number) =>
    km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;

const KM_PER_DEGREE = 111.32;

/** Metres between two points (flat: close enough under a few km). */
const metresApart = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
) => {
    const dLat = (a.lat - b.lat) * KM_PER_DEGREE;
    const dLng =
        (a.lng - b.lng) * KM_PER_DEGREE * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng) * 1000;
};

/**
 * The question's point is the phone's position: within the fix's accuracy,
 * and never less than 30 m (a fix wanders that much standing still).
 */
export const atMyPosition = (
    point: { lat: number; lng: number },
    here: { latitude: number; longitude: number; accuracy?: number } | null,
) =>
    here !== null &&
    metresApart(point, { lat: here.latitude, lng: here.longitude }) <=
        Math.max(30, here.accuracy ?? 0);

type Bounds = [[number, number], [number, number]];

/** A box of `km` around a point: [[south, west], [north, east]]. */
const around = (lat: number, lng: number, km: number): Bounds => {
    const dLat = km / KM_PER_DEGREE;
    const dLng = km / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
    return [
        [lat - dLat, lng - dLng],
        [lat + dLat, lng + dLng],
    ];
};

const union = (a: Bounds, b: Bounds): Bounds => [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
];

/** What a card opened over the map shows: the question's circle or place. */
export const questionBounds = (question: Question): Bounds | null => {
    const data = question.data as Record<string, any>;
    const km = (value: number, unit?: string) =>
        unit === "meters" ? value / 1000 : value;
    switch (question.id) {
        case "radius":
        case "tentacles":
            return around(data.lat, data.lng, km(data.radius, data.unit));
        case "thermometer": {
            const start = around(data.latA, data.lngA, data.distanceKm ?? 1);
            return data.latB !== null && data.lngB !== null
                ? union(start, around(data.latB, data.lngB, 0))
                : start;
        }
        case "matching":
        case "measuring":
            return typeof data.lat === "number"
                ? around(data.lat, data.lng, 3)
                : null;
        default:
            return null;
    }
};

/** The next answer for the What if chip, round and round. */
export const nextChoice = <T>(options: readonly T[], value: T): T =>
    options[(options.indexOf(value) + 1) % options.length];

const typeLabel = (
    kind: "matching" | "measuring" | "tentacles",
    type: string,
) => TYPES[kind][type]?.label ?? type.replace(/[-_]/g, " ");

/** The question in one line, as the summary (layout C) says it. */
export const summaryTitle = (question: Question, where: Where): string => {
    const data = question.data as Record<string, any>;
    switch (question.id) {
        case "radius":
            return `Within ${distanceLabel(
                data.unit === "meters" ? data.radius / 1000 : data.radius,
            )} of ${where}?`;
        case "thermometer":
            return data.latB !== null && data.lngB !== null
                ? "Hotter at the end than at the start?"
                : `After ${distanceLabel(data.distanceKm)}: hotter or colder?`;
        case "matching": {
            const label = typeLabel("matching", data.type);
            if (data.type === "same-train-line") {
                return `On the same train line as ${where}?`;
            }
            return label.startsWith("Same ")
                ? `${label} as ${where}?`
                : `Same ${label.toLowerCase()} as ${where}?`;
        }
        case "measuring":
            return data.type === "sea-level"
                ? `Higher or lower than ${where}?`
                : `Closer to ${typeLabel("measuring", data.type).toLowerCase()} than ${where}?`;
        case "tentacles":
            return `Which of the ${typeLabel(
                "tentacles",
                data.locationType,
            ).toLowerCase()} within ${distanceLabel(data.radius)} of ${where}?`;
        default:
            return "";
    }
};
