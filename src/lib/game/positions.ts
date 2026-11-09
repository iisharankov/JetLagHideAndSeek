// The seekers' positions (server/src/positions.ts): this phone's is sent
// while it's followed, as a seeker; everyone's come back for the map.
import * as turf from "@turf/turf";
import { atom } from "nanostores";

import type { PlayerId, SeekerPosition } from "./types";

/** The game's seekers, where they last were (from the game's stream). */
export const seekerPositions = atom<SeekerPosition[]>([]);

/** A move worth sending… */
const MOVED_METRES = 25;
/** …at most this often… */
const EVERY_MS = 10_000;
/** …and this often anyway, so the hider sees it's still live. */
const STILL_MS = 60_000;

type Fix = { latitude: number; longitude: number; at: number };

/** Whether this fix should go to the game, after the last one sent. */
export const positionDue = (last: Fix | null, here: Fix) => {
    if (!last) return true;
    const since = here.at - last.at;
    if (since >= STILL_MS) return true;
    if (since < EVERY_MS) return false;
    const metres =
        turf.distance(
            [last.longitude, last.latitude],
            [here.longitude, here.latitude],
            { units: "kilometers" },
        ) * 1000;
    return metres >= MOVED_METRES;
};

/**
 * Who's on this phone's map: every seeker for the hider, the others for a
 * seeker (their own is the blue dot). By player, so two Anas are two.
 */
export const positionsShown = (
    positions: SeekerPosition[],
    { hider, me }: { hider: boolean; me: PlayerId | null },
) =>
    hider
        ? positions
        : positions.filter((position) => position.playerId !== me);
