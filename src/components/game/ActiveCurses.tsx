// Cards → On the seekers.
import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import { CardText } from "@/components/RulesText";
import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { formatDuration } from "@/lib/game/clock";
import {
    CATEGORY_LABELS,
    curseEndsAt,
    curseRule,
    kindLabel,
    lastsTheRun,
    type QuestionCategoryKind,
    SIZE_INDEX,
} from "@/lib/game/curseRules";
import { serverNow } from "@/lib/game/serverTime";
import { gameRole, sendOp } from "@/lib/game/session";
import type { CurseEntry, CustomCard, GameSize } from "@/lib/game/types";
import { CURSES } from "@/lib/rules/cards";

const time = (at: number) =>
    new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Curse of the Bird Guide, on the hider's phone: film a bird for as long
 * as it stays in the frame, up to the card's minutes. The time is sent to
 * the seekers, who must match it.
 */
const Stopwatch = ({
    curse,
    limitSeconds,
}: {
    curse: CurseEntry;
    limitSeconds: number;
}) => {
    const [startedAt, setStartedAt] = useState<number | null>(null);
    useTick(startedAt !== null, 500);
    const elapsed =
        startedAt === null
            ? 0
            : Math.min(
                  limitSeconds,
                  Math.floor((Date.now() - startedAt) / 1000),
              );
    const stop = (seconds: number) => {
        setStartedAt(null);
        void sendOp({ type: "setCurseTime", id: curse.id, seconds });
    };
    // The card's limit stops the clock by itself.
    useEffect(() => {
        if (startedAt !== null && elapsed >= limitSeconds) stop(limitSeconds);
    });
    if (curse.seconds !== undefined && startedAt === null) {
        return (
            <p className="text-xs">
                You filmed for{" "}
                <strong>{formatDuration(curse.seconds * 1000)}</strong>; the
                seekers must film a bird for at least that.
            </p>
        );
    }
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-base">
                {formatDuration(elapsed * 1000)}
            </span>
            {startedAt === null ? (
                <Button size="sm" onClick={() => setStartedAt(Date.now())}>
                    Start filming
                </Button>
            ) : (
                <Button size="sm" onClick={() => stop(elapsed)}>
                    The bird left the frame
                </Button>
            )}
            <span className="text-slate-400">
                up to {formatDuration(limitSeconds * 1000)}
            </span>
        </div>
    );
};

/** Cards → "On the seekers": the curses still in force, and clearing them. */
export const ActiveCurses = ({
    active,
    custom,
    size,
}: {
    active: CurseEntry[];
    custom: CustomCard[];
    size: GameSize;
}) => {
    const $role = useStore(gameRole);
    const hider = $role === "hider";
    useTick(
        active.some(
            (entry) =>
                curseEndsAt(entry, size) !== null ||
                curseRule(entry.name).stopwatch !== undefined,
        ),
    );
    const now = serverNow();

    return (
        <section className="flex flex-col gap-2">
            <h3 className="font-semibold font-poppins">
                On the seekers ({active.length})
            </h3>
            {active.length === 0 && (
                <p className="text-xs text-slate-400">No active curses.</p>
            )}
            {active.map((entry: CurseEntry) => {
                const curse = CURSES.find((c) => c.name === entry.name);
                const own = custom.find((c) => c.name === entry.name);
                const rule = curseRule(entry.name);
                const endsAt = curseEndsAt(entry, size);
                const stopwatch = rule.stopwatch?.[SIZE_INDEX[size]];
                return (
                    <div
                        key={entry.id}
                        className="flex flex-col gap-1 rounded-md border border-red-500/60 bg-red-950/40 p-2"
                        data-testid="active-curse"
                    >
                        <p className="font-semibold">{entry.name}</p>
                        {curse && (
                            <>
                                <p>
                                    <CardText text={curse.effect} size={size} />
                                </p>
                                <p className="text-xs">
                                    <strong>Casting cost: </strong>
                                    <CardText
                                        text={curse.castingCost}
                                        size={size}
                                    />
                                </p>
                            </>
                        )}
                        {!curse && own && <p>{own.text}</p>}
                        <p className="text-xs text-slate-300">
                            Cast {time(entry.castAt)}
                            {endsAt !== null &&
                                ` · ${formatDuration(Math.max(0, endsAt - now))} left`}
                        </p>
                        {rule.takes === "kinds" && (
                            <p className="text-xs" data-testid="taken-away">
                                {entry.kinds
                                    ? `Taken away: ${entry.kinds.map(kindLabel).join(", ")}.`
                                    : hider
                                      ? "Choose the three questions (the chooser is open)."
                                      : "The hider is choosing the questions you lose."}
                            </p>
                        )}
                        {rule.takes === "category" && (
                            <p className="text-xs">
                                {entry.category
                                    ? `Disabled until the next question: ${CATEGORY_LABELS[entry.category as QuestionCategoryKind]}.`
                                    : "Waiting for the seekers' die (Questions tab)."}
                            </p>
                        )}
                        {rule.blocksAsking && (
                            <p className="text-xs text-amber-300">
                                The seekers can&apos;t ask until it&apos;s
                                cleared.
                            </p>
                        )}
                        {stopwatch !== undefined &&
                            entry.name === "Curse of the Labyrinth" && (
                                <p className="text-xs">
                                    Drawing time left:{" "}
                                    {formatDuration(
                                        Math.max(
                                            0,
                                            entry.castAt +
                                                stopwatch * 60_000 -
                                                now,
                                        ),
                                    )}
                                </p>
                            )}
                        {stopwatch !== undefined &&
                            entry.name === "Curse of the Bird Guide" &&
                            (hider ? (
                                <Stopwatch
                                    curse={entry}
                                    limitSeconds={stopwatch * 60}
                                />
                            ) : (
                                <p className="text-xs">
                                    {entry.seconds === undefined
                                        ? "The hider is filming."
                                        : `Film a bird for at least ${formatDuration(entry.seconds * 1000)}.`}
                                </p>
                            ))}
                        <div className="flex flex-wrap gap-1">
                            {!lastsTheRun(entry.name) && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        void sendOp({
                                            type: "clearCurse",
                                            id: entry.id,
                                        })
                                    }
                                >
                                    Cleared
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}
        </section>
    );
};
