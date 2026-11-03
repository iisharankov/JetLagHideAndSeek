// The tutorial's examples, in Zürich canton: some stations with their hiding
// zones, a radar and a thermometer question, and the end game. Only shapes
// to draw (maps/tourDemoLayer.ts draws them); no question is made or
// changed. tests/tour.test.ts checks that each example shows what its note
// says.
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Point, Polygon } from "geojson";

export const DEMOS = [
    "zones",
    "radar",
    "thermometer",
    "station",
    "endgame",
    "hider-zone",
    "hider-radar",
] as const;
export type DemoId = (typeof DEMOS)[number];

/** The rulebook's hiding zone for small and medium games: ¼ mile, about 500 m. */
export const DEMO_ZONE_KM = 0.5;
export const DEMO_RADAR_KM = 10;

export interface DemoStation {
    name: string;
    lat: number;
    lng: number;
    /** Named on the map. */
    labelled?: boolean;
    /** The name on the left of the point (near the map's right edge). */
    left?: boolean;
    /** In the city: shown up close. */
    city?: boolean;
}

export const STATIONS: DemoStation[] = [
    { name: "Zürich HB", lat: 47.378, lng: 8.5402, labelled: true, city: true },
    { name: "Stadelhofen", lat: 47.3667, lng: 8.5485, city: true },
    { name: "Enge", lat: 47.364, lng: 8.5313, city: true },
    { name: "Hardbrücke", lat: 47.3851, lng: 8.5172, city: true },
    { name: "Wipkingen", lat: 47.393, lng: 8.5292, labelled: true, city: true },
    { name: "Oerlikon", lat: 47.4115, lng: 8.544, labelled: true, city: true },
    { name: "Altstetten", lat: 47.3913, lng: 8.4888, city: true },
    { name: "Zürich Flughafen", lat: 47.4503, lng: 8.5623 },
    { name: "Dietikon", lat: 47.4057, lng: 8.4033 },
    {
        name: "Winterthur",
        lat: 47.5002,
        lng: 8.7237,
        labelled: true,
        left: true,
    },
    { name: "Uster", lat: 47.3505, lng: 8.7176, labelled: true, left: true },
    { name: "Bülach", lat: 47.5224, lng: 8.5391 },
    { name: "Wädenswil", lat: 47.2297, lng: 8.674 },
    { name: "Horgen", lat: 47.2603, lng: 8.5978 },
    { name: "Meilen", lat: 47.2697, lng: 8.643 },
    { name: "Affoltern am Albis", lat: 47.2783, lng: 8.4467 },
];

const station = (name: string) => STATIONS.find((s) => s.name === name)!;
const HB = station("Zürich HB");
const OERLIKON = station("Oerlikon");
const WIPKINGEN = station("Wipkingen");
/** The hider's real spot in the end game: inside Wipkingen's zone. */
const PIN = { lat: 47.3945, lng: 8.531 };

type Area = Feature<Polygon | MultiPolygon>;

const at = (place: { lat: number; lng: number }) =>
    turf.point([place.lng, place.lat]);

const circle = (place: { lat: number; lng: number }, km: number) =>
    turf.circle(at(place), km, { units: "kilometers", steps: 96 });

/** Everywhere nearer `to` than `from` (a strip 100 km wide is plenty here). */
const nearerHalf = (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
): Feature<Polygon> => {
    const middle = turf.midpoint(at(from), at(to));
    const bearing = turf.bearing(at(from), at(to));
    const side = (angle: number) =>
        turf.destination(middle, 50, bearing + angle, { units: "kilometers" });
    const ahead = (point: Feature<Point>) =>
        turf.destination(point, 50, bearing, { units: "kilometers" });
    const left = side(-90);
    const right = side(90);
    return turf.polygon([
        [
            left.geometry.coordinates,
            right.geometry.coordinates,
            ahead(right).geometry.coordinates,
            ahead(left).geometry.coordinates,
            left.geometry.coordinates,
        ],
    ]);
};

const minus = (area: Area, cut: Area): Area =>
    turf.difference(turf.featureCollection([area, cut])) ?? area;

export interface DemoZone {
    station: DemoStation;
    /** "zone" as the app draws one, "kept" one to look at, "mine" the hider's own (red), "endgame" the picked one. */
    style: "zone" | "kept" | "mine" | "endgame";
}

export interface DemoScene {
    /** What the map shows: [[south, west], [north, east]]. */
    bounds: [[number, number], [number, number]];
    /** Where the hider may still be; everything else is shaded. None: nothing shaded. */
    open: Area | null;
    zones: DemoZone[];
    points: {
        lat: number;
        lng: number;
        label: string;
        kind: "seekers" | "pin" | "station";
        left?: boolean;
    }[];
    /** The seekers' ride, for the thermometer. */
    line?: [number, number][];
}

const boundsOf = (places: { lat: number; lng: number }[], padKm = 0) => {
    const box = turf.bbox(
        turf.buffer(
            turf.featureCollection(places.map(at)),
            Math.max(padKm, 0.01),
            { units: "kilometers" },
        )!,
    );
    return [
        [box[1], box[0]],
        [box[3], box[2]],
    ] as [[number, number], [number, number]];
};

const city = STATIONS.filter((s) => s.city);
const labels = (list: DemoStation[]) =>
    list
        .filter((s) => s.labelled)
        .map((s) => ({
            lat: s.lat,
            lng: s.lng,
            label: s.name,
            kind: "station" as const,
            left: s.left,
        }));
const zones = (
    list: DemoStation[],
    kept?: DemoStation,
    style: DemoZone["style"] = "kept",
) =>
    list.map((s) => ({
        station: s,
        style: s === kept ? style : ("zone" as const),
    }));
/** The hider's own zone, named on the map. */
const mine = {
    lat: WIPKINGEN.lat,
    lng: WIPKINGEN.lng,
    label: "Your zone: Wipkingen",
    kind: "station" as const,
};

const radar = circle(HB, DEMO_RADAR_KM);
const afterThermometer = minus(radar, nearerHalf(HB, OERLIKON));
const seekers = (place: { lat: number; lng: number }, label = "Seekers") => ({
    lat: place.lat,
    lng: place.lng,
    label,
    kind: "seekers" as const,
});

export const demoScene = (id: DemoId): DemoScene => {
    switch (id) {
        case "zones":
            return {
                bounds: boundsOf(city, DEMO_ZONE_KM),
                open: null,
                zones: zones(city),
                points: labels(city),
            };
        case "radar":
            return {
                bounds: boundsOf(STATIONS, 1),
                open: radar,
                zones: zones(STATIONS),
                // Only the towns out of reach are named: the city is crowded.
                points: [
                    seekers(HB),
                    ...labels(STATIONS.filter((s) => !s.city)),
                ],
            };
        case "thermometer":
            return {
                bounds: boundsOf([HB, OERLIKON], 2),
                open: afterThermometer,
                zones: zones(city),
                points: [
                    seekers(HB, "Start: Zürich HB"),
                    seekers(OERLIKON, "Now: Oerlikon"),
                ],
                line: [
                    [HB.lat, HB.lng],
                    [OERLIKON.lat, OERLIKON.lng],
                ],
            };
        case "station":
            return {
                bounds: boundsOf([WIPKINGEN], 1.2),
                open: afterThermometer,
                zones: zones(city, WIPKINGEN),
                points: labels([WIPKINGEN]),
            };
        case "hider-zone":
            return {
                bounds: boundsOf(city, DEMO_ZONE_KM),
                open: null,
                zones: zones(city, WIPKINGEN, "mine"),
                points: [mine],
            };
        case "hider-radar":
            return {
                bounds: boundsOf([HB, WIPKINGEN], 11),
                open: radar,
                zones: zones(STATIONS, WIPKINGEN, "mine"),
                points: [
                    seekers(HB, "Seekers: Zürich HB"),
                    { ...mine, left: true },
                ],
            };
        case "endgame":
            return {
                bounds: boundsOf([WIPKINGEN], 0.9),
                open: circle(WIPKINGEN, DEMO_ZONE_KM),
                zones: [{ station: WIPKINGEN, style: "endgame" }],
                points: [
                    ...labels([WIPKINGEN]),
                    { ...PIN, label: "Hider's pin", kind: "pin" },
                ],
            };
    }
};
