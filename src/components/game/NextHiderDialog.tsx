import { useStore } from "@nanostores/react";
import { atom } from "nanostores";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { clockState } from "@/lib/game/clock";
import { gameRole, gameState, playerName, sendOp } from "@/lib/game/session";

/** Opens the "who hides next?" popup (Menu → Game, the clock). */
export const nextHiderOpen = atom(false);

/**
 * After a round, with teams: everyone's phone asks who hides next. One
 * team claims it; then anyone starts the new round, and everyone says who
 * they are again (the new hiders set a new password).
 */
export const NextHiderDialog = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $name = useStore(playerName);
    const $requested = useStore(nextHiderOpen);
    const [open, setOpen] = useState(false);
    const askedFor = useRef<number | null>(null);
    const clock = $game?.clock ?? null;
    const over = clockState(clock) === "stopped";
    const teams = $game?.teams ?? [];
    const bonusesSent = clock?.bonusMinutes !== undefined;
    const stoppedAt = clock?.stoppedAt ?? null;

    // Once per finished round; the hider's found popup comes first.
    useEffect(() => {
        if (!over || teams.length === 0 || stoppedAt === null) return;
        if ($role === "hider" && !bonusesSent) return;
        if (askedFor.current === stoppedAt) return;
        askedFor.current = stoppedAt;
        setOpen(true);
    }, [over, teams.length, stoppedAt, $role, bonusesSent]);
    useEffect(() => {
        if ($requested) {
            nextHiderOpen.set(false);
            setOpen(true);
        }
    }, [$requested]);
    // A new round began (on any phone): the question is settled.
    const rounds = $game?.rounds.length ?? 0;
    useEffect(() => setOpen(false), [rounds]);

    if (!$game || teams.length === 0) return null;
    const me = $name.trim();
    const mine = teams.find((team) => team.members.includes(me));
    const next = teams.find((team) => team.id === $game.nextHiderTeamId);
    const round = $game.rounds.length + 1;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                className="!bg-[hsl(var(--sidebar-background))] !text-white"
                data-testid="next-hider-dialog"
            >
                <DialogHeader>
                    <DialogTitle>Who hides next?</DialogTitle>
                    <DialogDescription>
                        {over
                            ? `Round ${round} is over. `
                            : `Round ${round} is still on. `}
                        One team claims the next round; then anyone starts it,
                        and everyone says who they are again.
                    </DialogDescription>
                </DialogHeader>
                <ul className="flex flex-col gap-1 text-sm">
                    {teams.map((team) => (
                        <li
                            key={team.id}
                            className="flex justify-between gap-2"
                        >
                            <span>
                                <strong>{team.name}</strong>{" "}
                                <span className="text-xs text-slate-400">
                                    {team.members.join(", ")}
                                </span>
                            </span>
                            {next?.id === team.id && (
                                <span className="text-xs text-amber-300">
                                    hides next
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
                <div className="flex flex-col gap-2">
                    {!next && mine && over && (
                        <Button
                            onClick={() =>
                                void sendOp({
                                    type: "claimNextRound",
                                    teamId: mine.id,
                                })
                            }
                        >
                            We hide next ({mine.name})
                        </Button>
                    )}
                    {!next && !mine && (
                        <p className="text-xs text-slate-400">
                            You&apos;re in no team: join one in Menu → Game to
                            claim a round.
                        </p>
                    )}
                    {next && mine?.id === next.id && (
                        <Button
                            variant="outline"
                            onClick={() =>
                                void sendOp({
                                    type: "claimNextRound",
                                    teamId: null,
                                })
                            }
                        >
                            Withdraw
                        </Button>
                    )}
                    {next && (
                        <Button
                            onClick={async () => {
                                await sendOp({ type: "newRound" });
                                setOpen(false);
                            }}
                        >
                            Start the new round
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Later
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
