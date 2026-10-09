import { useStore } from "@nanostores/react";
import { Label } from "@radix-ui/react-label";
import * as React from "react";

import { AdminLevelSelect } from "@/components/AdminLevelSelect";
import CustomInitDialog from "@/components/CustomInitDialog";
import { LatitudeLongitude } from "@/components/LatLngPicker";
import PresetsDialog from "@/components/PresetsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    customInitPreference,
    displayHidingZones,
    drawingQuestionKey,
    gameSettings,
    hiderMode,
    isLoading,
    questionModified,
    questions,
    regionRules,
    triggerLocalRefresh,
} from "@/lib/context";
import { hiddenTypesFor } from "@/lib/gameSettings";
import { cn } from "@/lib/utils";
import { elevation } from "@/maps/elevation";
import { determineMeasuringBoundary } from "@/maps/questions/measuring";
import { adaptTypeOptions } from "@/maps/regionRules";
import {
    determineUnionizedStrings,
    type MeasuringQuestion,
    measuringQuestionSchema,
    NO_GROUP,
} from "@/maps/schema";

import { QuestionCard } from "./base";

export const MeasuringQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: MeasuringQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    useStore(triggerLocalRefresh);
    const $hiderMode = useStore(hiderMode);
    const $questions = useStore(questions);
    const $displayHidingZones = useStore(displayHidingZones);
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $isLoading = useStore(isLoading);
    const $regionRules = useStore(regionRules);
    const $gameSettings = useStore(gameSettings);
    // The game's own list of question types, plus the local rules' labels.
    const gameRules = {
        ...$regionRules,
        hiddenQuestionTypes: hiddenTypesFor("measuring", $gameSettings),
    };
    const $customInitPref = useStore(customInitPreference);
    const [customDialogOpen, setCustomDialogOpen] = React.useState(false);
    const label = `Measuring
    ${
        $questions
            .filter((q) => q.id === "measuring")
            .map((q) => q.key)
            .indexOf(questionKey) + 1
    }`;

    let questionSpecific = <></>;

    switch (data.type) {
        case "admin-measure":
            questionSpecific = (
                <>
                    <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                        <AdminLevelSelect
                            lat={data.lat}
                            lng={data.lng}
                            value={(data as any).cat?.adminLevel ?? 4}
                            onChange={(level) => {
                                (data as any).cat = { adminLevel: level };
                                questionModified();
                            }}
                            disabled={!data.drag || $isLoading}
                        />
                    </SidebarMenuItem>
                    {$displayHidingZones && (
                        <span className="px-2 text-center text-sm text-gray-500">
                            With hiding zones on, this answer only shades inside
                            the zones.
                        </span>
                    )}
                </>
            );
            break;
        case "sea-level":
            questionSpecific = (
                <AltitudeInput
                    data={data}
                    disabled={!data.drag || $isLoading}
                />
            );
            break;
        case "mcdonalds":
        case "seven11":
            questionSpecific = (
                <span className="px-2 text-center text-orange-500">
                    This question will eliminate hiding zones that don&apos;t
                    fit the criteria. When you click on a zone, the parts of
                    that zone that don&apos;t satisfy the criteria will be
                    eliminated.
                </span>
            );
            break;
        case "aquarium":
        case "hospital":
        case "peak":
        case "museum":
        case "theme_park":
        case "zoo":
        case "cinema":
        case "library":
        case "golf_course":
        case "consulate":
        case "park":
            questionSpecific = (
                <span className="px-2 text-center text-orange-500">
                    This question will only influence the map when you click on
                    a hiding zone in the hiding zone sidebar.
                </span>
            );
            break;
        case "custom-measure":
            if (data.drag) {
                questionSpecific = (
                    <>
                        <p className="px-2 mb-1 text-center text-orange-500">
                            To modify the measuring question, enable it:
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
                                presetTypeHint={data.type}
                            />
                        </div>
                    </>
                );
            }
            break;
    }

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
            <CustomInitDialog
                open={customDialogOpen}
                onOpenChange={setCustomDialogOpen}
                onBlank={async () => {
                    if (!(data as any).geo) {
                        (data as any).geo = {
                            type: "FeatureCollection",
                            features: [],
                        };
                    } else {
                        (data as any).geo.features = [];
                    }
                    data.type = "custom-measure";
                    questionModified();
                    setCustomDialogOpen(false);
                }}
                onPrefill={async () => {
                    const boundary = await determineMeasuringBoundary(data);
                    if (!(data as any).geo) {
                        (data as any).geo = {
                            type: "FeatureCollection",
                            features: [],
                        };
                    }
                    (data as any).geo.features = boundary ? boundary : [];
                    data.type = "custom-measure";
                    questionModified();
                    setCustomDialogOpen(false);
                }}
            />
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <Select
                    trigger="Measuring Type"
                    options={adaptTypeOptions(
                        Object.fromEntries(
                            measuringQuestionSchema.options
                                .filter((x) => x.description === NO_GROUP)
                                .flatMap((x) =>
                                    determineUnionizedStrings(x.shape.type),
                                )
                                .map((x) => [
                                    (x._def as any).value,
                                    x.description,
                                ]),
                        ),
                        gameRules,
                        data.type,
                    )}
                    groups={measuringQuestionSchema.options
                        .filter((x) => x.description !== NO_GROUP)
                        .map((x): [string, Record<string, string>] => [
                            x.description ?? "",
                            adaptTypeOptions(
                                Object.fromEntries(
                                    determineUnionizedStrings(x.shape.type).map(
                                        (x) => [
                                            (x._def as any).value,
                                            x.description,
                                        ],
                                    ),
                                ),
                                gameRules,
                                data.type,
                            ),
                        ])
                        .reduce(
                            (acc, [key, value]) => {
                                const values = {
                                    disabled: !$displayHidingZones,
                                    options: value,
                                };

                                if (acc[key]) {
                                    acc[key].options = {
                                        ...acc[key].options,
                                        ...value,
                                    };
                                } else {
                                    acc[key] = values;
                                }

                                return acc;
                            },
                            {} as Record<
                                string,
                                {
                                    disabled: boolean;
                                    options: Record<string, string>;
                                }
                            >,
                        )}
                    value={data.type}
                    onValueChange={async (value) => {
                        if (value === "custom-measure") {
                            if ($customInitPref === "ask") {
                                setCustomDialogOpen(true);
                                return;
                            }
                            if ($customInitPref === "blank") {
                                if (!(data as any).geo) {
                                    (data as any).geo = {
                                        type: "FeatureCollection",
                                        features: [],
                                    };
                                } else {
                                    (data as any).geo.features = [];
                                }
                            } else if ($customInitPref === "prefill") {
                                const boundary =
                                    await determineMeasuringBoundary(data);
                                if (!(data as any).geo) {
                                    (data as any).geo = {
                                        type: "FeatureCollection",
                                        features: [],
                                    };
                                }
                                (data as any).geo.features = boundary
                                    ? boundary
                                    : [];
                            }
                            data.type = value;
                            questionModified();
                            return;
                        }
                        if (value === "admin-measure" && !(data as any).cat) {
                            (data as any).cat = { adminLevel: 4 };
                        }
                        data.type = value;
                        questionModified();
                    }}
                    disabled={!data.drag || $isLoading}
                />
            </SidebarMenuItem>
            {questionSpecific}
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
            <div className="flex gap-2 items-center p-2">
                <Label
                    className={cn(
                        "font-semibold text-lg",
                        $isLoading && "text-muted-foreground",
                    )}
                >
                    Result
                </Label>
                <ToggleGroup
                    className="grow"
                    type="single"
                    value={data.hiderCloser ? "closer" : "further"}
                    onValueChange={(value: "closer" | "further") =>
                        questionModified(
                            (data.hiderCloser = value === "closer"),
                        )
                    }
                    disabled={!!$hiderMode || !data.drag || $isLoading}
                >
                    <ToggleGroupItem value="further">
                        {data.type === "sea-level"
                            ? "Hider Higher"
                            : "Hider Further"}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="closer">
                        {data.type === "sea-level"
                            ? "Hider Lower"
                            : "Hider Closer"}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </QuestionCard>
    );
};

/**
 * Altitude question: the seeker's altitude. Blank uses the ground height at
 * the seeker's pin (shown as the placeholder); typing a phone's reading
 * overrides it.
 */
const AltitudeInput = ({
    data,
    disabled,
}: {
    data: MeasuringQuestion & { seekerAltitude?: number };
    disabled: boolean;
}) => {
    const [ground, setGround] = React.useState<number | null>(null);
    React.useEffect(() => {
        let current = true;
        elevation
            .elevationAt(data.lat, data.lng)
            .then((metres) => current && setGround(metres))
            .catch(() => current && setGround(null));
        return () => {
            current = false;
        };
    }, [data.lat, data.lng]);

    return (
        <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
            <Label className="text-sm shrink-0">Seeker altitude (m)</Label>
            <Input
                type="number"
                inputMode="numeric"
                className="w-28"
                value={data.seekerAltitude ?? ""}
                placeholder={ground === null ? "from map" : `${ground} (map)`}
                onChange={(event) => {
                    const value = event.target.value.trim();
                    data.seekerAltitude =
                        value === "" ? undefined : Number(value);
                    questionModified();
                }}
                disabled={disabled}
            />
        </SidebarMenuItem>
    );
};
