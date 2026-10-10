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
import { showUndoToast } from "@/components/undoToast";
import { useTick } from "@/hooks/useTick";
import {
    additionalMapGeoLocations,
    gameSettings,
    mapGeoLocation,
    polyGeoJSON,
    questions,
    setupDialog,
} from "@/lib/context";
import { clearBackup, readBackup, writeBackup } from "@/lib/game/backup";
import { formatDuration } from "@/lib/game/clock";
import { deckComposition } from "@/lib/game/deck";
import { knownGames } from "@/lib/game/knownGames";
import { ranking, scoreRows } from "@/lib/game/scoreboard";
import { serverNow } from "@/lib/game/serverTime";
import {
    activeGameId,
    currentGameId,
    deleteGame,
    forgetLastGame,
    gameConnection,
    gameLink,
    gameRole,
    gameState,
    joinGame,
    lastUpdateAt,
    leaveGame,
    playerName,
    reconnectAt,
    sendOp,
} from "@/lib/game/session";
import { describeStations, questionKey } from "@/lib/game/settings";
import type { GameSettings, GameState } from "@/lib/game/types";
import { currentPlayArea, parsePlayArea, playAreaName } from "@/lib/sharedGame";
import { shareOrFallback } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";

import { HiderToggle } from "./HiderToggle";

const CONNECTION_TEXT = {
    off: "Not connected",
    connecting: "Connecting…",
    live: "Live",
    retrying: "Reconnecting…",
};

const SIZE_NAMES = { small: "Small", medium: "Medium", large: "Large" };
const kmLabel = (km: number) => (km < 1 ? `${km * 1000} m` : `${km} km`);

/** The settings in a few lines. */
const SettingsSummary = ({
    settings,
    playArea,
}: {
    settings: GameSettings;
    playArea: string;
}) => (
    <dl
        className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-300"
        data-testid="game-settings-summary"
    >
        <dt>Play area</dt>
        <dd data-testid="play-area-name">{playArea}</dd>
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
        <dt>Radar</dt>
        <dd>{settings.radarKm.map(kmLabel).join(", ")}</dd>
        <dt>Questions</dt>
        <dd>
            {settings.disabledQuestions.length === 0
                ? "all"
                : `all but ${settings.disabledQuestions.length}`}
            {!settings.disabledQuestions.includes(
                questionKey("measuring", "lake"),
            ) && `; lakes from ${settings.minLakeAreaKm2} km²`}
        </dd>
        <dt>Deck</dt>
        <dd>
            {settings.deck === "virtual"
                ? "digital (the app deals)"
                : "physical cards"}
            , {deckComposition(settings).length} cards
        </dd>
        <dt>Seekers</dt>
        <dd>
            {settings.seekersSeeStations
                ? "may show the hiding zones"
                : "don't get the hiding zones"}
        </dd>
    </dl>
);

/** The play area in words, from the game or from this phone. */
const usePlayAreaName = (game: GameState | null) => {
    // Subscribed, so the name follows the picker.
    useStore(polyGeoJSON);
    useStore(mapGeoLocation);
    useStore(additionalMapGeoLocations);
    if (game) {
        try {
            return playAreaName(parsePlayArea(game.playArea));
        } catch {
            return "unknown";
        }
    }
    return playAreaName(currentPlayArea());
};

const ago = (time: number) => {
    const seconds = Math.round((Date.now() - time) / 1000);
    if (seconds < 60) return `${seconds} s ago`;
    const minutes = Math.round(seconds / 60);
    return minutes < 60
        ? `${minutes} min ago`
        : `${Math.round(minutes / 60)} h ago`;
};

/** Live, or reconnecting: since when, and when the next try is. */
const ConnectionStatus = () => {
    const $connection = useStore(gameConnection);
    const $last = useStore(lastUpdateAt);
    const $next = useStore(reconnectAt);
    useTick($connection === "retrying");
    const retrying = $connection === "retrying";
    const nextIn = $next
        ? Math.max(0, Math.ceil(($next - Date.now()) / 1000))
        : null;
    return (
        <span
            className={
                $connection === "live"
                    ? "text-xs text-green-400"
                    : "text-xs text-amber-400"
            }
            data-testid="game-connection"
        >
            ● {CONNECTION_TEXT[$connection]}
            {retrying &&
                ` (last update ${$last ? ago($last) : "never"}${
                    nextIn !== null ? `, next try in ${nextIn} s` : ""
                })`}
        </span>
    );
};

/** Each round's hiding time plus bonuses; the best round of each hider wins. */
const Scoreboard = ({ game }: { game: GameState }) => {
    const rows = scoreRows(game, serverNow());
    useTick(rows.some((row) => row.current));
    const [open, setOpen] = useState(true);
    if (rows.length === 0) return null;
    const best = ranking(rows);
    return (
        <section
            className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3"
            data-testid="scoreboard"
        >
            <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-semibold font-poppins"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
            >
                <span>Scoreboard</span>
                <span aria-hidden="true">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
                <>
                    <table className="w-full text-xs">
                        <thead className="text-slate-400">
                            <tr>
                                <th className="text-left font-normal">Round</th>
                                <th className="text-left font-normal">Hider</th>
                                <th className="text-right font-normal">
                                    Hiding
                                </th>
                                <th className="text-right font-normal">
                                    Bonus
                                </th>
                                <th className="text-right font-normal">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.round}
                                    data-current={row.current || undefined}
                                >
                                    <td>
                                        {row.round}
                                        {row.current && " (playing)"}
                                    </td>
                                    <td>{row.hider}</td>
                                    <td className="text-right font-mono">
                                        {formatDuration(row.hidingMs)}
                                    </td>
                                    <td className="text-right font-mono">
                                        {row.bonusMinutes
                                            ? `+${row.bonusMinutes} min`
                                            : "–"}
                                    </td>
                                    <td className="text-right font-mono">
                                        {formatDuration(row.totalMs)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {best.length > 0 && (
                        <p className="text-xs text-slate-300">
                            Best rounds:{" "}
                            {best
                                .map(
                                    (row, index) =>
                                        `${index + 1}. ${row.hider} ${formatDuration(row.totalMs)} (round ${row.round})`,
                                )
                                .join(" · ")}
                        </p>
                    )}
                </>
            )}
        </section>
    );
};

/** The questions this phone had before it joined a game, to bring back. */
const EarlierQuestions = () => {
    const [backup, setBackup] = useState(() => readBackup());
    if (!backup) return null;
    const restore = () => {
        const before = questions.get();
        const kept = backup;
        questions.set(kept);
        clearBackup();
        setBackup(null);
        showUndoToast("Your earlier questions are back.", () => {
            questions.set(before);
            writeBackup(kept);
            setBackup(kept);
        });
    };
    return (
        <section
            className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3"
            data-testid="earlier-questions"
        >
            <p className="text-sm">
                Your {backup.length} question{backup.length === 1 ? "" : "s"}{" "}
                from before the game {backup.length === 1 ? "is" : "are"} kept.
            </p>
            <div className="grid grid-cols-2 gap-2">
                <Button onClick={restore}>Restore them</Button>
                <Button
                    variant="outline"
                    onClick={() => {
                        clearBackup();
                        setBackup(null);
                    }}
                >
                    Forget them
                </Button>
            </div>
            <p className="text-xs text-slate-400">
                Restoring replaces the questions you have now (undo for a few
                seconds).
            </p>
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

const when = (time: number) =>
    new Date(time).toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

/** Menu → Game → Your games: every shared game this phone has been in. */
const GamesList = () => {
    const $known = useStore(knownGames);
    const $gameId = useStore(activeGameId);
    const [open, setOpen] = useState(false);
    const games = Object.values($known).sort((a, b) => b.lastSeen - a.lastSeen);
    if (games.length === 0) return null;

    const remove = async (id: string) => {
        try {
            await deleteGame(id);
            toast.success("Game deleted.", { autoClose: 2000 });
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    return (
        <section
            className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3"
            data-testid="games-list"
        >
            <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-semibold font-poppins"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
            >
                <span>Your games ({games.length})</span>
                <span aria-hidden="true">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
                <>
                    <ul className="flex flex-col gap-2">
                        {games.map((game) => (
                            <li
                                key={game.id}
                                className="flex flex-col gap-1 rounded-md bg-slate-800/60 p-2 text-xs"
                            >
                                <p>
                                    <strong>
                                        {game.area || "Unknown area"}
                                    </strong>
                                    {game.id === $gameId && " · you're in it"}
                                </p>
                                <p className="text-slate-400">
                                    Joined {when(game.joinedAt)} · last seen{" "}
                                    {when(game.lastSeen)} ·{" "}
                                    <span className="font-mono">{game.id}</span>
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={game.id === $gameId}
                                        onClick={() => joinGame(game.id)}
                                    >
                                        Rejoin
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                            >
                                                Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    Delete this game for
                                                    everyone?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Its questions, photos and
                                                    curses are removed from the
                                                    server; phones still in it
                                                    are dropped out. This
                                                    can&apos;t be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>
                                                    Keep it
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() =>
                                                        void remove(game.id)
                                                    }
                                                >
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-slate-400">
                        The server keeps a game until someone deletes it or a
                        year passes without changes; it doesn&apos;t know who
                        still has it open. Leaving only forgets it on this
                        phone.
                    </p>
                </>
            )}
        </section>
    );
};

/** Menu → Game: the game's settings, and starting or running a shared game. */
export const GamePanel = () => {
    const $gameId = useStore(activeGameId);
    const $lastGameId = useStore(currentGameId);
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $name = useStore(playerName);
    const $settings = useStore(gameSettings);

    const settings = $game?.settings ?? $settings;
    const playArea = usePlayAreaName($game);

    if (!$gameId) {
        return (
            <>
                {$lastGameId && (
                    <section
                        className="flex flex-col gap-2 rounded-lg border border-amber-500/60 p-3"
                        data-testid="rejoin-game"
                    >
                        <p className="text-sm">
                            You were in a shared game (
                            <span className="font-mono">{$lastGameId}</span>).
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={() => joinGame($lastGameId)}>
                                Rejoin it
                            </Button>
                            <Button variant="outline" onClick={forgetLastGame}>
                                Forget it
                            </Button>
                        </div>
                        <p className="text-xs text-slate-400">
                            Either way your copy of the questions stays on this
                            phone (the others may still be playing). To start
                            fresh: Clear all questions, in the sidebar.
                        </p>
                    </section>
                )}
                <section className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3">
                    <h3 className="text-sm font-semibold font-poppins">
                        Game settings
                    </h3>
                    <SettingsSummary settings={settings} playArea={playArea} />
                    <Button
                        variant="outline"
                        onClick={() => setupDialog.set("solo")}
                    >
                        Change game settings
                    </Button>
                </section>
                <EarlierQuestions />
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
                    <Button onClick={() => setupDialog.set("start")}>
                        Start a shared game
                    </Button>
                </section>
                <GamesList />
                <section className="flex flex-col gap-2 rounded-lg border border-yellow-500/50 p-3">
                    <h3 className="text-sm font-semibold font-poppins">
                        Playing alone
                    </h3>
                    <HiderToggle />
                </section>
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
            <h3 className="flex items-center justify-between gap-2 text-sm font-semibold font-poppins">
                Shared game
                <ConnectionStatus />
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
                        {$game?.hasHider && " (a hider has joined)"}.
                    </>
                )}
            </p>
            <p className="text-xs text-slate-400">
                Chosen when you joined. Leave the game and open its link again
                to join as someone else.
            </p>

            {$game && <Scoreboard game={$game} />}
            <h4 className="text-xs font-semibold font-poppins text-slate-300">
                Settings (fixed for this game)
            </h4>
            <SettingsSummary settings={settings} playArea={playArea} />
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
            <p className="text-xs text-slate-400">
                Leaving keeps your copy of the questions; the game goes on for
                the others.
            </p>
            <GamesList />
            {$name === "" && (
                <p className="text-xs text-amber-400">
                    Add your name so the others see who changed what.
                </p>
            )}
        </section>
    );
};
