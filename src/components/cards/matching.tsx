import { useStore } from "@nanostores/react";
import * as React from "react";
import { toast } from "react-toastify";

import { AdminLevelSelect } from "@/components/AdminLevelSelect";
import CustomInitDialog from "@/components/CustomInitDialog";
import { LatitudeLongitude } from "@/components/LatLngPicker";
import PresetsDialog from "@/components/PresetsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    customInitPreference,
    drawingQuestionKey,
    gameSettings,
    hiderMode,
    isLoading,
    type QuestionPatch,
    questions,
    regionRules,
    updateQuestion,
} from "@/lib/context";
import { hiddenTypesFor } from "@/lib/gameSettings";
import { cn } from "@/lib/utils";
import {
    determineMatchingBoundary,
    findMatchingPlaces,
} from "@/maps/questions/matching";
import { adaptTypeOptions } from "@/maps/regionRules";
import {
    determineUnionizedStrings,
    type MatchingQuestion,
    matchingQuestionSchema,
    NO_GROUP,
} from "@/maps/schema";

import { QuestionCard } from "./base";

/** Types whose places can be copied into a custom-points question. */
const PREFILLABLE = [
    "airport",
    "major-city",
    "aquarium-full",
    "zoo-full",
    "theme_park-full",
    "peak-full",
    "museum-full",
    "hospital-full",
    "cinema-full",
    "library-full",
    "golf_course-full",
    "consulate-full",
    "park-full",
];

export const MatchingQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: MatchingQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    const $hiderMode = useStore(hiderMode);
    const $questions = useStore(questions);
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $isLoading = useStore(isLoading);
    const $regionRules = useStore(regionRules);
    const $gameSettings = useStore(gameSettings);
    const set = (patch: QuestionPatch) => updateQuestion(questionKey, patch);
    // The game's own list of question types, plus the local rules' labels.
    const gameRules = {
        ...$regionRules,
        hiddenQuestionTypes: hiddenTypesFor("matching", $gameSettings),
    };
    const $customInitPref = useStore(customInitPreference);
    const [customDialogOpen, setCustomDialogOpen] = React.useState(false);
    const [pendingCustomType, setPendingCustomType] = React.useState<
        "custom-zone" | "custom-points" | null
    >(null);
    const label = `Matching
    ${
        $questions
            .filter((q) => q.id === "matching")
            .map((q) => q.key)
            .indexOf(questionKey) + 1
    }`;

    let questionSpecific = <></>;

    switch (data.type) {
        case "zone":
        case "letter-zone":
            questionSpecific = (
                <>
                    <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                        <AdminLevelSelect
                            lat={data.lat}
                            lng={data.lng}
                            value={data.cat.adminLevel}
                            onChange={(level) =>
                                set({ cat: { ...data.cat, adminLevel: level } })
                            }
                            disabled={!data.drag || $isLoading}
                        />
                    </SidebarMenuItem>
                    {data.type === "letter-zone" && (
                        <span className="px-2 text-center text-orange-500">
                            Warning: The zone data has been simplified by
                            &plusmn;360 feet (100 meters) in order for the
                            browser to not crash.
                        </span>
                    )}
                </>
            );
            break;
        case "same-train-line":
            questionSpecific = (
                <span className="px-2 text-center text-orange-500">
                    Warning: The train line data is based on OpenStreetMap and
                    may have fewer train stations than expected. If you are
                    using this tool, ensure that the other players are also
                    using this tool.
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
                    Worked out per station, with hiding zones on (Stations tab):
                    a station stays in play when its nearest such place is the
                    seeker&apos;s (same) or another one (different).
                </span>
            );
            break;
        case "custom-zone":
        case "custom-points":
            if (data.drag) {
                questionSpecific = (
                    <>
                        <p className="px-2 mb-1 text-center text-orange-500">
                            To modify the matching{" "}
                            {data.type === "custom-zone" ? "zones" : "points"},
                            enable it:
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
                                disabled={$isLoading}
                            />
                            and use the buttons at the bottom left of the map.
                        </p>
                        <div className="flex justify-center mb-2">
                            <PresetsDialog
                                data={data}
                                questionKey={questionKey}
                                presetTypeHint={data.type}
                            />
                        </div>
                    </>
                );
            }
    }

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
        >
            <CustomInitDialog
                open={customDialogOpen}
                onOpenChange={setCustomDialogOpen}
                onBlank={async () => {
                    if (!pendingCustomType) return;
                    if (pendingCustomType === "custom-zone") {
                        set({
                            type: "custom-zone",
                            geo: undefined,
                        } as QuestionPatch);
                        toast.info("Please draw the zone on the map.");
                    } else {
                        set({
                            type: "custom-points",
                            geo: [],
                        } as QuestionPatch);
                        toast.info("Please draw the points on the map.");
                    }
                    setCustomDialogOpen(false);
                }}
                onPrefill={async () => {
                    if (!pendingCustomType) return;
                    let geo: unknown;
                    if (pendingCustomType === "custom-zone") {
                        geo = await determineMatchingBoundary(data);
                    } else if (PREFILLABLE.includes(data.type)) {
                        geo = await findMatchingPlaces(data);
                    } else {
                        geo = [];
                        toast.info("Please draw the points on the map.");
                    }
                    set({ type: pendingCustomType, geo } as QuestionPatch);
                    setCustomDialogOpen(false);
                }}
            />
            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                <Select
                    trigger="Matching Type"
                    options={adaptTypeOptions(
                        Object.fromEntries(
                            matchingQuestionSchema.options
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
                    groups={matchingQuestionSchema.options
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
                                    disabled: false,
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
                        // A zone question needs its category; keep any.
                        const cat = (data as { cat?: unknown }).cat ?? {
                            adminLevel: 4,
                        };
                        if (
                            value === "custom-zone" ||
                            value === "custom-points"
                        ) {
                            if ($customInitPref === "ask") {
                                setPendingCustomType(value);
                                setCustomDialogOpen(true);
                                return;
                            }
                            // Apply the preference without the dialog.
                            const patch: Record<string, unknown> = {
                                type: value,
                                cat,
                            };
                            if ($customInitPref === "blank") {
                                patch.geo =
                                    value === "custom-zone" ? undefined : [];
                                toast.info(
                                    value === "custom-zone"
                                        ? "Please draw the zone on the map."
                                        : "Please draw the points on the map.",
                                );
                            } else if ($customInitPref === "prefill") {
                                if (value === "custom-zone") {
                                    patch.geo =
                                        await determineMatchingBoundary(data);
                                } else if (PREFILLABLE.includes(data.type)) {
                                    patch.geo = await findMatchingPlaces(data);
                                } else {
                                    patch.geo = [];
                                    toast.info(
                                        "Please draw the points on the map.",
                                    );
                                }
                            }
                            set(patch as QuestionPatch);
                            return;
                        }

                        set({
                            type: value,
                            cat,
                            ...(value === "same-length-station"
                                ? { lengthComparison: "same", same: true }
                                : {}),
                        } as QuestionPatch);
                    }}
                    disabled={!data.drag || $isLoading}
                />
            </SidebarMenuItem>
            {questionSpecific}

            {data.type !== "custom-zone" && (
                <LatitudeLongitude
                    latitude={data.lat}
                    longitude={data.lng}
                    colorName={data.color}
                    onChange={(lat, lng) =>
                        set({ lat: lat ?? data.lat, lng: lng ?? data.lng })
                    }
                    disabled={!data.drag || $isLoading}
                />
            )}
            <div
                className={cn(
                    "flex gap-2 items-center p-2",
                    data.type === "same-length-station" && "flex-col",
                )}
            >
                <Label
                    className={cn(
                        "font-semibold text-lg",
                        $isLoading && "text-muted-foreground",
                        data.type === "same-length-station" && "text-center",
                    )}
                >
                    Result
                </Label>
                {data.type === "same-length-station" ? (
                    <ToggleGroup
                        className="grow"
                        type="single"
                        value={
                            data.lengthComparison
                                ? data.lengthComparison
                                : data.same === true
                                  ? "same"
                                  : data.same === false
                                    ? "different"
                                    : "same"
                        }
                        onValueChange={(
                            value: "shorter" | "same" | "longer" | "different",
                        ) => {
                            if (value === "shorter" || value === "longer") {
                                set({ lengthComparison: value });
                            } else if (value === "same") {
                                set({ lengthComparison: "same", same: true });
                            } else if (value === "different") {
                                set({ same: false });
                            }
                        }}
                        disabled={!!$hiderMode || !data.drag || $isLoading}
                    >
                        <ToggleGroupItem value="shorter">
                            Shorter
                        </ToggleGroupItem>
                        <ToggleGroupItem value="same">Same</ToggleGroupItem>
                        <ToggleGroupItem value="longer">Longer</ToggleGroupItem>
                    </ToggleGroup>
                ) : (
                    <ToggleGroup
                        className="grow"
                        type="single"
                        value={data.same ? "same" : "different"}
                        onValueChange={(value) => {
                            if (value === "same") {
                                set({ same: true });
                            } else if (value === "different") {
                                set({ same: false });
                            }
                        }}
                        disabled={!!$hiderMode || !data.drag || $isLoading}
                    >
                        <ToggleGroupItem value="different">
                            Different
                        </ToggleGroupItem>
                        <ToggleGroupItem value="same">Same</ToggleGroupItem>
                    </ToggleGroup>
                )}
            </div>
        </QuestionCard>
    );
};
