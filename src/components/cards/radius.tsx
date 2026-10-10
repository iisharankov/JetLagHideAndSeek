import { useStore } from "@nanostores/react";

import { LatitudeLongitude } from "@/components/LatLngPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UnitSelect } from "@/components/UnitSelect";
import {
    hiderMode,
    isLoading,
    type QuestionPatch,
    questions,
    updateQuestion,
} from "@/lib/context";
import { RADAR_KM } from "@/lib/game/settings";
import { cn } from "@/lib/utils";
import type { RadiusQuestion } from "@/maps/schema";

import { QuestionCard } from "./base";

export const RadiusQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: RadiusQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    const $hiderMode = useStore(hiderMode);
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const set = (patch: QuestionPatch) => updateQuestion(questionKey, patch);
    const label = `Radius
    ${
        $questions
            .filter((q) => q.id === "radius")
            .map((q) => q.key)
            .indexOf(questionKey) + 1
    }`;

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
        >
            <SidebarMenuItem>
                <div className={cn(MENU_ITEM_CLASSNAME, "gap-2 flex flex-row")}>
                    <Input
                        type="number"
                        className="rounded-md p-2 w-16"
                        value={data.radius}
                        disabled={!data.drag || $isLoading}
                        onChange={(e) =>
                            set({ radius: parseFloat(e.target.value) })
                        }
                    />
                    <UnitSelect
                        unit={data.unit}
                        disabled={!data.drag || $isLoading}
                        onChange={(unit) => set({ unit })}
                    />
                </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <div
                    className={cn(MENU_ITEM_CLASSNAME, "flex flex-wrap gap-1")}
                >
                    {RADAR_KM.map((km) => (
                        <button
                            key={km}
                            type="button"
                            disabled={!data.drag || $isLoading}
                            className={cn(
                                "rounded-md px-2 py-0.5 text-xs disabled:opacity-50",
                                data.unit === "kilometers" && data.radius === km
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-700",
                            )}
                            onClick={() =>
                                set({ radius: km, unit: "kilometers" })
                            }
                        >
                            {km < 1 ? `${km * 1000} m` : `${km} km`}
                        </button>
                    ))}
                </div>
            </SidebarMenuItem>
            <LatitudeLongitude
                latitude={data.lat}
                longitude={data.lng}
                colorName={data.color}
                onChange={(lat, lng) =>
                    set({ lat: lat ?? data.lat, lng: lng ?? data.lng })
                }
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
                    value={data.within ? "inside" : "outside"}
                    onValueChange={(value: "inside" | "outside") =>
                        set({ within: value === "inside" })
                    }
                    disabled={!!$hiderMode || !data.drag || $isLoading}
                >
                    <ToggleGroupItem value="outside">Outside</ToggleGroupItem>
                    <ToggleGroupItem value="inside">Inside</ToggleGroupItem>
                </ToggleGroup>
            </div>
        </QuestionCard>
    );
};
