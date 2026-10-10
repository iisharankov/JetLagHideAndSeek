import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import React from "react";
import { toast } from "react-toastify";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar-l";
import {
    addQuestion,
    defaultCustomQuestions,
    followMe,
    isLoading,
    leafletMapContext,
} from "@/lib/context";
import { disabledCategory, kindRefusal } from "@/lib/game/curseRules";
import { serverNow } from "@/lib/game/serverTime";
import { gameState } from "@/lib/game/session";
import { tentacleRadiusKm } from "@/lib/game/settings";
import { newRadiusQuestion } from "@/lib/gameSettings";
import { currentPosition, recentPosition } from "@/lib/geolocation";

/**
 * Where a new question starts: where the phone is, when "Follow me" is on
 * and the position is fresh; otherwise the middle of the map.
 */
const startPoint = () => {
    const map = leafletMapContext.get();
    if (!map) return null;
    const here = recentPosition();
    if (here) return { lat: here.latitude, lng: here.longitude };
    const center = map.getCenter();
    return { lat: center.lat, lng: center.lng };
};

export const AddQuestionDialog = ({
    children,
    research = false,
}: {
    children: React.ReactNode;
    /** The hider's own probe of a hiding spot: never shared. */
    research?: boolean;
}) => {
    const add = (question: Parameters<typeof addQuestion>[0]) =>
        addQuestion(
            research
                ? ({
                      ...question,
                      data: { ...question.data, research: true },
                  } as typeof question)
                : question,
        );
    const $isLoading = useStore(isLoading);
    const $followMe = useStore(followMe);
    const $here = useStore(currentPosition);
    const $game = useStore(gameState);
    const [open, setOpen] = React.useState(false);
    const fromGps = !!$here && !!recentPosition();
    // A Spotty Memory disables a whole category; a Drained Brain may have
    // taken the thermometer away.
    const disabled = $game ? disabledCategory($game, serverNow()) : null;
    const refusal = (category: string) =>
        !$game || research
            ? null
            : category === "thermometer"
              ? kindRefusal($game, "thermometer", serverNow())
              : disabled === category
                ? `${disabled.charAt(0).toUpperCase()}${disabled.slice(1)} questions are disabled right now (Curse of the Spotty Memory).`
                : null;

    const runAddRadius = () => {
        const center = startPoint();
        if (!center) return false;
        add(newRadiusQuestion(center.lat, center.lng));
        return true;
    };

    const runAddThermometer = () => {
        const center = startPoint();
        if (!center) return false;
        const destination = turf.destination([center.lng, center.lat], 5, 90, {
            units: "miles",
        });

        add({
            id: "thermometer",
            data: {
                latA: center.lat,
                lngB: center.lng,
                latB: destination.geometry.coordinates[1],
                lngA: destination.geometry.coordinates[0],
            },
        });

        return true;
    };

    const runAddTentacles = () => {
        const center = startPoint();
        if (!center) return false;
        add({
            id: "tentacles",
            data: defaultCustomQuestions.get()
                ? {
                      lat: center.lat,
                      lng: center.lng,
                      locationType: "custom",
                      places: [],
                      radius: tentacleRadiusKm("theme_park"),
                      unit: "kilometers",
                  }
                : {
                      lat: center.lat,
                      lng: center.lng,
                      radius: tentacleRadiusKm("theme_park"),
                      unit: "kilometers",
                  },
        });
        return true;
    };

    const runAddMatching = () => {
        const center = startPoint();
        if (!center) return false;
        add({
            id: "matching",
            data: defaultCustomQuestions.get()
                ? { lat: center.lat, lng: center.lng, type: "custom-points" }
                : { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runAddMeasuring = () => {
        const center = startPoint();
        if (!center) return false;
        add({
            id: "measuring",
            data: defaultCustomQuestions.get()
                ? { lat: center.lat, lng: center.lng, type: "custom-measure" }
                : { lat: center.lat, lng: center.lng },
        });
        return true;
    };

    const runPasteQuestion = async () => {
        if (!navigator || !navigator.clipboard) {
            toast.error("Clipboard API not supported in your browser");
            return false;
        }

        try {
            await toast.promise(
                navigator.clipboard.readText().then((text) => {
                    const parsed = JSON.parse(text);
                    const question =
                        parsed &&
                        typeof parsed === "object" &&
                        !Array.isArray(parsed)
                            ? { ...parsed, key: Math.random() }
                            : parsed;

                    return add(question);
                }),
                {
                    pending: "Reading from clipboard",
                    success: "Question added from clipboard!",
                    error: "No valid question found in clipboard",
                },
                { autoClose: 1000 },
            );

            return true;
        } catch {
            return false;
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogTitle>
                    {research ? "Add a research question" : "Add Question"}
                </DialogTitle>
                <DialogDescription>
                    {research
                        ? "Only on your phone, answered from the station you tapped (or your pin)."
                        : "Select which question type you would like to add."}
                </DialogDescription>
                <p className="text-xs text-slate-400" data-testid="start-point">
                    {fromGps
                        ? "It starts where you are (Follow me is on)."
                        : $followMe
                          ? "It starts at the middle of the map (no position fix yet)."
                          : "It starts at the middle of the map. Turn on Follow me (Menu → Settings → Map) to start it where you are."}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SidebarMenuButton
                        onClick={() => {
                            if (runAddRadius()) setOpen(false);
                        }}
                        disabled={$isLoading || refusal("radius") !== null}
                        title={refusal("radius") ?? undefined}
                    >
                        Add Radius
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={() => {
                            if (runAddThermometer()) setOpen(false);
                        }}
                        disabled={$isLoading || refusal("thermometer") !== null}
                        title={refusal("thermometer") ?? undefined}
                    >
                        Add Thermometer
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={() => {
                            if (runAddTentacles()) setOpen(false);
                        }}
                        disabled={$isLoading || refusal("tentacles") !== null}
                        title={refusal("tentacles") ?? undefined}
                    >
                        Add Tentacles
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={() => {
                            if (runAddMatching()) setOpen(false);
                        }}
                        disabled={$isLoading || refusal("matching") !== null}
                        title={refusal("matching") ?? undefined}
                    >
                        Add Matching
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={() => {
                            if (runAddMeasuring()) setOpen(false);
                        }}
                        disabled={$isLoading || refusal("measuring") !== null}
                        title={refusal("measuring") ?? undefined}
                    >
                        Add Measuring
                    </SidebarMenuButton>
                    <SidebarMenuButton
                        onClick={async () => {
                            const ok = await runPasteQuestion();
                            if (ok) setOpen(false);
                        }}
                        disabled={$isLoading}
                    >
                        Paste Question
                    </SidebarMenuButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
