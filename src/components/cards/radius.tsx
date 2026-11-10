import { useStore } from "@nanostores/react";

import { LatitudeLongitude } from "@/components/LatLngPicker";
import {
    MENU_ITEM_CLASSNAME,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { useTakenAway } from "@/hooks/useTakenAway";
import {
    gameSettings,
    hiderMode,
    isLoading,
    type QuestionPatch,
    questions,
    updateQuestion,
} from "@/lib/context";
import { askedBefore, radarQuestion } from "@/lib/game/newQuestion";
import { gameState } from "@/lib/game/session";
import { cn } from "@/lib/utils";
import type { RadiusQuestion } from "@/maps/schema";

import { QuestionCard, useFrozen } from "./base";
import { AnswerToggle, DistancePicker } from "./parts";

const kmLabel = (km: number) => (km < 1 ? `${km * 1000} m` : `${km} km`);

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
    // Asked or answered: what was asked is a statement, not a choice.
    const frozen = useFrozen(questionKey);
    // The game's radar distances; anything else is "custom".
    const radii = ($game?.settings ?? $settings).radarKm;
    // Radii a Curse of the Drained Brain took away.
    const gone = useTakenAway("radius").map(Number);
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
            {frozen && (
                <SidebarMenuItem>
                    <p
                        className={cn(MENU_ITEM_CLASSNAME, "text-sm")}
                        data-testid="radius-fact"
                    >
                        Within{" "}
                        <strong>
                            {data.unit === "kilometers"
                                ? kmLabel(data.radius)
                                : `${data.radius} ${data.unit}`}
                        </strong>
                        .
                    </p>
                </SidebarMenuItem>
            )}
            {!frozen && (
                <DistancePicker
                    value={
                        data.unit === "meters"
                            ? data.radius / 1000
                            : data.radius
                    }
                    options={radii}
                    taken={gone}
                    disabled={locked}
                    twice={(km) =>
                        !!$game &&
                        askedBefore(
                            $game,
                            radarQuestion({ lat: data.lat, lng: data.lng }, km),
                        ) > 0
                    }
                    onChange={(km) => set({ radius: km, unit: "kilometers" })}
                />
            )}
            <LatitudeLongitude
                latitude={data.lat}
                longitude={data.lng}
                colorName={data.color}
                onChange={(lat, lng) =>
                    set({ lat: lat ?? data.lat, lng: lng ?? data.lng })
                }
                disabled={locked}
                readOnly={frozen}
            />
            {!frozen && (
                <AnswerToggle
                    value={data.within ? "inside" : "outside"}
                    options={[
                        { value: "inside", label: "Inside" },
                        { value: "outside", label: "Outside" },
                    ]}
                    onChange={(value) => set({ within: value === "inside" })}
                    disabled={!!$hiderMode || locked}
                />
            )}
        </QuestionCard>
    );
};
