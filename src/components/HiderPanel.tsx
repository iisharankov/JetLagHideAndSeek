import { useStore } from "@nanostores/react";
import { toast } from "react-toastify";

import { useTick } from "@/hooks/useTick";
import {
    endgame,
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
    isLoading,
    trainStations,
} from "@/lib/context";
import { formatDuration } from "@/lib/game/clock";
import { serverNow } from "@/lib/game/serverTime";
import { gameState, sendOp } from "@/lib/game/session";
import { describeGeoError, locate } from "@/lib/geolocation";
import {
    chosenStation,
    hiderChoosing,
    hiderShowAll,
    setHiderPin,
    showHiderPin,
} from "@/lib/hiderSpot";
import type { StationCircle } from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import {
    goToPick,
    goToStation,
    pickStation,
    stationId,
} from "@/maps/hidingZoneLayer";

import { Button } from "./ui/button";
import { ToggleCard } from "./ui/toggle-card";

const label = (station: StationCircle) =>
    extractStationLabel(station.properties) as string;

/**
 * Sidebar → Hider (the hider's phone): picking the station, then only the
 * hider's own zone, the pin, and what the end game changes.
 */
export const HiderPanel = () => {
    const $chosen = useStore(chosenStation);
    const $choosing = useStore(hiderChoosing);
    const $showAll = useStore(hiderShowAll);
    const $showPin = useStore(showHiderPin);
    const $pin = useStore(hiderMode);
    const $endgame = useStore(endgame);
    const $game = useStore(gameState);
    useTick(!!$game?.move);
    const $isLoading = useStore(isLoading);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const stations = useStore(trainStations);
    const radius = `${$hidingRadius} ${
        $hidingRadiusUnits === "kilometers" ? "km" : $hidingRadiusUnits
    }`;

    const choosing = $choosing || !$chosen;

    if (choosing) {
        return (
            <div
                className="flex flex-col gap-2 p-2 text-sm"
                data-testid="hider-panel"
            >
                <p className="rounded-md bg-yellow-500/15 p-2">
                    <strong>Pick your station.</strong> Every station is on the
                    map with its hiding zone ({radius} around it). Tap yours on
                    the map or in the list; it turns red.
                </p>
                {$chosen && (
                    <p data-testid="hider-station">
                        Picked: <strong>{$chosen.name}</strong>
                    </p>
                )}
                <Button
                    disabled={!$chosen}
                    onClick={() => {
                        hiderChoosing.set(false);
                        if ($chosen) goToPick($chosen);
                        toast.success(
                            `Your station is ${$chosen?.name}. The red circle is your hiding zone.`,
                        );
                    }}
                    data-testid="hider-done"
                >
                    Done
                </Button>
                {stations.length === 0 && (
                    <p className="text-xs text-slate-400">
                        {$isLoading
                            ? "Loading the stations…"
                            : "No stations yet: the play area may still be loading."}
                    </p>
                )}
                <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
                    {stations.map((station) => (
                        <li
                            key={stationId(station)}
                            className="flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent"
                        >
                            <button
                                type="button"
                                className="flex-1 truncate text-left"
                                title="Show on the map"
                                onClick={() => goToStation(station)}
                            >
                                {label(station)}
                            </button>
                            <button
                                type="button"
                                className="rounded-md bg-slate-600 px-1.5 py-0.5 text-xs disabled:opacity-50"
                                disabled={stationId(station) === $chosen?.id}
                                onClick={() => pickStation(station)}
                            >
                                {stationId(station) === $chosen?.id
                                    ? "Picked"
                                    : "Mine"}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div
            className="flex flex-col gap-2 p-2 text-sm"
            data-testid="hider-panel"
        >
            {$game?.move && (
                <section className="rounded-md border border-orange-500/60 bg-orange-950/40 p-2">
                    <p>
                        <strong>Move.</strong> The seekers are frozen and know
                        you were at{" "}
                        {$game.move.station?.name ?? "your old station"}. Is
                        this your new station? Then continue.{" "}
                        <span data-testid="move-left">
                            {formatDuration(
                                Math.max(0, $game.move.endsAt - serverNow()),
                            )}{" "}
                            left; the game goes on by itself after that.
                        </span>
                    </p>
                    <Button
                        size="sm"
                        className="mt-1"
                        onClick={() => void sendOp({ type: "resumeMove" })}
                    >
                        Continue: the game goes on
                    </Button>
                </section>
            )}
            <section className="rounded-md border border-red-500/60 p-2">
                <p data-testid="hider-station">
                    Your station: <strong>{$chosen.name}</strong>. The red
                    circle ({radius}) is your hiding zone.
                </p>
                <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={() => hiderChoosing.set(true)}
                >
                    Change station
                </Button>
            </section>
            {$endgame ? (
                <section
                    className="rounded-md border border-amber-500/60 bg-amber-950/30 p-2"
                    data-testid="hider-endgame"
                >
                    <p>
                        <strong>End game.</strong> The seekers picked{" "}
                        <strong>{$endgame.station.name}</strong>
                        {$endgame.station.id === $chosen.id
                            ? ": your station"
                            : " (not your station)"}
                        . Your answers now come from your pin: put it exactly
                        where you are.
                    </p>
                </section>
            ) : (
                <p className="text-xs text-slate-400">
                    Answers are worked out from your station until the seekers
                    pick it (the end game); then from your pin.
                </p>
            )}
            <ToggleCard
                title="Show all stations left"
                description="What the seekers see: every station the answers haven't ruled out."
                checked={$showAll}
                onCheckedChange={hiderShowAll.set}
            />
            <ToggleCard
                title="Show my pin"
                description="Where you really are. It stays inside your zone; drag it, or use GPS below."
                checked={$showPin}
                onCheckedChange={showHiderPin.set}
            />
            {$pin !== false && $showPin && (
                <div className="flex items-center justify-between gap-2 rounded-md bg-slate-800/60 p-2 text-xs">
                    <span>
                        Pin: {$pin.latitude.toFixed(5)}°N,{" "}
                        {$pin.longitude.toFixed(5)}°E
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={$isLoading}
                        onClick={() =>
                            void toast.promise(
                                locate().then((position) => {
                                    if (
                                        setHiderPin(
                                            position.coords.latitude,
                                            position.coords.longitude,
                                        ) === "clamped"
                                    ) {
                                        toast.info(
                                            "You're outside your zone; the pin stays at its edge.",
                                            { toastId: "pin-clamped" },
                                        );
                                    }
                                }),
                                {
                                    pending: "Getting your location…",
                                    success: {
                                        render: "Pin set to your position",
                                        autoClose: 1500,
                                    },
                                    error: {
                                        render: ({ data }) =>
                                            describeGeoError(data),
                                        autoClose: 12000,
                                    },
                                },
                            )
                        }
                    >
                        Use my GPS
                    </Button>
                </div>
            )}
            {!$game && (
                <p className="text-xs text-slate-400">
                    Playing alone: the seekers&apos; pick (Stations tab on their
                    phones) starts the end game in a shared game.
                </p>
            )}
        </div>
    );
};
