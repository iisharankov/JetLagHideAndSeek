import { useStore } from "@nanostores/react";
import { useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    CATEGORY_LABELS,
    kindCategory,
    kindLabel,
    photoKind,
    QUESTION_CATEGORIES,
    type QuestionCategoryKind,
} from "@/lib/game/curseRules";
import { gameState, sendOp } from "@/lib/game/session";
import { ALWAYS_OFF, questionKey } from "@/lib/game/settings";
import type { CurseEntry, GameSettings } from "@/lib/game/types";
import { TYPES } from "@/lib/questionInfo";
import { photoQuestions } from "@/lib/rules/content";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";

/** Every kind of question in this game, by category. */
const kindsFor = (
    settings: GameSettings,
): Record<QuestionCategoryKind, string[]> => {
    const typed = (category: "tentacles" | "matching" | "measuring") =>
        Object.keys(TYPES[category])
            .filter(
                (type) =>
                    !type.startsWith("custom") &&
                    !ALWAYS_OFF.includes(questionKey(category, type)) &&
                    !settings.disabledQuestions.includes(
                        questionKey(category, type),
                    ),
            )
            .map((type) => `${category}:${type}`);
    return {
        radius: settings.radarKm.map((km) => `radius:${km}`),
        thermometer: ["thermometer"],
        tentacles: typed("tentacles"),
        matching: typed("matching"),
        measuring: typed("measuring"),
        photo: photoQuestions()
            .filter((question) => question.sizes.includes(settings.size))
            .map((question) => photoKind(question.name)),
    };
};

/**
 * Curse of the Drained Brain, on the hider's phone: "Choose three questions
 * in different categories. The seekers cannot ask those questions for the
 * rest of your run."
 */
export const DrainedBrainChooser = ({ curse }: { curse: CurseEntry }) => {
    const $game = useStore(gameState);
    const [picked, setPicked] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    if (!$game) return null;
    const kinds = kindsFor($game.settings);
    const categories = new Set(picked.map(kindCategory));
    const ready = picked.length === 3 && categories.size === 3;

    const toggle = (kind: string) => {
        if (picked.includes(kind)) {
            setPicked(picked.filter((other) => other !== kind));
            return;
        }
        // One per category, three in all.
        const category = kindCategory(kind);
        const rest = picked.filter((other) => kindCategory(other) !== category);
        if (rest.length >= 3) return;
        setPicked([...rest, kind]);
    };

    return (
        <Dialog open>
            <DialogContent
                closeIcon={false}
                onInteractOutside={(event) => event.preventDefault()}
                onEscapeKeyDown={(event) => event.preventDefault()}
                className="!bg-[hsl(var(--sidebar-background))] !text-white max-h-[90vh] overflow-y-auto"
                data-testid="drained-brain-chooser"
            >
                <DialogHeader>
                    <DialogTitle>Curse of the Drained Brain</DialogTitle>
                    <DialogDescription>
                        Choose three questions in different categories. The
                        seekers can&apos;t ask them for the rest of your run,
                        and can&apos;t ask anything until you have chosen.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 text-sm">
                    {QUESTION_CATEGORIES.map((category) => (
                        <section key={category}>
                            <h3 className="mb-1 text-xs font-semibold text-slate-300">
                                {CATEGORY_LABELS[category]}
                            </h3>
                            <div className="flex flex-wrap gap-1">
                                {kinds[category].map((kind) => {
                                    const on = picked.includes(kind);
                                    return (
                                        <button
                                            key={kind}
                                            type="button"
                                            aria-pressed={on}
                                            className={cn(
                                                "rounded-md px-2 py-1 text-xs",
                                                on
                                                    ? "bg-red-700 text-white"
                                                    : "bg-slate-700 hover:bg-slate-600",
                                            )}
                                            onClick={() => toggle(kind)}
                                        >
                                            {kindLabel(kind).replace(
                                                `${CATEGORY_LABELS[category]}: `,
                                                "",
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
                <Button
                    disabled={!ready || busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await sendOp({
                                type: "blockQuestions",
                                id: curse.id,
                                kinds: picked,
                            });
                        } catch (error) {
                            toast.error(errorMessage(error));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    Take these away ({picked.length}/3)
                </Button>
            </DialogContent>
        </Dialog>
    );
};
