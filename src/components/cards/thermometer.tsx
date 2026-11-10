import { useStore } from "@nanostores/react";
import { point } from "@turf/turf";
import { LocateFixed, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { LatitudeLongitude } from "@/components/LatLngPicker";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { summaryTitle } from "@/lib/cardText";
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
import type { Question, ThermometerQuestion } from "@/maps/schema";

import { QuestionCard, useFrozen, useGameQuestionState } from "./base";
import { type CardParts, FixedRow, LocationButton } from "./layout";
import { DistancePicker } from "./parts";

const coordinates = (lat: number, lng: number) =>
    `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

/** Where a game's thermometer starts: where you are, or its pin. */
const StartShown = ({
    data,
    look,
}: {
    data: ThermometerQuestion;
    look: "plain" | "token";
}) => {
    useStore(currentPosition);
    const here = recentPosition();
    const Icon = here ? LocateFixed : MapPin;
    if (look === "token") return null;
    return (
        <div
            className="flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-slate-600 px-3"
            data-testid="thermometer-start"
        >
            <Icon className="h-5 w-5 shrink-0 text-violet-300" aria-hidden />
            <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-base font-semibold">
                    {here ? "Me · GPS" : "Pin"}
                </span>
                <span className="block truncate text-xs text-slate-400 tabular-nums">
                    {here
                        ? here.accuracy
                            ? `±${Math.round(here.accuracy)} m`
                            : coordinates(here.latitude, here.longitude)
                        : `${data.latA.toFixed(4)}, ${data.lngA.toFixed(4)}`}
                </span>
            </span>
        </div>
    );
};

/**
 * A shared game's thermometer before it's started (the rulebook's way):
 * the distance to travel, and where it starts (where the seekers are).
 * Start, then Ask, are the card's big button (`ThermometerBar`).
 */
const useTravelParts = (
    data: ThermometerQuestion,
    questionKey: number,
): CardParts => {
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
    return {
        first: {
            label: "Distance",
            render: (look) => (
                <DistancePicker
                    look={look}
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
            ),
        },
        location: {
            label: "Start",
            render: (look) => <StartShown data={data} look={look} />,
        },
        sentence: (first) => <>After traveling {first}: hotter or colder?</>,
        summary: {
            title: summaryTitle(
                { id: "thermometer", data } as unknown as Question,
                "me",
            ),
            sub: here
                ? `Starts where you are${here.accuracy ? ` · ±${Math.round(here.accuracy)} m` : ""}`
                : "Starts at its pin (no position yet)",
        },
        guess: null,
        extra: (
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
                {!here && $role === "seeker" && (
                    <SidebarMenuItem>
                        <p
                            className={cn(
                                MENU_ITEM_CLASSNAME,
                                "text-xs text-amber-300",
                            )}
                            data-testid="thermometer-no-fix"
                        >
                            No position yet: it would start from its pin on the
                            map (drag it to where you are). Turn location on to
                            start where you are.
                        </p>
                    </SidebarMenuItem>
                )}
            </>
        ),
    };
};

/** Started: what's being travelled, fixed. */
const Travelling = ({ data }: { data: ThermometerQuestion }) => (
    <FixedRow
        first={`${kmText(data.distanceKm)} km`}
        testId="thermometer-fact"
        place={{ lat: data.latA, lng: data.lngA, label: "Start" }}
    />
);

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
    const travelParts = useTravelParts(data, questionKey);
    const locked = !data.drag || $isLoading;
    const distanceLine = hasEnd && distanceValue !== null && (
        <div className="px-3 text-sm text-muted-foreground">
            Distance:{" "}
            <span className="font-medium text-foreground">
                {distanceValue.toFixed(2)} {unitLabel}
            </span>
        </div>
    );
    // Alone (or the hider's research): the two ends to drag, and the answer.
    const endsParts: CardParts = {
        first: {
            label: "Start",
            render: (look) => (
                <LocationButton
                    look={look}
                    label="Start"
                    lat={data.latA}
                    lng={data.lngA}
                    colorName={data.colorA}
                    disabled={locked}
                    onChange={(lat, lng) =>
                        set({ latA: lat ?? data.latA, lngA: lng ?? data.lngA })
                    }
                />
            ),
        },
        location:
            data.latB !== null && data.lngB !== null
                ? {
                      label: "End",
                      render: (look) => (
                          <LocationButton
                              look={look}
                              label="End"
                              lat={data.latB!}
                              lng={data.lngB!}
                              colorName={data.colorB}
                              disabled={locked}
                              onChange={(lat, lng) =>
                                  set({
                                      latB: lat ?? data.latB,
                                      lngB: lng ?? data.lngB,
                                  })
                              }
                          />
                      ),
                  }
                : null,
        sentence: (first, location) => (
            <>
                Hotter at {location} than {first}?
            </>
        ),
        summary: {
            title: summaryTitle(
                { id: "thermometer", data } as unknown as Question,
                "me",
            ),
            sub:
                distanceValue !== null
                    ? `${distanceValue.toFixed(2)} km from start to end`
                    : "",
        },
        guess: {
            value: data.warmer ? "warmer" : "colder",
            options: [
                { value: "warmer", label: "Hotter" },
                { value: "colder", label: "Colder" },
            ],
            onChange: (value) => set({ warmer: value === "warmer" }),
            disabled: !!$hiderMode || locked,
        },
        extra: distanceLine,
    };

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
            parts={
                frozen || state === "armed"
                    ? null
                    : travelling
                      ? travelParts
                      : endsParts
            }
        >
            {travelling && state === "armed" && <Travelling data={data} />}
            {!travelling && frozen && (
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
                        readOnly
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
                            readOnly
                        />
                    )}
                    {distanceLine}
                </>
            )}
        </QuestionCard>
    );
};
