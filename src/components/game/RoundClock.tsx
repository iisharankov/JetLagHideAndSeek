import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { endgame } from "@/lib/context";
import { clockState, formatDuration, hidingTimeMs } from "@/lib/game/clock";
import { handBonusMinutes } from "@/lib/game/deck";
import { bonusMinutes, hand } from "@/lib/game/hand";
import { gameRole, gameState, sendOp } from "@/lib/game/session";
import type { ClockAction } from "@/lib/game/types";

/** Re-renders every second while the clock runs. */
const useTick = (running: boolean) => {
    const [, setNow] = useState(Date.now());
    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [running]);
};

/**
 * The round's hiding clock, at the top of the sidebar in a shared game:
 * anyone starts it when the seekers set off, the hider pauses it for a
 * Move, the seekers stop it when they've found the hider, and the hider
 * then adds the time bonuses from their hand.
 */
export const RoundClock = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $hand = useStore(hand);
    const $endgame = useStore(endgame);
    const clock = $game?.clock ?? null;
    const state = clockState(clock);
    useTick(state === "running");
    if (!$game) return null;

    const act = (action: ClockAction) => void sendOp({ type: "clock", action });
    const elapsed = formatDuration(hidingTimeMs(clock));
    const bonus = clock?.bonusMinutes;
    const total =
        bonus === undefined
            ? null
            : formatDuration(hidingTimeMs(clock) + bonus * 60_000);
    // Virtual deck: the game knows the hand; real deck: this phone's record.
    const mine = $game.deck
        ? handBonusMinutes($game.deck.hand, $game.settings.size)
        : bonusMinutes($hand);

    return (
        <div
            className="mx-2 my-1 flex flex-wrap items-center justify-center gap-2 rounded-md bg-slate-800/70 px-2 py-1 text-xs"
            data-testid="round-clock"
            data-state={state}
        >
            {state === "idle" && (
                <>
                    <span className="text-slate-300">
                        Hiding clock: not started
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        title="When the seekers start searching"
                        onClick={() => act("start")}
                    >
                        Start
                    </Button>
                </>
            )}
            {state === "running" && (
                <>
                    <span className="font-mono text-base">⏱ {elapsed}</span>
                    {$role === "hider" ? (
                        <Button
                            size="sm"
                            variant="outline"
                            title="A Move pauses the clock"
                            onClick={() => act("pause")}
                        >
                            Pause
                        </Button>
                    ) : (
                        // Only once the seekers have picked the station (the
                        // end game): no stopping the clock on a hunch.
                        $endgame && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm">Found!</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Found the hider?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Stops the hiding clock at {elapsed}{" "}
                                            for everyone. The hider then adds
                                            their time bonuses.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Not yet
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => act("stop")}
                                        >
                                            Yes, found
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )
                    )}
                </>
            )}
            {state === "paused" && (
                <>
                    <span className="font-mono text-base">⏸ {elapsed}</span>
                    <span className="text-slate-300">paused (Move)</span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act("resume")}
                    >
                        Resume
                    </Button>
                </>
            )}
            {state === "stopped" && (
                <>
                    <span>
                        Found after <strong>{elapsed}</strong>
                        {total && (
                            <>
                                {" "}
                                + {bonus} min bonuses = <strong>{total}</strong>
                            </>
                        )}
                    </span>
                    {$role === "hider" && bonus === undefined && (
                        <Button
                            size="sm"
                            onClick={() =>
                                void sendOp({ type: "setBonus", minutes: mine })
                            }
                        >
                            Send my bonuses ({mine} min)
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        title="For mistakes; a new round also clears it"
                        onClick={() => act("reset")}
                    >
                        Reset
                    </Button>
                </>
            )}
        </div>
    );
};
