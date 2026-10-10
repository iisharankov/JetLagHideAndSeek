import { useStore } from "@nanostores/react";

import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { sidebarTab } from "@/lib/context";
import {
    activeCurses,
    blockedKinds,
    blockingCurses,
    CATEGORY_LABELS,
    curseRule,
    disabledCategory,
    kindLabel,
    QUESTION_CATEGORIES,
} from "@/lib/game/curseRules";
import { serverNow } from "@/lib/game/serverTime";
import { gameRole, gameState, sendOp } from "@/lib/game/session";

/**
 * The seekers' Questions tab: what the curses on them mean right now. The
 * ones that stop them from asking, the die to roll for a Spotty Memory,
 * the questions a Drained Brain took away, and the reminders.
 */
export const CurseBanner = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    useTick(!!$game, 30_000);
    if (!$game || $role !== "seeker") return null;
    const now = serverNow();
    const active = activeCurses($game, now);
    if (active.length === 0) return null;
    const blocking = blockingCurses($game, now);
    const memory = active.find(
        (entry) => curseRule(entry.name).takes === "category",
    );
    const disabled = disabledCategory($game, now);
    const kinds = blockedKinds($game, now);
    const reminders = active.filter(
        (entry) => curseRule(entry.name).reminder && !blocking.includes(entry),
    );
    if (
        blocking.length === 0 &&
        !disabled &&
        kinds.length === 0 &&
        reminders.length === 0
    ) {
        return null;
    }

    return (
        <section
            className="mx-2 mt-2 flex flex-col gap-1 rounded-md border border-red-500/60 bg-red-950/40 p-2 text-xs"
            data-testid="curse-banner"
        >
            {blocking.map((entry) => {
                const rule = curseRule(entry.name);
                return (
                    <p key={entry.id}>
                        <strong>{entry.name}:</strong>{" "}
                        {rule.takes === "kinds"
                            ? "the hider is choosing which questions you lose. No questions until then."
                            : rule.takes === "category"
                              ? "roll a die for the category you lose until your next question."
                              : "do it, then tap Cleared in Cards. No questions until then."}
                    </p>
                );
            })}
            {memory && !memory.category && (
                <div className="flex flex-wrap gap-1">
                    {QUESTION_CATEGORIES.map((category, index) => (
                        <Button
                            key={category}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                void sendOp({
                                    type: "setCurseCategory",
                                    id: memory.id,
                                    category,
                                })
                            }
                        >
                            {index + 1}: {CATEGORY_LABELS[category]}
                        </Button>
                    ))}
                </div>
            )}
            {disabled && (
                <p>
                    <strong>Curse of the Spotty Memory:</strong>{" "}
                    {CATEGORY_LABELS[disabled]} questions are disabled until
                    your next question.
                </p>
            )}
            {kinds.length > 0 && (
                <p>
                    <strong>Curse of the Drained Brain</strong> took away:{" "}
                    {kinds.map(kindLabel).join(", ")}.
                </p>
            )}
            {reminders.map((entry) => (
                <p key={entry.id}>
                    <strong>{entry.name}:</strong>{" "}
                    {curseRule(entry.name).reminder}
                </p>
            ))}
            {blocking.some((entry) => curseRule(entry.name).blocksAsking) && (
                <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => sidebarTab.set("curses")}
                >
                    Open Cards
                </Button>
            )}
        </section>
    );
};
