import { useStore } from "@nanostores/react";
import { useState } from "react";
import { toast } from "react-toastify";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl, ToggleCard } from "@/components/ui/toggle-card";
import {
    claimHider,
    currentGameId,
    forgetHider,
    gameConnection,
    gameLink,
    gameRole,
    gameState,
    leaveGame,
    playerName,
    sendOp,
    startGame,
} from "@/lib/game/session";
import type { GameSize } from "@/lib/game/types";
import { shareOrFallback } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";

const CONNECTION_TEXT = {
    off: "Not connected",
    connecting: "Connecting…",
    live: "Live",
    retrying: "Reconnecting…",
};

/** Menu → Game: start, join and set up a shared game. */
export const GamePanel = () => {
    const $gameId = useStore(currentGameId);
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $connection = useStore(gameConnection);
    const $name = useStore(playerName);
    const [claiming, setClaiming] = useState(false);
    const [busy, setBusy] = useState(false);

    if (!$gameId) {
        return (
            <section className="flex flex-col gap-2 rounded-lg border border-blue-500/60 p-3">
                <h3 className="text-sm font-semibold font-poppins">
                    Play together
                </h3>
                <p className="text-xs text-slate-400">
                    Start a shared game: everyone (seekers and hider) opens the
                    same link and sees questions as they&apos;re added and
                    answered. Your play area, settings and questions so far come
                    along.
                </p>
                <NameInput />
                <Button
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await startGame();
                            toast.success(
                                "Shared game started. Send the link to the others.",
                            );
                        } catch (error) {
                            toast.error(errorMessage(error));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    Start a shared game
                </Button>
            </section>
        );
    }

    const shareLink = async () => {
        const result = await shareOrFallback(gameLink());
        if (result === "clipboard") {
            toast.success("Game link copied", { autoClose: 2000 });
        } else if (result === false) {
            toast.info(gameLink());
        }
    };

    return (
        <section className="flex flex-col gap-2 rounded-lg border border-blue-500/60 p-3">
            <h3 className="flex items-center justify-between text-sm font-semibold font-poppins">
                Shared game
                <span
                    className={
                        $connection === "live"
                            ? "text-xs text-green-400"
                            : "text-xs text-amber-400"
                    }
                    data-testid="game-connection"
                >
                    ● {CONNECTION_TEXT[$connection]}
                </span>
            </h3>
            <Button onClick={shareLink}>Share the game link</Button>
            <p className="break-all text-xs text-slate-400">{gameLink()}</p>
            <NameInput />

            <p className="text-sm">
                You&apos;re{" "}
                <strong>{$role === "hider" ? "the hider" : "a seeker"}</strong>
                {$role === "seeker" &&
                    $game?.hasHider &&
                    " (a hider has joined)"}
                .
            </p>
            {$role === "seeker" && !claiming && (
                <Button variant="outline" onClick={() => setClaiming(true)}>
                    I&apos;m the hider
                </Button>
            )}
            {$role === "seeker" && claiming && (
                <form
                    className="flex flex-col gap-2"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        // Read the field itself: the app's inputs report
                        // changes with a delay.
                        const password = String(
                            new FormData(event.currentTarget).get("password"),
                        );
                        try {
                            await claimHider(password);
                            setClaiming(false);
                            toast.success(
                                "You're the hider on this phone. Turn on hider mode in Menu → Hider.",
                            );
                        } catch (error) {
                            toast.error(errorMessage(error));
                        }
                    }}
                >
                    <Label htmlFor="hider-password">
                        {$game?.hasHider
                            ? "Hider password"
                            : "Choose a hider password (seekers won't know it)"}
                    </Label>
                    <input
                        id="hider-password"
                        name="password"
                        type="password"
                        autoComplete="off"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Button type="submit">Become the hider</Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setClaiming(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            )}
            {$role === "hider" && (
                <Button variant="outline" onClick={forgetHider}>
                    Stop being the hider on this phone
                </Button>
            )}

            {$game && (
                <>
                    <Label>Game size</Label>
                    <SegmentedControl<GameSize>
                        label="Game size"
                        options={[
                            { value: "small", label: "Small" },
                            { value: "medium", label: "Medium" },
                            { value: "large", label: "Large" },
                        ]}
                        value={$game.settings.size}
                        onValueChange={(size) =>
                            void sendOp({
                                type: "setSettings",
                                settings: { size },
                            })
                        }
                    />
                    <ToggleCard
                        title="Seekers can answer questions"
                        description={
                            $role === "hider"
                                ? "Off: only you answer, and answered questions are locked for the seekers."
                                : "Only the hider can change this. Off: only the hider answers."
                        }
                        checked={$game.settings.seekersCanAnswer}
                        disabled={$role !== "hider"}
                        onCheckedChange={(seekersCanAnswer) =>
                            void sendOp({
                                type: "setSettings",
                                settings: { seekersCanAnswer },
                            })
                        }
                    />
                </>
            )}

            <div className="grid grid-cols-2 gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline">New round</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Start a new round?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                The questions, photo questions and curses of
                                this round are put away (kept with the game),
                                and the next hider sets a new password. The play
                                area and settings stay.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() =>
                                    void sendOp({ type: "newRound" })
                                }
                            >
                                New round
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" onClick={leaveGame}>
                    Leave game
                </Button>
            </div>
            {$name === "" && (
                <p className="text-xs text-amber-400">
                    Add your name so the others see who changed what.
                </p>
            )}
        </section>
    );
};

const NameInput = () => {
    const $name = useStore(playerName);
    return (
        <>
            <Label htmlFor="player-name">Your name</Label>
            <Input
                id="player-name"
                value={$name}
                maxLength={40}
                placeholder="Shown to the others"
                onChange={(e) => playerName.set(e.target.value)}
            />
        </>
    );
};
