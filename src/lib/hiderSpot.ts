// The hider's spot on the hider's phone: their station (the red circle
// around it is their hiding zone) and the pin where they really are. Shared
// between the hider's phones through the game, never with the seekers.
import * as turf from "@turf/turf";
import { atom } from "nanostores";

import {
    endgame,
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
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
/** The hider is picking (or changing) their station on the map. */
export const hiderChoosing = atom<boolean>(false);
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
    const station = chosenStation.get();
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
): "ok" | "clamped" => {
    const station = chosenStation.get();
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

/** The hider picks their station; the pin moves there unless it's already in the zone. */
export const pickHiderStation = (station: StationPick) => {
    chosenStation.set(station);
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
