// Game setup: which question types are in the game.
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ToggleCard } from "@/components/ui/toggle-card";
import {
    ALWAYS_OFF,
    LAKE_AREA_CHOICES,
    questionKey,
} from "@/lib/game/settings";
import type { GameSettings } from "@/lib/game/types";
import { TYPES } from "@/lib/questionInfo";

const CATEGORY_NAMES: Record<keyof typeof TYPES, string> = {
    matching: "Matching",
    measuring: "Measuring",
    tentacles: "Tentacles",
};

/** Setup, last screen: which question types are in the game. */
export const QuestionsStep = ({
    draft,
    mode,
    update,
    toggleQuestion,
    showQuestions,
    setShowQuestions,
}: {
    draft: GameSettings;
    mode: "solo" | "start";
    update: (changes: Partial<GameSettings>) => void;
    toggleQuestion: (key: string, enabled: boolean) => void;
    showQuestions: boolean;
    setShowQuestions: (show: boolean) => void;
}) => {
    const lakeEnabled = !draft.disabledQuestions.includes(
        questionKey("measuring", "lake"),
    );
    const allTypes = (Object.keys(TYPES) as (keyof typeof TYPES)[]).flatMap(
        (category) =>
            Object.keys(TYPES[category])
                .map((type) => questionKey(category, type))
                .filter((key) => !ALWAYS_OFF.includes(key)),
    );
    const typesOn = allTypes.filter(
        (key) => !draft.disabledQuestions.includes(key),
    ).length;

    return (
        <>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-600 px-3 py-2">
                <span className="text-xs">
                    <strong>
                        {typesOn} of {allTypes.length} question types
                    </strong>{" "}
                    on ({draft.region === "switzerland" ? "Swiss" : "standard"}{" "}
                    rules). Radar and thermometer are always in.
                </span>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowQuestions(!showQuestions)}
                    aria-expanded={showQuestions}
                >
                    {showQuestions ? "Done" : "Customise"}
                </Button>
            </div>
            {showQuestions &&
                (Object.keys(TYPES) as (keyof typeof TYPES)[]).map(
                    (category) => (
                        <section key={category}>
                            <h3 className="mb-1 font-semibold font-poppins">
                                {CATEGORY_NAMES[category]}
                            </h3>
                            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                {Object.entries(TYPES[category])
                                    .filter(
                                        ([type]) =>
                                            !ALWAYS_OFF.includes(
                                                questionKey(category, type),
                                            ),
                                    )
                                    .map(([type, info]) => {
                                        const key = questionKey(category, type);
                                        const enabled =
                                            !draft.disabledQuestions.includes(
                                                key,
                                            );
                                        return (
                                            <li
                                                key={type}
                                                className="flex items-center gap-2"
                                            >
                                                <Checkbox
                                                    id={`q-${key}`}
                                                    checked={enabled}
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        toggleQuestion(
                                                            key,
                                                            !!checked,
                                                        )
                                                    }
                                                />
                                                <label
                                                    htmlFor={`q-${key}`}
                                                    className="cursor-pointer"
                                                >
                                                    {info.label}
                                                </label>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </section>
                    ),
                )}
            {lakeEnabled && (
                <>
                    <Label>Lake shore question: lakes of at least</Label>
                    <Select
                        trigger="Minimum lake size"
                        options={Object.fromEntries(
                            LAKE_AREA_CHOICES.map((km2) => [
                                String(km2),
                                `${km2} km²`,
                            ]),
                        )}
                        value={String(draft.minLakeAreaKm2)}
                        onValueChange={(value) =>
                            update({
                                minLakeAreaKm2: Number(value),
                            })
                        }
                    />
                </>
            )}
            {mode === "start" && (
                <ToggleCard
                    title="Seekers can answer questions"
                    description="Off: only the hider answers, and answered questions are locked for the seekers. The hider can change this later."
                    checked={draft.seekersCanAnswer}
                    onCheckedChange={(seekersCanAnswer) =>
                        update({ seekersCanAnswer })
                    }
                />
            )}
        </>
    );
};
