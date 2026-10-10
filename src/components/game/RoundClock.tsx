import { useStore } from "@nanostores/react";

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
import { useTick } from "@/hooks/useTick";
import { endgame } from "@/lib/context";
import { clockState, formatDuration, hidingTimeMs } from "@/lib/game/clock";
import { handBonusMinutes } from "@/lib/game/deck";
import { bonusMinutes, hand } from "@/lib/game/hand";
import { serverNow } from "@/lib/game/serverTime";
import { gameRole, gameState, sendOp } from "@/lib/game/session";
import type { ClockAction } from "@/lib/game/types";

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
    // The clock runs on the server's time, so every phone shows the same.
    const elapsed = formatDuration(hidingTimeMs(clock, serverNow()));
    const bonus = clock?.bonusMinutes;
    const total =
        bonus === undefined
            ? null
            : formatDuration(hidingTimeMs(clock, serverNow()) + bonus * 60_000);
    // Digital deck: the game knows the hand; real deck: this phone's record.
    const mine = $game.deck
        ? handBonusMinutes(
              $game.deck.hand,
              $game.settings.size,
              $game.settings.customCards,
          )
        : bonusMinutes($hand);
    // Minutes awarded during the round (a curse's penalty) count too.
    const awarded = ($game.awards ?? []).reduce(
        (sum, award) => sum + award.minutes,
        0,
    );
    /** "+21:00": the bonuses in the hider's hand, if caught right now. */
    const bonusTag =
        $role === "hider" ? (
            <span
                className="font-mono text-sm text-green-300"
                title={`Time bonuses in your hand${awarded ? ` and ${awarded} min awarded` : ""}, added if you're caught now`}
                data-testid="clock-bonus"
            >
                +{formatDuration((mine + awarded) * 60_000)}
            </span>
        ) : null;

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
                    {bonusTag}
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
                    {bonusTag}
                    <span className="text-slate-300">paused</span>
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
                            Send my bonuses ({mine} min
                            {awarded ? ` + ${awarded} awarded` : ""})
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
