import { useStore } from "@nanostores/react";
import { useState } from "react";

import { LatitudeLongitude } from "@/components/LatLngPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UnitToggle } from "@/components/UnitToggle";
import {
    gameSettings,
    hiderMode,
    isLoading,
    type QuestionPatch,
    questions,
    updateQuestion,
} from "@/lib/context";
import { gameState } from "@/lib/game/session";
import { cn } from "@/lib/utils";
import type { RadiusQuestion } from "@/maps/schema";

import { QuestionCard } from "./base";

const kmLabel = (km: number) => (km < 1 ? `${km * 1000} m` : `${km} km`);

const CHIP = "rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-50";
const CHIP_ON = "bg-blue-600 text-white";
const CHIP_OFF = "bg-slate-700 hover:bg-slate-600";

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
    const $game = useStore(gameState);
    const $settings = useStore(gameSettings);
    const set = (patch: QuestionPatch) => updateQuestion(questionKey, patch);
    // The game's radar distances, as cards; anything else is "custom".
    const radii = ($game?.settings ?? $settings).radarKm;
    const listed = data.unit === "kilometers" && radii.includes(data.radius);
    const [custom, setCustom] = useState(!listed);
    const showCustom = custom || !listed;
    const locked = !data.drag || $isLoading;
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
                <div
                    className={cn(MENU_ITEM_CLASSNAME, "flex flex-wrap gap-1")}
                    role="group"
                    aria-label="Radius"
                >
                    {radii.map((km) => {
                        const on = !showCustom && data.radius === km;
                        return (
                            <button
                                key={km}
                                type="button"
                                disabled={locked}
                                aria-pressed={on}
                                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                                onClick={() => {
                                    set({ radius: km, unit: "kilometers" });
                                    setCustom(false);
                                }}
                            >
                                {kmLabel(km)}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        disabled={locked}
                        aria-pressed={showCustom}
                        className={cn(CHIP, showCustom ? CHIP_ON : CHIP_OFF)}
                        onClick={() => setCustom(true)}
                    >
                        Custom
                    </button>
                </div>
            </SidebarMenuItem>
            {showCustom && (
                <SidebarMenuItem>
                    <div
                        className={cn(
                            MENU_ITEM_CLASSNAME,
                            "flex flex-row items-center gap-2",
                        )}
                    >
                        <Input
                            type="number"
                            inputMode="decimal"
                            aria-label="Custom radius"
                            className="w-24 rounded-md p-2"
                            value={data.radius}
                            disabled={locked}
                            onChange={(e) =>
                                set({ radius: parseFloat(e.target.value) })
                            }
                        />
                        <UnitToggle
                            unit={data.unit}
                            disabled={locked}
                            onChange={(unit) => set({ unit })}
                        />
                    </div>
                </SidebarMenuItem>
            )}
            <LatitudeLongitude
                latitude={data.lat}
                longitude={data.lng}
                colorName={data.color}
                onChange={(lat, lng) =>
                    set({ lat: lat ?? data.lat, lng: lng ?? data.lng })
                }
                disabled={locked}
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
                    disabled={!!$hiderMode || locked}
                >
                    <ToggleGroupItem value="outside">Outside</ToggleGroupItem>
                    <ToggleGroupItem value="inside">Inside</ToggleGroupItem>
                </ToggleGroup>
            </div>
        </QuestionCard>
    );
};
