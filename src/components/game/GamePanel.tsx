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
import { ToggleCard } from "@/components/ui/toggle-card";
import { gameSettings } from "@/lib/context";
import {
    currentGameId,
    gameConnection,
    gameLink,
    gameRole,
    gameState,
    leaveGame,
    playerName,
    sendOp,
} from "@/lib/game/session";
import { describeStations, questionKey } from "@/lib/game/settings";
import type { GameSettings } from "@/lib/game/types";
import { shareOrFallback } from "@/lib/utils";

import { GameSetupDialog } from "./GameSetupDialog";

const CONNECTION_TEXT = {
    off: "Not connected",
    connecting: "Connecting…",
    live: "Live",
    retrying: "Reconnecting…",
};

const SIZE_NAMES = { small: "Small", medium: "Medium", large: "Large" };

/** The settings in a few lines. */
const SettingsSummary = ({ settings }: { settings: GameSettings }) => (
    <dl
        className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-300"
        data-testid="game-settings-summary"
    >
        <dt>Size</dt>
        <dd>
            {SIZE_NAMES[settings.size]},{" "}
            {settings.region === "switzerland" ? "Swiss" : "standard"} rules
        </dd>
        <dt>Hiding zones</dt>
        <dd>
            {settings.hidingRadiusKm} km around{" "}
            {describeStations(settings.stationKinds)}
        </dd>
        <dt>Questions</dt>
        <dd>
            {settings.disabledQuestions.length === 0
                ? "all"
                : `all but ${settings.disabledQuestions.length}`}
            {!settings.disabledQuestions.includes(
                questionKey("measuring", "lake"),
            ) && `; lakes from ${settings.minLakeAreaKm2} km²`}
        </dd>
    </dl>
);

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

/** Menu → Game: the game's settings, and starting or running a shared game. */
export const GamePanel = () => {
    const $gameId = useStore(currentGameId);
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $connection = useStore(gameConnection);
    const $name = useStore(playerName);
    const $settings = useStore(gameSettings);
    const [setup, setSetup] = useState<"solo" | "start" | null>(null);

    const settings = $game?.settings ?? $settings;

    if (!$gameId) {
        return (
            <>
                <section className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3">
                    <h3 className="text-sm font-semibold font-poppins">
                        Game settings
                    </h3>
                    <SettingsSummary settings={settings} />
                    <Button variant="outline" onClick={() => setSetup("solo")}>
                        Change game settings
                    </Button>
                </section>
                <section className="flex flex-col gap-2 rounded-lg border border-blue-500/60 p-3">
                    <h3 className="text-sm font-semibold font-poppins">
                        Play together
                    </h3>
                    <p className="text-xs text-slate-400">
                        Everyone (seekers and hider) opens one link and sees
                        questions as they&apos;re added and answered. The
                        settings are decided when the game starts.
                    </p>
                    <NameInput />
                    <Button onClick={() => setSetup("start")}>
                        Start a shared game
                    </Button>
                </section>
                <GameSetupDialog
                    open={setup !== null}
                    onOpenChange={(open) => !open && setSetup(null)}
                    mode={setup ?? "solo"}
                />
            </>
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
            <p className="text-sm" data-testid="game-role">
                {$role === "hider" ? (
                    <>
                        You&apos;re <strong>the hider</strong> in this game.
                    </>
                ) : (
                    <>
                        You&apos;re <strong>a seeker</strong>
                        {$game?.hasHider && " (a hider has joined)"}. To be the
                        hider: Menu → Hider.
                    </>
                )}
            </p>

            <h4 className="text-xs font-semibold font-poppins text-slate-300">
                Settings (fixed for this game)
            </h4>
            <SettingsSummary settings={settings} />
            {$game && $role === "hider" && (
                <>
                    <Label htmlFor="game-hiding-radius">
                        Hiding zone radius (km): the hider can change it
                    </Label>
                    <Input
                        id="game-hiding-radius"
                        type="number"
                        inputMode="decimal"
                        min={0.1}
                        max={50}
                        step={0.1}
                        value={$game.settings.hidingRadiusKm}
                        onChange={(event) => {
                            const hidingRadiusKm = Number(event.target.value);
                            if (
                                hidingRadiusKm > 0 &&
                                hidingRadiusKm <= 50 &&
                                hidingRadiusKm !== $game.settings.hidingRadiusKm
                            ) {
                                void sendOp({
                                    type: "setSettings",
                                    settings: { hidingRadiusKm },
                                });
                            }
                        }}
                    />
                    <ToggleCard
                        title="Seekers can answer questions"
                        description="Off: only you answer, and answered questions are locked for the seekers."
                        checked={$game.settings.seekersCanAnswer}
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
