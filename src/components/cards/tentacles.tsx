import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { useEffect, useState } from "react";

import { LatitudeLongitude } from "@/components/LatLngPicker";
import PresetsDialog from "@/components/PresetsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { UnitSelect } from "@/components/UnitSelect";
import {
    drawingQuestionKey,
    hiderMode,
    isLoading,
    questionModified,
    questions,
    triggerLocalRefresh,
} from "@/lib/context";
import { cn, mapToObj } from "@/lib/utils";
import { findTentacleLocations } from "@/maps/api";
import { errorMessage } from "@/maps/errors";
import { filterPointsWithinRadius } from "@/maps/questions/tentacles";
import {
    determineUnionizedStrings,
    NO_GROUP,
    type TentacleQuestion,
    tentacleQuestionSchema,
    type TraditionalTentacleQuestion,
} from "@/maps/schema";

import { QuestionCard } from "./base";

export const TentacleQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: TentacleQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    const $questions = useStore(questions);
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $isLoading = useStore(isLoading);
    const label = `Tentacles
    ${
        $questions
            .filter((q) => q.id === "tentacles")
            .map((q) => q.key)
            .indexOf(questionKey) + 1
    }`;

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
            collapsed={data.collapsed}
            setCollapsed={(collapsed) => {
                data.collapsed = collapsed; // Doesn't trigger a re-render so no need for questionModified
            }}
            locked={!data.drag}
            setLocked={(locked) => questionModified((data.drag = !locked))}
            hidden={data.hidden}
            setHidden={(hidden) => questionModified((data.hidden = hidden))}
        >
            <SidebarMenuItem>
                <div className={cn(MENU_ITEM_CLASSNAME, "gap-2 flex flex-row")}>
                    <Input
                        type="number"
                        className="rounded-md p-2 w-16"
                        value={data.radius}
                        onChange={(e) =>
                            questionModified(
                                (data.radius = parseFloat(e.target.value)),
                            )
                        }
                        disabled={!data.drag || $isLoading}
                    />
                    <UnitSelect
                        unit={data.unit}
                        onChange={(unit) =>
                            questionModified((data.unit = unit))
                        }
                        disabled={!data.drag || $isLoading}
                    />
                </div>
            </SidebarMenuItem>
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <Select
                    trigger="Location Type"
                    options={Object.fromEntries(
                        tentacleQuestionSchema.options
                            .filter((x) => x.description === NO_GROUP)
                            .flatMap((x) =>
                                determineUnionizedStrings(x.shape.locationType),
                            )
                            .map((x) => [(x._def as any).value, x.description]),
                    )}
                    groups={Object.fromEntries(
                        tentacleQuestionSchema.options
                            .filter((x) => x.description !== NO_GROUP)
                            .map((x) => [
                                x.description,
                                Object.fromEntries(
                                    determineUnionizedStrings(
                                        x.shape.locationType,
                                    ).map((x) => [
                                        (x._def as any).value,
                                        x.description,
                                    ]),
                                ),
                            ]),
                    )}
                    value={data.locationType}
                    onValueChange={async (value) => {
                        if (value === "custom") {
                            const priorLocations = await findTentacleLocations(
                                data as TraditionalTentacleQuestion,
                            );

                            data.locationType = "custom";
                            data.places = priorLocations.features.map((x) => ({
                                ...x,
                                properties: {
                                    ...x.properties,
                                    name:
                                        x.properties?.["name:en"] ??
                                        x.properties?.name,
                                },
                            }));
                            data.location = false;
                        } else {
                            data.location = false;
                            data.locationType = value;
                        }
                        questionModified();
                    }}
                    disabled={!data.drag || $isLoading}
                />
            </SidebarMenuItem>
            {data.locationType === "custom" && data.drag && (
                <>
                    <p className="px-2 mb-1 text-center text-orange-500">
                        To modify tentacle locations, enable it:
                        <Checkbox
                            className="mx-1 my-1"
                            checked={$drawingQuestionKey === questionKey}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    drawingQuestionKey.set(questionKey);
                                } else {
                                    drawingQuestionKey.set(-1);
                                }
                            }}
                            disabled={!data.drag || $isLoading}
                        />
                        and use the buttons at the bottom left of the map.
                    </p>
                    <div className="flex justify-center mb-2">
                        <PresetsDialog
                            data={data}
                            presetTypeHint="custom-tentacles"
                        />
                    </div>
                </>
            )}
            <LatitudeLongitude
                latitude={data.lat}
                longitude={data.lng}
                colorName={data.color}
                onChange={(lat, lng) => {
                    if (lat !== null) {
                        data.lat = lat;
                    }
                    if (lng !== null) {
                        data.lng = lng;
                    }
                    questionModified();
                }}
                disabled={!data.drag || $isLoading}
            />
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <TentacleLocationSelector
                    data={data}
                    disabled={!data.drag || $isLoading}
                />
            </SidebarMenuItem>
        </QuestionCard>
    );
};

type TentacleOptions =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; features: any[] };

/** The places the hider can name: those of the type within the radius. */
const useTentacleOptions = (data: TentacleQuestion): TentacleOptions => {
    const [options, setOptions] = useState<TentacleOptions>({
        status: "loading",
    });
    const customPlaces =
        data.locationType === "custom" ? JSON.stringify(data.places) : "";

    useEffect(() => {
        let cancelled = false;
        setOptions({ status: "loading" });

        const load =
            data.locationType === "custom"
                ? Promise.resolve(turf.featureCollection(data.places))
                : findTentacleLocations(data);

        load.then((locations) =>
            filterPointsWithinRadius(
                locations,
                data.lng,
                data.lat,
                data.radius,
                data.unit,
            ),
        ).then(
            (within) =>
                !cancelled &&
                setOptions({ status: "ready", features: within.features }),
            (error) =>
                !cancelled &&
                setOptions({ status: "error", message: errorMessage(error) }),
        );

        return () => {
            cancelled = true;
        };
    }, [
        data.locationType,
        customPlaces,
        data.lat,
        data.lng,
        data.radius,
        data.unit,
    ]);

    return options;
};

const TentacleLocationSelector = ({
    data,
    disabled,
}: {
    data: TentacleQuestion;
    disabled: boolean;
}) => {
    useStore(triggerLocalRefresh);
    const $hiderMode = useStore(hiderMode);
    const options = useTentacleOptions(data);

    // Only once the list has loaded: drop an answer that's no longer within
    // the radius. (Doing this before loading would wipe every saved answer.)
    useEffect(() => {
        if (options.status !== "ready" || !data.location) return;
        const name = data.location.properties?.name;
        if (!options.features.some((f) => f.properties.name === name)) {
            data.location = false;
            questionModified();
        }
    }, [options]);

    if (options.status === "loading") {
        return (
            <div className="flex w-full items-center justify-center h-8 text-sm text-muted-foreground">
                Loading places…
            </div>
        );
    }

    if (options.status === "error") {
        return (
            <p className="w-full px-2 text-xs text-red-300">
                Couldn&apos;t load places: {options.message}
            </p>
        );
    }

    return (
        <Select
            trigger="Location"
            options={{
                false: "Not Within",
                ...mapToObj(options.features, (feature: any) => [
                    feature.properties.name,
                    feature.properties.name,
                ]),
            }}
            value={data.location ? data.location.properties.name : "false"}
            onValueChange={(value) => {
                data.location =
                    value === "false"
                        ? false
                        : options.features.find(
                              (feature: any) =>
                                  feature.properties.name === value,
                          );
                questionModified();
            }}
            disabled={!!$hiderMode || disabled}
        />
    );
};
