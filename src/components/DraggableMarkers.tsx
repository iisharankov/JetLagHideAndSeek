import { useStore } from "@nanostores/react";
import type { DragEndEvent } from "leaflet";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { Marker, Polyline, Tooltip } from "react-leaflet";
import { toast } from "react-toastify";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    activeQuestionKey,
    hiderMode,
    notePins,
    pinsOnMap,
    questions,
    showQuestion,
    updateQuestion,
} from "@/lib/context";
import { pinShown } from "@/lib/game/drafts";
import { gameState, hiderPhone } from "@/lib/game/session";
import { pinOnMap } from "@/lib/game/sync";
import { endOutside } from "@/lib/game/thermometer";
import {
    hiderPlaced,
    pinLocked,
    setHiderPin,
    showHiderPin,
} from "@/lib/hiderSpot";
import type { ICON_COLORS } from "@/maps/api";
import { hiderIcon, markerIcon, pinIcon } from "@/maps/markerIcon";
import { THERMOMETER_PINS } from "@/maps/questionColors";

import { NotePinMarker } from "./game/NotePins";
import { LatitudeLongitude } from "./LatLngPicker";
import { SidebarContext, SidebarMenu } from "./ui/sidebar-l";

/** A question's pin tapped: its card opens in the sidebar. */
const openCard = (questionKey: number) => {
    showQuestion(questionKey);
    const sidebar = SidebarContext.get();
    if (sidebar.isMobile) sidebar.setOpenMobile(true);
    else sidebar.setOpen(true);
};

let isDragging = false;

const ColoredMarker = ({
    latitude,
    longitude,
    color,
    fill,
    onChange,
    questionKey,
    sub = "",
    draggable = true,
}: {
    onChange: (event: DragEndEvent) => void;
    latitude: number;
    longitude: number;
    color: keyof typeof ICON_COLORS;
    /** A fill of its own instead of `color` (a thermometer's pins). */
    fill?: string;
    questionKey: number;
    sub?: string;
    /** Locked questions keep their pin, but it can't be moved. */
    draggable?: boolean;
}) => {
    const $hiderMode = useStore(hiderMode);
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Marker
                position={[latitude, longitude]}
                icon={
                    questionKey === -1
                        ? hiderIcon()
                        : fill
                          ? pinIcon(fill)
                          : color
                            ? markerIcon(color)
                            : undefined
                }
                title={questionKey === -1 ? "Hider location" : undefined}
                alt={questionKey === -1 ? "Hider location" : "Question"}
                zIndexOffset={questionKey === -1 ? 1000 : 0}
                opacity={draggable ? 1 : 0.75}
                draggable={draggable}
                eventHandlers={{
                    dragstart: () => {
                        isDragging = true;
                        if (questionKey !== -1) {
                            activeQuestionKey.set(questionKey);
                        }
                    },
                    dragend: (x) => {
                        onChange(x);
                        setTimeout(() => {
                            isDragging = false;
                        }, 100);
                    },
                    click: () => {
                        if (isDragging) return;
                        if (questionKey === -1) setOpen(true);
                        else openCard(questionKey);
                    },
                }}
            />
            <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                {questionKey === -1 && $hiderMode !== false && (
                    <>
                        <h2 className="text-center text-2xl font-bold font-poppins">
                            {sub}
                        </h2>
                        <SidebarMenu>
                            <LatitudeLongitude
                                latitude={$hiderMode.latitude}
                                longitude={$hiderMode.longitude}
                                inlineEdit
                                onChange={(latitude, longitude) => {
                                    movePin(
                                        latitude ?? $hiderMode.latitude,
                                        longitude ?? $hiderMode.longitude,
                                    );
                                }}
                                label="Hider Location"
                            />
                        </SidebarMenu>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

/** Moves the hider pin; it is kept inside the hider's zone. */
const movePin = (latitude: number, longitude: number) => {
    if (pinLocked.get()) {
        toast.info(
            "Your pin is fixed: the end game is on at your station, and the seekers must find you there.",
            { toastId: "pin-locked" },
        );
        return;
    }
    if (setHiderPin(latitude, longitude) === "clamped") {
        toast.info("The pin stays inside your hiding zone.", {
            toastId: "pin-clamped",
        });
    }
};

export const DraggableMarkers = () => {
    const $questions = useStore(questions);
    const $pinLocked = useStore(pinLocked);
    const $game = useStore(gameState);
    const $revealed = $game?.revealedPin ?? null;
    // Every question's pin, or only the active question's (round 48).
    const $pins = useStore(pinsOnMap);
    const $active = useStore(activeQuestionKey);
    const $hiderMode = useStore(hiderMode);
    const $hider = useStore(hiderPhone);
    const $showHiderPin = useStore(showHiderPin);
    const $placed = useStore(hiderPlaced);
    const $notes = useStore(notePins);

    return (
        <Fragment>
            {$notes.map((note) => (
                <NotePinMarker key={note.id} note={note} />
            ))}
            {/* Not while picking the station: until the end game the
                answers come from the station, and the pin only matters
                then. */}
            {$hiderMode !== false && $hider && $showHiderPin && $placed && (
                <ColoredMarker
                    color="green"
                    key="hider"
                    sub="Hider Location"
                    questionKey={-1}
                    latitude={$hiderMode.latitude}
                    longitude={$hiderMode.longitude}
                    draggable={!$pinLocked}
                    onChange={(e) => {
                        const { lat, lng } = e.target.getLatLng();
                        movePin(lat, lng);
                    }}
                />
            )}
            {$revealed && (
                <Marker
                    position={[$revealed.latitude, $revealed.longitude]}
                    icon={hiderIcon()}
                    alt="Hider was here"
                    title="The hider was here"
                    zIndexOffset={1000}
                    keyboard={false}
                >
                    <Tooltip>The hider was here</Tooltip>
                </Marker>
            )}
            {$questions.map((question) => {
                if (!question.data) return null;
                if (question.data.hidden) return null;
                if (!pinOnMap(question, $game)) return null;
                if (!pinShown(question.key, $pins, $active)) return null;
                const draggable = question.data.drag;
                if (
                    question.id === "matching" &&
                    question.data.type === "custom-zone"
                )
                    return null;

                switch (question.id) {
                    case "radius":
                    case "tentacles":
                    case "matching":
                    case "measuring":
                        return (
                            <ColoredMarker
                                color={question.data.color}
                                key={question.key}
                                questionKey={question.key}
                                draggable={draggable}
                                latitude={question.data.lat}
                                longitude={question.data.lng}
                                onChange={(e) => {
                                    const { lat, lng } = e.target.getLatLng();
                                    updateQuestion(question.key, { lat, lng });
                                }}
                            />
                        );
                    case "thermometer": {
                        // A game's draft: its planned end stays at least
                        // the distance from the start (round 47).
                        const planning =
                            !!$game &&
                            ($game.questions[String(question.key)]?.state ??
                                "draft") === "draft";
                        const move = (patch: {
                            latA?: number;
                            lngA?: number;
                            latB?: number;
                            lngB?: number;
                        }) => {
                            const next = { ...question.data, ...patch };
                            updateQuestion(question.key, {
                                ...patch,
                                ...(planning ? endOutside(next) : null),
                            });
                        };
                        return (
                            <Fragment key={question.key}>
                                {/* The two ends, joined faintly: they
                                    stay a pair among other questions. */}
                                {question.data.latB !== null &&
                                    question.data.lngB !== null && (
                                        <Polyline
                                            positions={[
                                                [
                                                    question.data.latA,
                                                    question.data.lngA,
                                                ],
                                                [
                                                    question.data.latB,
                                                    question.data.lngB,
                                                ],
                                            ]}
                                            className="thermometer-link"
                                            interactive={false}
                                            pathOptions={{
                                                color: THERMOMETER_PINS.end,
                                                weight: 2,
                                                opacity: 0.55,
                                                dashArray: "3 6",
                                            }}
                                        />
                                    )}
                                <ColoredMarker
                                    color={question.data.colorA}
                                    fill={THERMOMETER_PINS.start}
                                    key={"a" + question.key.toString()}
                                    questionKey={question.key}
                                    draggable={draggable}
                                    sub="Start"
                                    latitude={question.data.latA}
                                    longitude={question.data.lngA}
                                    onChange={(e) => {
                                        const { lat, lng } =
                                            e.target.getLatLng();
                                        move({ latA: lat, lngA: lng });
                                    }}
                                />
                                {/* No end until a shared game's
                                    thermometer is asked. */}
                                {question.data.latB !== null &&
                                    question.data.lngB !== null && (
                                        <ColoredMarker
                                            color={question.data.colorB}
                                            fill={THERMOMETER_PINS.end}
                                            key={"b" + question.key.toString()}
                                            questionKey={question.key}
                                            draggable={draggable}
                                            sub="End"
                                            latitude={question.data.latB}
                                            longitude={question.data.lngB}
                                            onChange={(e) => {
                                                const { lat, lng } =
                                                    e.target.getLatLng();
                                                move({ latB: lat, lngB: lng });
                                            }}
                                        />
                                    )}
                            </Fragment>
                        );
                    }
                    default:
                        return null;
                }
            })}
        </Fragment>
    );
};
