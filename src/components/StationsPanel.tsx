import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    disabledStations,
    displayHidingZones,
    displayHidingZonesStyle,
    endgame,
    gameSettings,
    hidingRadius,
    hidingRadiusUnits,
    highlightedStation,
    isLoading,
    trainStations,
} from "@/lib/context";
import { endEndgame, startEndgame } from "@/lib/game/endgame";
import { gameState, zonesAllowed } from "@/lib/game/session";
import { describeStations } from "@/lib/game/settings";
import type { StationCircle } from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import { goToStation, stationId, stationPick } from "@/maps/hidingZoneLayer";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";

const label = (station: StationCircle) =>
    extractStationLabel(station.properties) as string;

const StationRow = ({
    station,
    busy,
    onPick,
    action,
    onAction,
}: {
    station: StationCircle;
    busy: boolean;
    onPick?: () => void;
    action: string;
    onAction: () => void;
}) => (
    <li
        className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent"
        data-station-id={stationId(station)}
    >
        <button
            type="button"
            className="flex-1 truncate text-left"
            title="Show on the map"
            onClick={() => goToStation(station)}
        >
            {label(station)}
        </button>
        {onPick && (
            <button
                type="button"
                className="rounded-md bg-slate-600 px-1.5 py-0.5 text-xs disabled:opacity-50"
                disabled={busy}
                onClick={onPick}
            >
                Found it
            </button>
        )}
        <button
            type="button"
            className="rounded-md bg-slate-700 px-1.5 py-0.5 text-xs disabled:opacity-50"
            disabled={busy}
            onClick={onAction}
        >
            {action}
        </button>
    </li>
);

/**
 * Sidebar → Stations (seekers): the hiding zones, the stations still in
 * play, and the end game once the hider's station is found.
 */
export const StationsPanel = () => {
    const $displayHidingZones = useStore(displayHidingZones);
    const $style = useStore(displayHidingZonesStyle);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const $gameSettings = useStore(gameSettings);
    const $isLoading = useStore(isLoading);
    const stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $highlighted = useStore(highlightedStation);
    const $endgame = useStore(endgame);
    const $game = useStore(gameState);
    const $allowed = useStore(zonesAllowed);
    const [search, setSearch] = useState("");
    const [showLeft, setShowLeft] = useState(true);
    const [showRemoved, setShowRemoved] = useState(false);
    const [picking, setPicking] = useState<StationCircle | null>(null);

    // A zone tapped on the map: show its row and flash it for a moment.
    useEffect(() => {
        if (!$highlighted) return;
        setShowLeft(true);
        let element: HTMLElement | null = null;
        const frame = requestAnimationFrame(() => {
            element = document.querySelector<HTMLElement>(
                `[data-station-id="${CSS.escape($highlighted)}"]`,
            );
            element?.scrollIntoView({ behavior: "smooth", block: "center" });
            element?.classList.add("selected-card-background-temporary");
        });
        const timer = setTimeout(() => {
            element?.classList.remove("selected-card-background-temporary");
            highlightedStation.set("");
        }, 5000);
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(timer);
        };
    }, [$highlighted]);

    const matches = (station: StationCircle) =>
        search.trim() === "" ||
        label(station).toLowerCase().includes(search.trim().toLowerCase());
    const left = stations.filter(
        (station) => !$disabledStations.includes(stationId(station)),
    );
    const removed = stations.filter((station) =>
        $disabledStations.includes(stationId(station)),
    );

    return (
        <div className="flex flex-col gap-2 p-2 text-sm">
            {$endgame && (
                <section
                    className="flex flex-col gap-1 rounded-md border border-red-500/60 bg-red-950/30 p-2"
                    data-testid="endgame"
                >
                    <p>
                        <strong>End game</strong> at{" "}
                        <strong>{$endgame.station.name}</strong>
                        {$endgame.by && ` (picked by ${$endgame.by})`}: only its
                        zone is left on the map. Questions asked before
                        don&apos;t count any more; new ones do.
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="self-start"
                        onClick={endEndgame}
                    >
                        Wrong station? Undo
                    </Button>
                </section>
            )}
            {$allowed ? (
                <ToggleCard
                    title="Show hiding zones"
                    description="A green circle around every station the answers haven't ruled out. A station is in or out by its own position; the hider may be anywhere in its circle."
                    checked={$displayHidingZones}
                    onCheckedChange={displayHidingZones.set}
                    disabled={$isLoading}
                />
            ) : (
                <p
                    className="rounded-md bg-slate-800 p-2 text-xs text-slate-300"
                    data-testid="zones-off"
                >
                    This game keeps the hiding zones to the hider&apos;s phone
                    (a setting chosen when it started). The map still shows
                    where the hider can&apos;t be.
                </p>
            )}
            {$displayHidingZones && $allowed && (
                <>
                    <SegmentedControl
                        label="Show on the map"
                        options={[
                            { value: "zones", label: "Zones" },
                            { value: "stations", label: "Stations" },
                        ]}
                        value={$style}
                        onValueChange={displayHidingZonesStyle.set}
                        disabled={$isLoading}
                    />
                    <p className="text-xs text-slate-400">
                        {$hidingRadius}{" "}
                        {$hidingRadiusUnits === "kilometers"
                            ? "km"
                            : $hidingRadiusUnits}{" "}
                        around {describeStations($gameSettings.stationKinds)}.
                        Change: Menu → Game.
                    </p>
                    {!$endgame && (
                        <p className="text-xs text-slate-400">
                            Found the hider&apos;s station? &quot;Found it&quot;
                            starts the end game: only that zone stays on the map
                            {$game ? ", for everyone" : ""}.
                        </p>
                    )}
                    <section>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between py-1 text-left font-semibold font-poppins"
                            onClick={() => setShowLeft(!showLeft)}
                            aria-expanded={showLeft}
                            data-testid="remaining-stations-count"
                        >
                            <span>
                                {left.length === 1
                                    ? "1 station left"
                                    : `${left.length} stations left`}
                            </span>
                            <span aria-hidden="true">
                                {showLeft ? "▾" : "▸"}
                            </span>
                        </button>
                        {showLeft && (
                            <>
                                <Input
                                    placeholder="Search stations…"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    debounce={200}
                                    disabled={$isLoading}
                                />
                                <ul className="mt-1 flex flex-col">
                                    {left.filter(matches).map((station) => (
                                        <StationRow
                                            key={stationId(station)}
                                            station={station}
                                            busy={$isLoading}
                                            onPick={
                                                $endgame
                                                    ? undefined
                                                    : () => setPicking(station)
                                            }
                                            action="Remove"
                                            onAction={() =>
                                                disabledStations.set([
                                                    ...$disabledStations,
                                                    stationId(station),
                                                ])
                                            }
                                        />
                                    ))}
                                    {left.length > 0 &&
                                        left.filter(matches).length === 0 && (
                                            <li className="px-2 py-1 text-sm text-slate-400">
                                                No station matches.
                                            </li>
                                        )}
                                </ul>
                            </>
                        )}
                    </section>
                    {removed.length > 0 && (
                        <section>
                            <button
                                type="button"
                                className="flex w-full items-center justify-between py-1 text-left font-semibold font-poppins text-slate-400"
                                onClick={() => setShowRemoved(!showRemoved)}
                                aria-expanded={showRemoved}
                            >
                                <span>Removed ({removed.length})</span>
                                <span aria-hidden="true">
                                    {showRemoved ? "▾" : "▸"}
                                </span>
                            </button>
                            {showRemoved && (
                                <>
                                    <ul className="flex flex-col">
                                        {removed.map((station) => (
                                            <StationRow
                                                key={stationId(station)}
                                                station={station}
                                                busy={$isLoading}
                                                action="Restore"
                                                onAction={() =>
                                                    disabledStations.set(
                                                        $disabledStations.filter(
                                                            (id) =>
                                                                id !==
                                                                stationId(
                                                                    station,
                                                                ),
                                                        ),
                                                    )
                                                }
                                            />
                                        ))}
                                    </ul>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-1"
                                        onClick={() => disabledStations.set([])}
                                    >
                                        Restore all
                                    </Button>
                                </>
                            )}
                        </section>
                    )}
                </>
            )}
            <AlertDialog
                open={picking !== null}
                onOpenChange={(open) => !open && setPicking(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Start the end game at{" "}
                            {picking ? label(picking) : ""}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Only its hiding zone stays on the map
                            {$game ? ", for everyone" : ""}. The questions asked
                            so far no longer apply (they stay in the list); new
                            ones narrow the zone down. You can undo this.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (picking) startEndgame(stationPick(picking));
                                setPicking(null);
                            }}
                        >
                            Start the end game
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
