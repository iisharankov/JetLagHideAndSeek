import { useStore } from "@nanostores/react";
import type { DragEndEvent } from "leaflet";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { Marker, Tooltip } from "react-leaflet";
import { toast } from "react-toastify";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    activeQuestionKey,
    hiderMode,
    notePins,
    questions,
    showQuestion,
    updateQuestion,
} from "@/lib/context";
import { gameState, hiderPhone } from "@/lib/game/session";
import {
    hiderPlaced,
    pinLocked,
    setHiderPin,
    showHiderPin,
} from "@/lib/hiderSpot";
import type { ICON_COLORS } from "@/maps/api";
import { hiderIcon, markerIcon } from "@/maps/markerIcon";

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
    onChange,
    questionKey,
    sub = "",
    draggable = true,
}: {
    onChange: (event: DragEndEvent) => void;
    latitude: number;
    longitude: number;
    color: keyof typeof ICON_COLORS;
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
    const $revealed = useStore(gameState)?.revealedPin ?? null;
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
                    case "thermometer":
                        return (
                            <Fragment key={question.key}>
                                <ColoredMarker
                                    color={question.data.colorA}
                                    key={"a" + question.key.toString()}
                                    questionKey={question.key}
                                    draggable={draggable}
                                    sub="Start"
                                    latitude={question.data.latA}
                                    longitude={question.data.lngA}
                                    onChange={(e) => {
                                        const { lat, lng } =
                                            e.target.getLatLng();
                                        updateQuestion(question.key, {
                                            latA: lat,
                                            lngA: lng,
                                        });
                                    }}
                                />
                                <ColoredMarker
                                    color={question.data.colorB}
                                    key={"b" + question.key.toString()}
                                    questionKey={question.key}
                                    draggable={draggable}
                                    sub="End"
                                    latitude={question.data.latB}
                                    longitude={question.data.lngB}
                                    onChange={(e) => {
                                        const { lat, lng } =
                                            e.target.getLatLng();
                                        updateQuestion(question.key, {
                                            latB: lat,
                                            lngB: lng,
                                        });
                                    }}
                                />
                            </Fragment>
                        );
                    default:
                        return null;
                }
            })}
        </Fragment>
    );
};
