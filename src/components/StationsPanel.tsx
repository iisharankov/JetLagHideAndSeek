import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { useEffect, useState } from "react";

import {
    animateMapMovements,
    chosenStation,
    disabledStations,
    displayHidingZones,
    displayHidingZonesStyle,
    gameSettings,
    hidingRadius,
    hidingRadiusUnits,
    highlightedStation,
    isLoading,
    leafletMapContext,
    trainStations,
} from "@/lib/context";
import { gameRole, gameState } from "@/lib/game/session";
import { describeStations } from "@/lib/game/settings";
import type { StationCircle } from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import { stationId } from "@/maps/hidingZoneLayer";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";

const label = (station: StationCircle) =>
    extractStationLabel(station.properties) as string;

/** Shows a station's zone on the map. */
const goTo = (station: StationCircle) => {
    const map = leafletMapContext.get();
    if (!map) return;
    const [west, south, east, north] = turf.bbox(station);
    const bounds: [[number, number], [number, number]] = [
        [south, west],
        [north, east],
    ];
    if (animateMapMovements.get()) map.flyToBounds(bounds);
    else map.fitBounds(bounds);
};

const StationRow = ({
    station,
    pickLabel,
    picked,
    busy,
    action,
    onAction,
}: {
    station: StationCircle;
    pickLabel: string;
    picked: boolean;
    busy: boolean;
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
            onClick={() => goTo(station)}
        >
            {label(station)}
        </button>
        <button
            type="button"
            className="rounded-md bg-slate-600 px-1.5 py-0.5 text-xs disabled:opacity-50"
            disabled={busy || picked}
            onClick={() => {
                chosenStation.set(stationId(station));
                goTo(station);
            }}
        >
            {picked ? "Picked" : pickLabel}
        </button>
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

/** Sidebar → Stations: the hiding zones, and the stations still in play. */
export const StationsPanel = () => {
    const $displayHidingZones = useStore(displayHidingZones);
    const $style = useStore(displayHidingZonesStyle);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const $gameSettings = useStore(gameSettings);
    const $isLoading = useStore(isLoading);
    const stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const $chosen = useStore(chosenStation);
    const $highlighted = useStore(highlightedStation);
    const $role = useStore(gameRole);
    const $game = useStore(gameState);
    const [search, setSearch] = useState("");
    const [showLeft, setShowLeft] = useState(true);
    const [showRemoved, setShowRemoved] = useState(false);

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

    const mine = $role === "hider";
    const pickLabel = mine ? "Mine" : "Pick";
    const matches = (station: StationCircle) =>
        search.trim() === "" ||
        label(station).toLowerCase().includes(search.trim().toLowerCase());
    const left = stations.filter(
        (station) => !$disabledStations.includes(stationId(station)),
    );
    const removed = stations.filter((station) =>
        $disabledStations.includes(stationId(station)),
    );
    const picked = stations.find((station) => stationId(station) === $chosen);

    return (
        <div className="flex flex-col gap-2 p-2 text-sm">
            <ToggleCard
                title="Show hiding zones"
                description="A green circle around every station the answers haven't ruled out. A station is in or out by its own position; the hider may be anywhere in its circle."
                checked={$displayHidingZones}
                onCheckedChange={displayHidingZones.set}
                disabled={$isLoading}
            />
            {$displayHidingZones && (
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
                    {$chosen ? (
                        <section
                            className="flex flex-col gap-1 rounded-md border border-red-500/60 p-2"
                            data-testid="chosen-station"
                        >
                            {picked ? (
                                <p>
                                    {mine
                                        ? "Your station: "
                                        : "The hider's station: "}
                                    <strong>{label(picked)}</strong>
                                    {mine
                                        ? ". The red circle is where you may be."
                                        : " (the red circle)."}
                                    {!mine &&
                                        $game &&
                                        " All the seekers see this."}
                                </p>
                            ) : (
                                <p className="text-amber-400">
                                    {mine
                                        ? "Your station"
                                        : "The picked station"}{" "}
                                    isn&apos;t in play any more: an answer rules
                                    it out, or it isn&apos;t one of the stations
                                    in the game. Check the answers.
                                </p>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className="self-start"
                                onClick={() => chosenStation.set("")}
                            >
                                Clear
                            </Button>
                        </section>
                    ) : (
                        <p className="text-xs text-slate-400">
                            {mine
                                ? "Pick your station below: its circle is drawn in red, the boundary you stay in. It stays on your phone."
                                : `Once you know the hider's station, pick it below: its whole zone is drawn in red${
                                      $game ? " for all the seekers" : ""
                                  }.`}
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
                                            pickLabel={pickLabel}
                                            picked={
                                                stationId(station) === $chosen
                                            }
                                            busy={$isLoading}
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
                                                pickLabel={pickLabel}
                                                picked={
                                                    stationId(station) ===
                                                    $chosen
                                                }
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
        </div>
    );
};
