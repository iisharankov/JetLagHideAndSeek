import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";

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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTick } from "@/hooks/useTick";
import { endgame } from "@/lib/context";
import { clockState, formatDuration, hidingTimeMs } from "@/lib/game/clock";
import { handBonusMinutes } from "@/lib/game/deck";
import { bonusMinutes, hand } from "@/lib/game/hand";
import { serverNow } from "@/lib/game/serverTime";
import { gameRole, gameState, sendOp } from "@/lib/game/session";
import type { ClockAction } from "@/lib/game/types";

import { nextHiderOpen } from "./NextHiderDialog";

/**
 * Found: the hider's phone asks for minutes awarded during the round (a
 * curse's penalty) before the time bonuses go out.
 */
const FoundDialog = ({
    open,
    onOpenChange,
    elapsed,
    mine,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    elapsed: string;
    mine: number;
}) => {
    const [award, setAward] = useState("");
    const [reason, setReason] = useState("");
    const extra = Math.max(0, Math.round(Number(award) || 0));
    const send = async () => {
        if (extra > 0) {
            await sendOp({
                type: "awardMinutes",
                minutes: extra,
                reason: reason.trim() || "Added at the end of the round",
            });
        }
        await sendOp({ type: "setBonus", minutes: mine });
        onOpenChange(false);
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="!bg-[hsl(var(--sidebar-background))] !text-white"
                data-testid="found-dialog"
            >
                <DialogHeader>
                    <DialogTitle>Found after {elapsed}</DialogTitle>
                    <DialogDescription>
                        Your hand gives {mine} min of time bonuses. Were you
                        awarded minutes during the round (a curse&apos;s
                        penalty: the egg cracked, the lemon dropped…)? Add them
                        here; they count for the scoreboard.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void send();
                    }}
                >
                    <Label htmlFor="awarded-minutes">Awarded minutes</Label>
                    <Input
                        id="awarded-minutes"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={600}
                        placeholder="0"
                        value={award}
                        debounce={0}
                        onChange={(event) => setAward(event.target.value)}
                    />
                    <Label htmlFor="awarded-reason">Why (optional)</Label>
                    <Input
                        id="awarded-reason"
                        type="text"
                        placeholder="Curse of the Egg Partner: the egg cracked"
                        value={reason}
                        debounce={0}
                        onChange={(event) => setReason(event.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Button type="submit">
                            Send my bonuses ({mine + extra} min)
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Later
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
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
    // Found: the hider is asked once per stop for awarded minutes.
    const bonus = clock?.bonusMinutes;
    const stoppedAt = clock?.stoppedAt ?? null;
    const [asking, setAsking] = useState(false);
    const askedFor = useRef<number | null>(null);
    useEffect(() => {
        if (
            $role === "hider" &&
            state === "stopped" &&
            bonus === undefined &&
            stoppedAt !== null &&
            askedFor.current !== stoppedAt
        ) {
            askedFor.current = stoppedAt;
            setAsking(true);
        }
    }, [$role, state, bonus, stoppedAt]);
    if (!$game) return null;

    const act = (action: ClockAction) => void sendOp({ type: "clock", action });
    // Pausing and resuming take both sides: one asks, the other agrees.
    const request = $game.clockRequest;
    const otherSide = $role === "hider" ? "the seekers" : "the hider";
    // The clock runs on the server's time, so every phone shows the same.
    const elapsed = formatDuration(hidingTimeMs(clock, serverNow()));
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
        $role === "hider" && mine + awarded > 0 ? (
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
                    <Button
                        size="sm"
                        variant="outline"
                        title="Both sides must agree to a pause (a Move pauses by itself)"
                        onClick={() => act("pause")}
                    >
                        Pause
                    </Button>
                    {$role === "seeker" &&
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
                        )}
                </>
            )}
            {request && (
                <p
                    className="basis-full text-center"
                    data-testid="clock-request"
                >
                    {request.role === $role ? (
                        <>
                            Waiting for {otherSide} to {request.action} too.{" "}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => act("cancel")}
                            >
                                Withdraw
                            </Button>
                        </>
                    ) : (
                        <>
                            <strong>{request.by}</strong> asks to{" "}
                            {request.action} the clock.{" "}
                            <Button
                                size="sm"
                                onClick={() => act(request.action)}
                            >
                                {request.action === "pause"
                                    ? "Pause"
                                    : "Resume"}{" "}
                                too
                            </Button>{" "}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => act("cancel")}
                            >
                                Decline
                            </Button>
                        </>
                    )}
                </p>
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
                        <>
                            <Button size="sm" onClick={() => setAsking(true)}>
                                Send my bonuses…
                            </Button>
                            <FoundDialog
                                open={asking}
                                onOpenChange={setAsking}
                                elapsed={elapsed}
                                mine={mine}
                            />
                        </>
                    )}
                    {$game.teams.length > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => nextHiderOpen.set(true)}
                        >
                            Who hides next?
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
