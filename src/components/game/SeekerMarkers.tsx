import { useStore } from "@nanostores/react";
import * as L from "leaflet";
import { Marker, Tooltip } from "react-leaflet";

import { useTick } from "@/hooks/useTick";
import { ago } from "@/lib/format";
import { positionsShown, seekerPositions } from "@/lib/game/positions";
import { serverNow } from "@/lib/game/serverTime";
import { gameRole, myPlayerId } from "@/lib/game/session";

/** Not heard from for this long: drawn faded (after an hour it's gone). */
const QUIET_MS = 10 * 60_000;

/** A person, white on dark: not a question's pin, not the blue "you". */
const ICON = L.divIcon({
    html: `<div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-900 shadow"><svg width="14" height="14" viewBox="0 0 16 16" fill="white"><circle cx="8" cy="4.5" r="3"/><path d="M2.5 15c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6z"/></svg></div>`,
    className: "seeker-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

/**
 * The seekers where their phones last were: every one on the hider's map
 * (the rulebook has the seekers keep a tracker on so the hider can follow
 * them), the others on a seeker's.
 */
export const SeekerMarkers = () => {
    const $positions = useStore(seekerPositions);
    const $role = useStore(gameRole);
    const $me = useStore(myPlayerId);
    useTick($positions.length > 0, 30_000);
    const now = serverNow();
    return positionsShown($positions, {
        hider: $role === "hider",
        me: $me,
    }).map((seeker) => (
        <Marker
            key={seeker.playerId}
            position={[seeker.latitude, seeker.longitude]}
            icon={ICON}
            opacity={now - seeker.at > QUIET_MS ? 0.5 : 1}
            keyboard={false}
            title={seeker.name}
        >
            <Tooltip permanent direction="top" offset={[0, -12]}>
                {seeker.name} · {ago(seeker.at, now)}
            </Tooltip>
        </Marker>
    ));
};
