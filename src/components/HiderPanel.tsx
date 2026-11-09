import { useStore } from "@nanostores/react";
import { useState } from "react";
import { toast } from "react-toastify";

import { ScreenHeader } from "@/components/ask/QuestionTypes";
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
import { Row, SwitchRow } from "@/components/ui/row";
import { SidebarContext } from "@/components/ui/sidebar-l";
import { useTick } from "@/hooks/useTick";
import {
    endgame,
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
    isLoading,
    leafletMapContext,
    trainStations,
} from "@/lib/context";
import { ago } from "@/lib/format";
import { formatDuration } from "@/lib/game/clock";
import {
    endEndgame,
    pendingEndgame,
    startEndgameSoon,
    undoEndgameSoon,
} from "@/lib/game/endgame";
import { seekerPositions } from "@/lib/game/positions";
import { serverNow } from "@/lib/game/serverTime";
import { gameState, myPlayerId, sendOp } from "@/lib/game/session";
import { describeGeoError, locate } from "@/lib/geolocation";
import {
    chosenStation,
    confirmHiderStation,
    hiderChoosing,
    hiderShowAll,
    pendingStation,
    pinAtEdge,
    pinFollowsGps,
    pinLocked,
    setHiderPin,
    showHiderPin,
} from "@/lib/hiderSpot";
import { pushedScreen, pushScreen } from "@/lib/screens";
import type { StationCircle } from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import {
    goToPick,
    goToStation,
    pickStation,
    stationId,
} from "@/maps/hidingZoneLayer";

import { Button } from "./ui/button";

const label = (station: StationCircle) =>
    extractStationLabel(station.properties) as string;

/**
 * Sidebar → Hider (the hider's phone): picking the station, then only the
 * hider's own zone, the pin, and what the end game changes.
 */
export const HiderPanel = () => {
    const $chosen = useStore(chosenStation);
    const $pending = useStore(pendingStation);
    const $choosing = useStore(hiderChoosing);
    const $showAll = useStore(hiderShowAll);
    const $showPin = useStore(showHiderPin);
    const $pin = useStore(hiderMode);
    const $pinLocked = useStore(pinLocked);
    const $pinFollows = useStore(pinFollowsGps);
    const $atEdge = useStore(pinAtEdge);
    const $endgame = useStore(endgame);
    const $game = useStore(gameState);
    const $me = useStore(myPlayerId);
    useTick(!!$game?.move);
    const $isLoading = useStore(isLoading);
    const $screen = useStore(pushedScreen);
    const $positions = useStore(seekerPositions);
    const $pendingEndgame = useStore(pendingEndgame);
    const [confirmEndgame, setConfirmEndgame] = useState(false);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const stations = useStore(trainStations);
    const radiusKm =
        $hidingRadiusUnits === "meters" ? $hidingRadius / 1000 : $hidingRadius;
    const radius =
        radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm} km`;

    // Picking: with no station yet, or changing it alone or during a Move.
    // In a shared game the station is set for the round once the clock
    // goes, whatever a phone joining as the hider thinks.
    const choosing = !$chosen || ($choosing && (!$game || !!$game.move));
    const driver = $game?.hider?.pinDriver;
    const driverName =
        driver && driver !== $me
            ? ($game?.players?.[driver]?.name ?? "Another phone")
            : null;

    if (choosing) {
        return (
            <div
                className="flex flex-col gap-2 p-2 text-sm"
                data-testid="hider-panel"
            >
                <p
                    className="rounded-md bg-yellow-500/15 p-2"
                    data-tutorial-id="hider-pick"
                >
                    <strong>Pick your station.</strong> Every station is on the
                    map. Tap yours, on the map or in the list: its hiding zone (
                    {radius} around it) shows in red.
                </p>
                {$pending && (
                    <p data-testid="hider-station">
                        Picked: <strong>{$pending.name}</strong> (tap Done to
                        make it yours)
                    </p>
                )}
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
                                disabled={stationId(station) === $pending?.id}
                                onClick={() => pickStation(station)}
                            >
                                {stationId(station) === $pending?.id
                                    ? "Picked"
                                    : "Mine"}
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="sticky bottom-0 bg-sidebar py-2">
                    <Button
                        className="h-12 w-full text-base font-semibold"
                        disabled={!$pending}
                        onClick={() => {
                            // Confirmed: the seekers hear that the hider is in
                            // place (not where), and the clock starts.
                            const station = confirmHiderStation();
                            if (!station) return;
                            hiderChoosing.set(false);
                            goToPick(station);
                            if ($game) {
                                void sendOp({ type: "hiderReady", station });
                            }
                            toast.success(
                                `Your station is ${station.name}. The red circle is your hiding zone.`,
                            );
                        }}
                        data-testid="hider-done"
                    >
                        Done
                    </Button>
                </div>
            </div>
        );
    }

    if ($screen?.kind === "seekers") return <SeekersScreen />;

    const seekers = $positions.filter((p) => p.name);
    const seekersLine =
        seekers.length === 0
            ? "None sharing their location yet"
            : seekers
                  .map((p) => `${p.name} · ${ago(p.at, serverNow())}`)
                  .join(", ");

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
            {$pinLocked && (
                <p
                    className="rounded-md border border-amber-500/60 bg-amber-950/30 p-2 text-xs"
                    data-testid="pin-locked"
                >
                    <strong>Your pin is fixed.</strong> The end game is on at
                    your station: the seekers must find you exactly where the
                    pin is.
                </p>
            )}
            {$endgame && (
                <section
                    className="rounded-md border border-amber-500/60 bg-amber-950/30 p-2"
                    data-testid="hider-endgame"
                >
                    <p>
                        <strong>End game.</strong>{" "}
                        {$endgame.byHider ? (
                            <>
                                You started it: the seekers are in your zone.
                                Stay where you are; your answers now come from
                                your pin.
                            </>
                        ) : (
                            <>
                                The seekers picked{" "}
                                <strong>{$endgame.station.name}</strong>
                                {$endgame.station.id === $chosen.id
                                    ? ": your station"
                                    : " (not your station)"}
                                . Your answers now come from your pin: put it
                                exactly where you are.
                            </>
                        )}
                    </p>
                    {$endgame.byHider && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="mt-1"
                            onClick={endEndgame}
                        >
                            Started by mistake? Undo
                        </Button>
                    )}
                </section>
            )}
            <Row
                icon="🚉"
                title={
                    <span data-testid="hider-station">
                        Your station: <strong>{$chosen.name}</strong>
                    </span>
                }
                sub={
                    !$game || $game.move ? (
                        `${radius} zone`
                    ) : (
                        <span data-testid="station-locked">
                            {radius} zone · set for this round (only Move
                            changes it)
                        </span>
                    )
                }
                right={
                    !$game || $game.move ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => hiderChoosing.set(true)}
                        >
                            Change
                        </Button>
                    ) : undefined
                }
            />
            {!$pinLocked && (
                <SwitchRow
                    icon="📍"
                    title="Pin follows GPS"
                    sub="Inside your zone, while this app is open. It matters from the end game on: keep it on."
                    checked={$pinFollows}
                    onCheckedChange={(on) => {
                        if (on) showHiderPin.set(true);
                        pinFollowsGps.set(on);
                    }}
                    tutorialId="pin-follows-gps"
                />
            )}
            {$game && driver && !$pinLocked && (
                <p
                    className={
                        driverName && $pinFollows
                            ? "px-1 text-xs text-amber-300"
                            : "px-1 text-xs text-slate-400"
                    }
                    data-testid="pin-driver"
                >
                    {driverName
                        ? $pinFollows
                            ? `${driverName}'s phone is moving the pin: this one stops following in half a minute.`
                            : `${driverName}'s phone moved the pin last.`
                        : $pinFollows
                          ? "The pin follows this phone."
                          : "This phone moved the pin last."}
                </p>
            )}
            {$pinFollows && $atEdge && !$pinLocked && (
                <p
                    className="px-1 text-xs text-amber-300"
                    data-testid="pin-at-edge"
                >
                    You&apos;re outside your zone: the pin waits at its edge.
                </p>
            )}
            {$game && (
                <Row
                    icon="👀"
                    title="Seekers on the map"
                    sub={seekersLine}
                    chevron
                    onClick={() =>
                        pushScreen({ tab: "stations", kind: "seekers" })
                    }
                    data-testid="hider-seekers"
                />
            )}
            <SwitchRow
                icon="🗺️"
                title="Show all stations left"
                sub="What the seekers see: every station the answers haven't ruled out."
                checked={$showAll}
                onCheckedChange={hiderShowAll.set}
            />
            <SwitchRow
                icon="📌"
                title="Show my pin"
                sub={
                    $pinLocked
                        ? "Where you must be found."
                        : "Where you really are, inside your zone. Drag it, or use GPS."
                }
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
                        disabled={$isLoading || $pinLocked}
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
            <p className="px-1 text-xs text-slate-400">
                Answers come from your station until the end game, then from
                your pin.
            </p>
            {!$endgame && $game && (
                <Row
                    icon="🏁"
                    title="Start the end game"
                    sub="Seekers in your zone, off transport · confirm, then 5 s to undo"
                    chevron
                    className="border-red-500/70"
                    onClick={() => setConfirmEndgame(true)}
                    data-testid="hider-start-endgame"
                />
            )}
            {!$game && (
                <p className="px-1 text-xs text-slate-400">
                    Playing alone: the seekers&apos; pick (Stations tab on their
                    phones) starts the end game in a shared game.
                </p>
            )}
            <AlertDialog open={confirmEndgame} onOpenChange={setConfirmEndgame}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Start the end game?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The seekers see your zone. Only when they are in it
                            and off transport: you stay where you are, and your
                            pin is fixed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => startEndgameSoon($chosen)}
                        >
                            Start it
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {$pendingEndgame && <EndgameCountdown />}
        </div>
    );
};

/** "Starting the end game… 4 · Undo": the 5 s before it's sent. */
const EndgameCountdown = () => {
    const pending = useStore(pendingEndgame);
    useTick(!!pending, 250);
    if (!pending) return null;
    const left = Math.max(0, Math.ceil((pending.endsAt - Date.now()) / 1000));
    return (
        <div
            className="sticky bottom-0 flex items-center gap-2 rounded-xl border border-amber-500 bg-amber-950 p-3 text-amber-100"
            role="status"
            data-testid="endgame-countdown"
        >
            <span className="flex-1">
                Starting the end game… <strong>{left}</strong>
            </span>
            <Button variant="outline" onClick={undoEndgameSoon}>
                Undo
            </Button>
        </div>
    );
};

/** Hider → Seekers on the map: who, when last heard, and where. */
const SeekersScreen = () => {
    const positions = useStore(seekerPositions);
    const { isMobile, setOpenMobile } = useStore(SidebarContext);
    useTick(true, 15_000);
    return (
        <div className="flex flex-col gap-2 pb-3" data-testid="seekers-screen">
            <ScreenHeader title="Seekers on the map" />
            {positions.length === 0 && (
                <p className="px-3 text-sm text-slate-400">
                    No seeker shares their location yet. They turn on Follow me
                    (GPS) in the Menu, under Settings.
                </p>
            )}
            <ul className="flex flex-col gap-2 px-2">
                {positions.map((position) => (
                    <li key={position.playerId}>
                        <Row
                            icon="🧭"
                            title={position.name}
                            sub={`${ago(position.at, serverNow())}${
                                position.accuracy
                                    ? ` · ±${Math.round(position.accuracy)} m`
                                    : ""
                            }`}
                            chevron
                            onClick={() => {
                                leafletMapContext
                                    .get()
                                    ?.flyTo(
                                        [position.latitude, position.longitude],
                                        15,
                                    );
                                if (isMobile) setOpenMobile(false);
                            }}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
};
