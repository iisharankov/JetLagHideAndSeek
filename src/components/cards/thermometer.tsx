import { useStore } from "@nanostores/react";
import { point } from "@turf/turf";
import { useEffect, useState } from "react";

import { LatitudeLongitude } from "@/components/LatLngPicker";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import {
    gameSettings,
    hiderMode,
    isLoading,
    type QuestionPatch,
    questions,
    updateQuestion,
} from "@/lib/context";
import { askedBefore, thermometerQuestion } from "@/lib/game/newQuestion";
import { gameRole, gameState } from "@/lib/game/session";
import { kmText } from "@/lib/game/thermometer";
import { currentPosition, recentPosition } from "@/lib/geolocation";
import { cn } from "@/lib/utils";
import { arcDistance } from "@/maps/geo-utils";
import type { ThermometerQuestion } from "@/maps/schema";

import { QuestionCard, useFrozen, useGameQuestionState } from "./base";
import { AnswerToggle, DistancePicker } from "./parts";

const coordinates = (lat: number, lng: number) =>
    `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

/**
 * A shared game's thermometer before it's asked (the rulebook's way): the
 * distance to travel, and where it starts (where the seekers are). The
 * buttons that start, ask and call it off are in the game bar below
 * (`ThermometerBar`).
 */
const Travel = ({
    data,
    questionKey,
    armed,
}: {
    data: ThermometerQuestion;
    questionKey: number;
    armed: boolean;
}) => {
    const $game = useStore(gameState);
    const $settings = useStore(gameSettings);
    const $role = useStore(gameRole);
    const $isLoading = useStore(isLoading);
    useStore(currentPosition);
    const set = (patch: QuestionPatch) => updateQuestion(questionKey, patch);
    const settings = $game?.settings ?? $settings;
    const distances = settings.thermometerKm;
    const locked = !data.drag || $isLoading || $role === "hider";
    const here = recentPosition();

    if (armed) {
        return (
            <SidebarMenuItem>
                <div
                    className={cn(MENU_ITEM_CLASSNAME, "text-sm")}
                    data-testid="thermometer-fact"
                >
                    {/* A paragraph, not a span: the row cuts a last span short. */}
                    <p>
                        <strong>{kmText(data.distanceKm)} km</strong> from the
                        Start pin ({coordinates(data.latA, data.lngA)}), as the
                        crow flies.
                    </p>
                </div>
            </SidebarMenuItem>
        );
    }
    return (
        <>
            <SidebarMenuItem>
                <p
                    className={cn(
                        MENU_ITEM_CLASSNAME,
                        "text-xs text-muted-foreground",
                    )}
                >
                    Starts where you are. Travel the distance, then ask.
                </p>
            </SidebarMenuItem>
            <DistancePicker
                value={data.distanceKm}
                options={distances}
                disabled={locked}
                asked={(km) =>
                    askedBefore(
                        $game,
                        thermometerQuestion(
                            { lat: data.latA, lng: data.lngA },
                            km,
                            true,
                        ),
                    )
                }
                onChange={(km) => set({ distanceKm: km })}
            />
            <SidebarMenuItem>
                <div
                    className={cn(
                        MENU_ITEM_CLASSNAME,
                        "flex justify-between gap-2 text-sm",
                    )}
                    data-testid="thermometer-start"
                >
                    <span>Start</span>
                    <p className="text-right text-muted-foreground">
                        {here
                            ? `${coordinates(here.latitude, here.longitude)}${
                                  here.accuracy
                                      ? ` · ±${Math.round(here.accuracy)} m`
                                      : ""
                              }`
                            : coordinates(data.latA, data.lngA)}
                    </p>
                </div>
            </SidebarMenuItem>
            {!here && $role === "seeker" && (
                <SidebarMenuItem>
                    <p
                        className={cn(
                            MENU_ITEM_CLASSNAME,
                            "text-xs text-amber-300",
                        )}
                        data-testid="thermometer-no-fix"
                    >
                        No position yet: it would start from its pin on the map
                        (drag it to where you are). Turn location on to start
                        where you are.
                    </p>
                </SidebarMenuItem>
            )}
        </>
    );
};

export const ThermometerQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: ThermometerQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    const $hiderMode = useStore(hiderMode);
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const $game = useStore(gameState);
    const state = useGameQuestionState(questionKey);
    const set = (patch: QuestionPatch) => updateQuestion(questionKey, patch);
    const frozen = useFrozen(questionKey);
    // In a shared game a thermometer is started, travelled, then asked;
    // until it's asked there's no end pin and no result to choose.
    const travelling =
        $game !== null &&
        !data.research &&
        (state === null || state === "draft" || state === "armed");

    // Metric only.
    const DISTANCE_UNIT = "kilometers";

    const label = `Thermometer
    ${
        $questions
            .filter((q) => q.id === "thermometer")
            .map((q) => q.key)
            .indexOf(questionKey) + 1
    }`;

    const hasEnd = data.latB !== null && data.lngB !== null;
    const [distanceValue, setDistanceValue] = useState<number | null>(null);

    useEffect(() => {
        if (data.latB === null || data.lngB === null) {
            setDistanceValue(null);
            return;
        }

        let cancelled = false;
        arcDistance(
            point([data.lngA, data.latA]),
            point([data.lngB, data.latB]),
            DISTANCE_UNIT,
        ).then((distance) => {
            if (!cancelled) setDistanceValue(distance);
        });

        return () => {
            cancelled = true;
        };
    }, [data.latA, data.lngA, data.latB, data.lngB, DISTANCE_UNIT]);

    const unitLabel = "km";

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
        >
            {travelling ? (
                <Travel
                    data={data}
                    questionKey={questionKey}
                    armed={state === "armed"}
                />
            ) : (
                <>
                    <LatitudeLongitude
                        latitude={data.latA}
                        longitude={data.lngA}
                        label="Start"
                        colorName={data.colorA}
                        onChange={(lat, lng) =>
                            set({
                                latA: lat ?? data.latA,
                                lngA: lng ?? data.lngA,
                            })
                        }
                        disabled={!data.drag || $isLoading}
                        readOnly={frozen}
                    />

                    {data.latB !== null && data.lngB !== null && (
                        <LatitudeLongitude
                            latitude={data.latB}
                            longitude={data.lngB}
                            label="End"
                            colorName={data.colorB}
                            onChange={(lat, lng) =>
                                set({
                                    latB: lat ?? data.latB,
                                    lngB: lng ?? data.lngB,
                                })
                            }
                            disabled={!data.drag || $isLoading}
                            readOnly={frozen}
                        />
                    )}

                    {hasEnd && distanceValue !== null && (
                        <div className="px-2 text-sm text-muted-foreground">
                            Distance:{" "}
                            <span className="font-medium text-foreground">
                                {distanceValue.toFixed(2)} {unitLabel}
                            </span>
                        </div>
                    )}

                    {!frozen && (
                        <AnswerToggle
                            value={data.warmer ? "warmer" : "colder"}
                            options={[
                                { value: "warmer", label: "Hotter" },
                                { value: "colder", label: "Colder" },
                            ]}
                            onChange={(value) =>
                                set({ warmer: value === "warmer" })
                            }
                            disabled={!!$hiderMode || !data.drag || $isLoading}
                        />
                    )}
                </>
            )}
        </QuestionCard>
    );
};
