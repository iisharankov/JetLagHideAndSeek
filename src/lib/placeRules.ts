// Which places count. The players reject places while setting up the game
// (a "zoo" that is a pet shop, a mis-tagged museum); those are out of every
// question. And the same place listed several times in the map data (a
// park with three pins) counts once.
import * as turf from "@turf/turf";
import type { Feature, Point } from "geojson";
import { atom } from "nanostores";

import { gameSettings, mapGeoJSON, playAreaKey } from "@/lib/context";
import type { RejectedPlace } from "@/lib/game/types";
import { persistentAtom } from "@/lib/persist";

const json = { encode: JSON.stringify, decode: JSON.parse };
/** A rejection matches a place of the same name within this distance. */
const REJECT_KM = 1;
/** Pins of the same name this close together are one place. */
const DUPLICATE_KM = 0.3;
/** The parts of one place ("… West" and "… Ost") can be this far apart. */
const PART_KM = 1;
/** Two places of a kind this close (the same block) are one dot. */
const SAME_BLOCK_KM = 0.15;
/** OSM access values that mean "not open to the public". */
const NOT_PUBLIC = new Set(["private", "no", "permit", "customers"]);

/**
 * A name as compared: lower case, without a company suffix, a trailing
 * part name or a trailing number, so "Wildnispark Zürich Langenberg West"
 * and "… Ost", "Riffraff 1 + 2" and "Riffraff 3 + 4" are one place each.
 */
const nameKey = (name: string) =>
    name
        .trim()
        .toLowerCase()
        .replace(/\s+(ag|gmbh|sa|sàrl|sarl|ltd|e\.\s?v\.)\.?$/i, "")
        .replace(
            /\s*[-–(]?\s*\b(west|ost|east|nord|north|süd|sued|south|teil \w+)\b\)?\s*$/i,
            "",
        )
        .replace(/[\s\d+&/,–-]+$/, "")
        .trim();

interface KindRule {
    /** The name must say so (a "zoo" that doesn't is a pet corner or an aviary). */
    keep?: RegExp;
    /** Names that give a mis-tagged place away. */
    drop?: RegExp;
    /** Places with a known area smaller than this don't count (m²). */
    minAreaM2?: number;
}

/**
 * What the map data calls a zoo, a golf course or a theme park is often a
 * pet corner, a simulator lounge or a trampoline hall. These rules, from
 * going through the Zürich data, keep the real ones; the review on the map
 * handles the rest.
 */
const KIND_RULES: Record<string, KindRule> = {
    zoo: {
        keep: /zoo|tierpark|tiergarten|tierwelt|wildpark|wildnispark|kinderzoo|zoologi|animal park|wildlife park|safari|papiliorama|sikypark/i,
        drop: /streichel|voli[eè]re|gehege|\bstall\b|wiese\b|gatter|vogel|storch|hirsch|ziegen|fischotter|privat|zucht|hof\b/i,
    },
    theme_park: {
        drop: /trampolin|waldlabor|feldbahn|\blabor|bowling|minigolf|\bkart|escape|indoor ?play|hüpf|jump/i,
    },
    golf_course: {
        drop: /lounge|simulator|indoor|kurzplatz|kurzspiel|short ?course|snag|driving ?range|minigolf|pitch ?& ?putt|footgolf|swin ?golf/i,
    },
    consulate: { drop: /visa|visum|application cent/i },
    library: { drop: /ludothek|spielothek|toy librar|spielzeug/i },
    hospital: {
        drop: /tierklinik|tierarzt|tierspital|veterin|dental|zahn|\bpraxis|notfallstation|\bderma\b|hochhaus|tagesklinik/i,
    },
    park: {
        drop: /spielplatz|playground|parkplatz|parking|parkhaus|friedhof|cemetery|hundezone|dog park/i,
        minAreaM2: 5000,
    },
};

/** Whether a place's name (and size, when known) fits its kind. */
export const passesKindRules = (
    kind: string,
    name: string,
    areaM2?: number,
) => {
    const rule = KIND_RULES[kind];
    if (!rule) return true;
    if (rule.keep && !rule.keep.test(name)) return false;
    if (rule.drop && rule.drop.test(name)) return false;
    if (
        rule.minAreaM2 !== undefined &&
        areaM2 !== undefined &&
        areaM2 < rule.minAreaM2
    ) {
        return false;
    }
    return true;
};

/**
 * Places the rules can't tell apart from real ones, out after a look at
 * each. They're part of the built-in rules, like the name rules above.
 */
const CURATED_DROPS: RejectedPlace[] = [
    // A deer enclosure by the Waidspital, not a zoo.
    { kind: "zoo", name: "Tierpark Waidberg", lat: 47.40033, lng: 8.517 },
    // A practice ground; nothing found about a course.
    { kind: "golf_course", name: "John's Golf", lat: 47.43974, lng: 8.97588 },
];

const km = (aLat: number, aLng: number, bLat: number, bLng: number) =>
    turf.distance([aLng, aLat], [bLng, bLat], { units: "kilometers" });

/**
 * Rejections by play area, on this phone: what the players decided while
 * setting up a game here comes back for the next game in the same area.
 */
export const rejectedPlacesByArea = persistentAtom<
    Record<string, RejectedPlace[]>
>("rejectedPlaces", {}, json);

/** This phone's rejections for the play area. */
export const localRejections = () =>
    rejectedPlacesByArea.get()[playAreaKey()] ?? [];

export const setLocalRejections = (list: RejectedPlace[]) =>
    rejectedPlacesByArea.set({
        ...rejectedPlacesByArea.get(),
        [playAreaKey()]: list,
    });

/** The rejections in force: the game's (every phone has the same). */
export const rejections = () => gameSettings.get().rejectedPlaces ?? [];

/** Rejections by kind and name, built once per list (lists are replaced, never mutated). */
const indexes = new WeakMap<RejectedPlace[], Map<string, RejectedPlace[]>>();
const indexOf = (list: RejectedPlace[]) => {
    let index = indexes.get(list);
    if (!index) {
        index = new Map();
        for (const entry of list) {
            const key = `${entry.kind}|${nameKey(entry.name)}`;
            index.set(key, [...(index.get(key) ?? []), entry]);
        }
        indexes.set(list, index);
    }
    return index;
};

export const isRejected = (
    kind: string,
    name: string | undefined,
    lat: number,
    lng: number,
    list: RejectedPlace[] = rejections(),
) =>
    !!name &&
    (indexOf(list).get(`${kind}|${nameKey(name)}`) ?? []).some(
        (entry) => km(lat, lng, entry.lat, entry.lng) <= REJECT_KM,
    );

export const hasRejections = (
    kind: string,
    list: RejectedPlace[] = rejections(),
) => list.some((entry) => entry.kind === kind);

/** Toggles a place's rejection in a list. */
export const toggleRejection = (
    list: RejectedPlace[],
    place: RejectedPlace,
): RejectedPlace[] =>
    isRejected(place.kind, place.name, place.lat, place.lng, list)
        ? list.filter(
              (entry) =>
                  !(
                      entry.kind === place.kind &&
                      nameKey(entry.name) === nameKey(place.name) &&
                      km(place.lat, place.lng, entry.lat, entry.lng) <=
                          REJECT_KM
                  ),
          )
        : [...list, place];

const areaOf = (point: Feature<Point>) =>
    typeof point.properties?.areaM2 === "number"
        ? (point.properties.areaM2 as number)
        : 0;

/**
 * Places within a block of each other are one dot: a hospital and its
 * clinic next door, two cinemas on one street. The biggest (by mapped
 * area, when known) stays, else the first listed. A grid of cells keeps
 * thousands of parks cheap.
 */
const mergeNeighbours = <F extends Feature<Point>>(points: F[]): F[] => {
    const kept: F[] = [];
    const cells = new Map<string, F[]>();
    const size = SAME_BLOCK_KM / 100; // about a block, in degrees of latitude
    const cellOf = (point: F) => {
        const [lng, lat] = point.geometry.coordinates;
        return { row: Math.floor(lat / size), col: Math.floor(lng / size) };
    };
    for (const point of points) {
        const [lng, lat] = point.geometry.coordinates;
        const { row, col } = cellOf(point);
        let neighbour: F | undefined;
        for (let r = row - 1; r <= row + 1 && !neighbour; r++) {
            for (let c = col - 1; c <= col + 1 && !neighbour; c++) {
                neighbour = (cells.get(`${r}:${c}`) ?? []).find((other) => {
                    const [otherLng, otherLat] = other.geometry.coordinates;
                    return km(lat, lng, otherLat, otherLng) <= SAME_BLOCK_KM;
                });
            }
        }
        if (neighbour) {
            if (areaOf(point) > areaOf(neighbour)) {
                // The bigger place takes the dot (and its place in the lists).
                kept[kept.indexOf(neighbour)] = point;
                const { row: nr, col: nc } = cellOf(neighbour);
                const cell = cells.get(`${nr}:${nc}`)!;
                cell[cell.indexOf(neighbour)] = point;
            }
            continue;
        }
        const key = `${row}:${col}`;
        cells.set(key, [...(cells.get(key) ?? []), point]);
        kept.push(point);
    }
    return kept;
};

/**
 * The same place listed several times (same name, close together) once,
 * then anything within a block of another place of the kind. Only places
 * of the same name are compared by name, so thousands of parks stay cheap.
 */
export const mergeDuplicates = <F extends Feature<Point>>(points: F[]): F[] =>
    mergeNeighbours(mergeByName(points));

const mergeByName = <F extends Feature<Point>>(points: F[]): F[] => {
    const kept: F[] = [];
    const byName = new Map<
        string,
        { exact: string; lat: number; lng: number }[]
    >();
    for (const point of points) {
        const name = point.properties?.name as string | undefined;
        if (!name) {
            kept.push(point);
            continue;
        }
        const key = nameKey(name);
        const exact = name.trim().toLowerCase();
        const [lng, lat] = point.geometry.coordinates;
        const twins = byName.get(key) ?? [];
        const twin = twins.some((other) => {
            // The same name twice is one pin mapped twice; different names
            // with one key are the parts of one place.
            const limit = other.exact === exact ? DUPLICATE_KM : PART_KM;
            // A degree is ~111 km: a cheap check before the real distance.
            if (
                Math.abs(other.lat - lat) > limit / 100 ||
                Math.abs(other.lng - lng) > limit / 60
            ) {
                return false;
            }
            return km(lat, lng, other.lat, other.lng) <= limit;
        });
        if (twin) continue;
        twins.push({ exact, lat, lng });
        byName.set(key, twins);
        kept.push(point);
    }
    return kept;
};

/** A place the questions can name. */
export const named = (point: Feature<Point>) => !!point.properties?.name;

/** A place that is named, open to the public and fits its kind's rules. */
export const fitsKind = (kind: string, point: Feature<Point>) => {
    if (!named(point)) return false;
    if (NOT_PUBLIC.has(String(point.properties?.access ?? ""))) return false;
    const name = point.properties!.name as string;
    const [lng, lat] = point.geometry.coordinates;
    return (
        passesKindRules(
            kind,
            name,
            typeof point.properties?.areaM2 === "number"
                ? (point.properties.areaM2 as number)
                : undefined,
        ) && !isRejected(kind, name, lat, lng, CURATED_DROPS)
    );
};

/**
 * Unnamed and mis-tagged places dropped, duplicates merged, rejected
 * places dropped: what the questions count.
 */
export const applyPlaceRules = <F extends Feature<Point>>(
    kind: string,
    points: F[],
    list: RejectedPlace[] = rejections(),
): F[] =>
    mergeDuplicates(points.filter((point) => fitsKind(kind, point))).filter(
        (point) => {
            const [lng, lat] = point.geometry.coordinates;
            return !isRejected(kind, point.properties?.name, lat, lng, list);
        },
    );

/**
 * The rulebook: places outside the play area don't exist. True while no
 * play area is loaded yet.
 */
export const insidePlayArea = (lat: number, lng: number) => {
    const area = mapGeoJSON.get() as any;
    if (!area) return true;
    const point = turf.point([lng, lat]);
    const features: any[] = "features" in area ? area.features : [area];
    return features.some(
        (feature) =>
            feature?.geometry && turf.booleanPointInPolygon(point, feature),
    );
};

/** What the review on the map found, for its bar. */
export const reviewCounts = atom<{
    loading: boolean;
    total: number;
    rejected: number;
    merged: number;
}>({ loading: false, total: 0, rejected: 0, merged: 0 });
