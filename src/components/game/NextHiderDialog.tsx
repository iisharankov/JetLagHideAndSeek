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
import { gameRole, gameState, myPlayerId, sendOp } from "@/lib/game/session";

/** Opens the "who hides next?" popup (Menu → Game, the clock). */
export const nextHiderOpen = atom(false);

/**
 * After a round, with teams: everyone's phone asks who hides next. One
 * team claims it; then anyone starts the new round, and that team's
 * members are the hiders (nobody types anything).
 */
export const NextHiderDialog = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $me = useStore(myPlayerId);
    const $requested = useStore(nextHiderOpen);
    const [open, setOpen] = useState(false);
    const askedFor = useRef<number | null>(null);
    const clock = $game?.clock ?? null;
    const over = clockState(clock) === "stopped";
    // Claiming: once the round is over, or when it never got going.
    const claimable = !["running", "paused"].includes(clockState(clock));
    // Only games with the Teams setting hand rounds from team to team.
    const teams = $game?.settings.teams ? $game.teams : [];
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
    const mine = $me
        ? teams.find((team) => team.members.includes($me))
        : undefined;
    const names = (ids: string[]) =>
        ids
            .map((id) => $game.players[id])
            .filter((player) => player && !player.left)
            .map((player) => player!.name)
            .join(", ");
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
                            : claimable
                              ? `Round ${round} hasn't got going. `
                              : `Round ${round} is still on. `}
                        One team claims the next round; then anyone starts it,
                        and that team&apos;s phones are the hiders&apos;.
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
                                    {names(team.members)}
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
                    {!next && mine && claimable && (
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
                            You&apos;re in no team: pick one in Menu → Game to
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
