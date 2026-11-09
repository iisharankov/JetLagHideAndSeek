// The hider's spot on the hider's phone: their station (the red circle
// around it is their hiding zone) and the pin where they really are. Shared
// between the hider's phones through the game, never with the seekers.
import * as turf from "@turf/turf";
import { atom, computed } from "nanostores";

import {
    endgame,
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
    questions,
} from "@/lib/context";
import type { StationPick } from "@/lib/game/types";
import { persistentAtom } from "@/lib/persist";

const json = { encode: JSON.stringify, decode: JSON.parse };

/**
 * The hider's own station, on the hider's phone only (never shared): the
 * red circle around it is their hiding zone. Answers are worked out from it
 * until the end game.
 */
export const chosenStation = persistentAtom<StationPick | null>(
    "hiderStation",
    null,
    json,
);
/**
 * The station the hider has tapped but not confirmed with Done. Not kept:
 * a refresh forgets it, so nothing becomes the hiding spot by accident.
 */
export const pendingStation = atom<StationPick | null>(null);
/** The hider is picking (or changing) their station on the map. */
export const hiderChoosing = atom<boolean>(false);
/** The hider's station is set: not being picked or changed. */
export const hiderPlaced = computed(
    [chosenStation, hiderChoosing],
    (chosen, choosing) => !!chosen && !choosing,
);
/**
 * The end game is on at the hider's station: the pin is fixed, and the
 * seekers must find the hider exactly there (from the game's state).
 */
export const pinLocked = atom<boolean>(false);
/** The hider also shows what the seekers see: every station still in play. */
export const hiderShowAll = atom<boolean>(false);
/** The hider's pin (their real spot) is drawn on their map. */
export const showHiderPin = persistentAtom<boolean>("showHiderPin", true, json);
/**
 * Where the hider's answers are worked out from: their station until the
 * end game (the seekers have found it), then the pin, where they really
 * are. False when this phone isn't in hider mode.
 */
export const hiderAnswerPosition = ():
    | false
    | { latitude: number; longitude: number } => {
    const pin = hiderMode.get();
    if (pin === false) return false;
    // While choosing, the tapped station: research questions probe it.
    const station = pendingStation.get() ?? chosenStation.get();
    if (station && !endgame.get()) {
        return { latitude: station.lat, longitude: station.lng };
    }
    return pin;
};

const hidingRadiusKm = () =>
    turf.convertLength(
        hidingRadius.get(),
        hidingRadiusUnits.get(),
        "kilometers",
    );

/**
 * Moves the hider pin, keeping it inside the hider's zone (the pin is where
 * the hider really is, and that must be within the zone). Says whether it
 * had to be pulled back in.
 */
export const setHiderPin = (
    latitude: number,
    longitude: number,
): "ok" | "clamped" | "locked" => {
    if (pinLocked.get()) return "locked";
    const station = pendingStation.get() ?? chosenStation.get();
    let result: "ok" | "clamped" = "ok";
    if (station) {
        const centre = turf.point([station.lng, station.lat]);
        const pin = turf.point([longitude, latitude]);
        const radiusKm = hidingRadiusKm();
        if (turf.distance(centre, pin, { units: "kilometers" }) > radiusKm) {
            const inside = turf.destination(
                centre,
                radiusKm * 0.98,
                turf.bearing(centre, pin),
                { units: "kilometers" },
            );
            [longitude, latitude] = turf.getCoord(inside);
            result = "clamped";
        }
    }
    hiderMode.set({ latitude, longitude });
    return result;
};

/** The hider's pin follows their GPS (Hider tab), inside their zone. */
export const pinFollowsGps = persistentAtom<boolean>(
    "pinFollowsGps",
    false,
    json,
);
/** Each move of the pin goes to the game: at most this often… */
const FOLLOW_EVERY_MS = 15_000;
/** …and only for a real move, not the GPS's jitter. */
const FOLLOW_METRES = 10;
/** Another phone moving the pin this long: this one stops following. */
const GIVE_WAY_MS = 30_000;
let followedAt = -Infinity;
/** When this phone started following (its first fix since turning it on). */
let followingSince: number | null = null;
/** Following, and outside the zone: the pin waits at its edge. */
export const pinAtEdge = atom<boolean>(false);
/**
 * Another of the hider's phones moved the pin last (from the game's
 * `hider.pinDriver`): which player, and since when (this phone's clock).
 * Null when it was this phone, or nobody.
 */
export const pinDrivenElsewhere = atom<{ by: string; since: number } | null>(
    null,
);
pinFollowsGps.listen(() => {
    followedAt = -Infinity;
    followingSince = null;
    pinAtEdge.set(false);
});

/**
 * A GPS fix for the hider's pin: moved there (or to the zone's edge, from
 * outside it), or left alone for now ("waiting") or altogether ("off":
 * picking the station, the pin fixed, or the setting off). Two hider phones
 * following would fight over the pin: the one turned on last drives it,
 * and the other gives way after 30 s ("taken": its setting goes off).
 */
export const followPin = (here: {
    latitude: number;
    longitude: number;
    at: number;
}): "moved" | "clamped" | "waiting" | "off" | "taken" => {
    const pin = hiderMode.get();
    if (
        !pinFollowsGps.get() ||
        !hiderPlaced.get() ||
        pinLocked.get() ||
        pin === false
    ) {
        return "off";
    }
    followingSince ??= here.at;
    const other = pinDrivenElsewhere.get();
    if (other && other.since >= followingSince) {
        if (here.at - other.since < GIVE_WAY_MS) return "waiting";
        pinFollowsGps.set(false);
        return "taken";
    }
    const metres =
        turf.distance(
            [pin.longitude, pin.latitude],
            [here.longitude, here.latitude],
            { units: "kilometers" },
        ) * 1000;
    if (here.at - followedAt < FOLLOW_EVERY_MS || metres < FOLLOW_METRES) {
        return "waiting";
    }
    followedAt = here.at;
    const clamped = setHiderPin(here.latitude, here.longitude) === "clamped";
    pinAtEdge.set(clamped);
    return clamped ? "clamped" : "moved";
};

/** Done: the tapped station is the hider's for the round; the research questions go. */
export const confirmHiderStation = () => {
    const station = pendingStation.get();
    if (!station) return null;
    chosenStation.set(station);
    pendingStation.set(null);
    questions.set(questions.get().filter((q) => !q.data.research));
    return station;
};

/** The hider taps a station; the pin moves there unless it's already in the zone. */
export const pickHiderStation = (station: StationPick) => {
    pendingStation.set(station);
    const pin = hiderMode.get();
    const inZone =
        pin !== false &&
        turf.distance(
            [station.lng, station.lat],
            [pin.longitude, pin.latitude],
            { units: "kilometers" },
        ) <= hidingRadiusKm();
    if (!inZone)
        hiderMode.set({ latitude: station.lat, longitude: station.lng });
};
