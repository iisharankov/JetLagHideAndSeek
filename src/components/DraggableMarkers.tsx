import { useStore } from "@nanostores/react";
import type { DragEndEvent } from "leaflet";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { Marker } from "react-leaflet";
import { toast } from "react-toastify";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    activeQuestionKey,
    autoSave,
    hiderMode,
    notePins,
    questionModified,
    questions,
    save,
    setHiderPin,
    showHiderPin,
    triggerLocalRefresh,
} from "@/lib/context";
import { gameRole, gameState } from "@/lib/game/session";
import type { ICON_COLORS } from "@/maps/api";
import { hiderIcon, markerIcon } from "@/maps/markerIcon";

import { NotePinMarker } from "./game/NotePins";
import { LatitudeLongitude } from "./LatLngPicker";
import {
    MatchingQuestionComponent,
    MeasuringQuestionComponent,
    RadiusQuestionComponent,
    TentacleQuestionComponent,
    ThermometerQuestionComponent,
} from "./QuestionCards";
import { Button } from "./ui/button";
import { SidebarMenu } from "./ui/sidebar-l";

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
    const $questions = useStore(questions);
    const $hiderMode = useStore(hiderMode);
    const $autoSave = useStore(autoSave);
    const $game = useStore(gameState);
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
                        if (questionKey !== -1) {
                            activeQuestionKey.set(questionKey);
                        }
                        if (!isDragging) {
                            setOpen(true);
                        }
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
                {$questions
                    .filter((q) => q.key === questionKey)
                    .map((q) => {
                        switch (q.id) {
                            case "radius":
                                return (
                                    <RadiusQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            case "tentacles":
                                return (
                                    <TentacleQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            case "thermometer":
                                return (
                                    <ThermometerQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            case "matching":
                                return (
                                    <MatchingQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            case "measuring":
                                return (
                                    <MeasuringQuestionComponent
                                        key={q.key}
                                        data={q.data}
                                        questionKey={q.key}
                                        sub={sub}
                                    />
                                );
                            default:
                                return null;
                        }
                    })}
                {questionKey === -1 && !$game && (
                    <Button // If it's the hider mode marker
                        onClick={() => {
                            hiderMode.set(false);
                        }}
                        variant="destructive"
                        className="font-semibold font-poppins"
                    >
                        Disable
                    </Button>
                )}
                {!$autoSave && (
                    <button
                        onClick={save}
                        className="bg-blue-600 p-2 rounded-md font-semibold font-poppins transition-shadow duration-500"
                    >
                        Save
                    </button>
                )}
            </DialogContent>
        </Dialog>
    );
};

/** Moves the hider pin; it is kept inside the hider's zone. */
const movePin = (latitude: number, longitude: number) => {
    if (setHiderPin(latitude, longitude) === "clamped") {
        toast.info("The pin stays inside your hiding zone.", {
            toastId: "pin-clamped",
        });
    }
};

export const DraggableMarkers = () => {
    useStore(triggerLocalRefresh);
    const $questions = useStore(questions);
    const $hiderMode = useStore(hiderMode);
    const $showHiderPin = useStore(showHiderPin);

    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $notes = useStore(notePins);

    return (
        <Fragment>
            {$notes.map((note) => (
                <NotePinMarker key={note.id} note={note} />
            ))}
            {$hiderMode !== false &&
                $showHiderPin &&
                !($game && $role !== "hider") && (
                    <ColoredMarker
                        color="green"
                        key="hider"
                        sub="Hider Location"
                        questionKey={-1}
                        latitude={$hiderMode.latitude}
                        longitude={$hiderMode.longitude}
                        onChange={(e) => {
                            const { lat, lng } = e.target.getLatLng();
                            movePin(lat, lng);
                        }}
                    />
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
                                    question.data.lat =
                                        e.target.getLatLng().lat;
                                    question.data.lng =
                                        e.target.getLatLng().lng;
                                    questionModified();
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
                                        question.data.latA =
                                            e.target.getLatLng().lat;
                                        question.data.lngA =
                                            e.target.getLatLng().lng;
                                        questionModified();
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
                                        question.data.latB =
                                            e.target.getLatLng().lat;
                                        question.data.lngB =
                                            e.target.getLatLng().lng;
                                        questionModified();
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
