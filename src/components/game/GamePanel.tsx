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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleCard } from "@/components/ui/toggle-card";
import { useTick } from "@/hooks/useTick";
import {
    additionalMapGeoLocations,
    gameSettings,
    mapGeoLocation,
    polyGeoJSON,
    setupDialog,
} from "@/lib/context";
import { formatDuration } from "@/lib/game/clock";
import { enterCode, forgetCode, myCode } from "@/lib/game/codes";
import { deckComposition } from "@/lib/game/deck";
import { downloadGame } from "@/lib/game/download";
import { knownGames } from "@/lib/game/knownGames";
import { activePlayers, formatCode, playerStale } from "@/lib/game/players";
import { describeRest } from "@/lib/game/rest";
import { ranking, scoreRows } from "@/lib/game/scoreboard";
import { serverNow } from "@/lib/game/serverTime";
import {
    activeGameId,
    currentGameId,
    deleteGame,
    forgetGameHere,
    forgetLastGame,
    gameConnection,
    gameLink,
    gameRole,
    gameState,
    joinGame,
    lastUpdateAt,
    leaveGame,
    myPlayer,
    organiserTokens,
    playerName,
    reconnectAt,
    removePlayer,
    renameInGame,
    sendOp,
    setHiding,
} from "@/lib/game/session";
import {
    describeStations,
    questionKey,
    REGION_LABELS,
} from "@/lib/game/settings";
import type { GameSettings, GameState, Player } from "@/lib/game/types";
import { currentPlayArea, parsePlayArea, playAreaName } from "@/lib/sharedGame";
import { shareOrFallback } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";

import { nextHiderOpen } from "./NextHiderDialog";
import { teamBody, type TeamChoice, TeamPicker } from "./TeamPicker";

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
            {SIZE_NAMES[settings.size]}, {REGION_LABELS[settings.region]} rules
        </dd>
        <dt>Hiding zones</dt>
        <dd>
            {settings.hidingRadiusKm} km around{" "}
            {describeStations(settings.stationKinds)}
        </dd>
        <dt>Radar</dt>
        <dd>{settings.radarKm.map(kmLabel).join(", ")}</dd>
        <dt>Thermometer</dt>
        <dd>{settings.thermometerKm.map(kmLabel).join(", ")}</dd>
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
        <dt>Teams</dt>
        <dd>
            {settings.teams
                ? "on: everyone joins a team, with its password"
                : "off: everyone plays alone"}
        </dd>
        <dt>Rest</dt>
        <dd data-testid="rest-summary">
            {settings.rest
                ? `${describeRest(settings.rest)}, the clock pauses by itself`
                : "none"}
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

/** Menu → Game: the player's team, and switching (with the other team's password). */
const TeamLine = ({ game, me }: { game: GameState; me: Player }) => {
    const mine = game.teams.find((team) => team.id === me.teamId);
    const [open, setOpen] = useState(false);
    const [choice, setChoice] = useState<TeamChoice | null>(null);
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const value: TeamChoice | null =
        choice ??
        (mine ? { kind: "existing", id: mine.id, name: mine.name } : null);
    const save = async () => {
        if (!value || (value.kind === "existing" && value.id === mine?.id)) {
            setOpen(false);
            return;
        }
        if (value.kind === "new" && !value.name.trim()) {
            toast.error("Give the team a name.");
            return;
        }
        setBusy(true);
        const body = teamBody(value, password);
        try {
            await sendOp({
                type: "joinTeam",
                name: value.kind === "new" ? value.name.trim() : value.name,
                password: body.password,
            });
            if (gameState.get()?.players[me.id]?.teamId !== me.teamId) {
                setOpen(false);
            }
        } finally {
            setBusy(false);
        }
    };
    return (
        <div
            className="flex items-center justify-between gap-2 text-sm"
            data-testid="team-line"
        >
            <span>
                {mine ? (
                    <>
                        Team <strong>{mine.name}</strong>
                        {mine.id === game.hiderTeamId && " (hiding)"}
                    </>
                ) : (
                    "No team"
                )}
            </span>
            <Button
                size="sm"
                variant="outline"
                onClick={() => {
                    setChoice(null);
                    setPassword("");
                    setOpen(true);
                }}
            >
                Switch team…
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                    <DialogHeader>
                        <DialogTitle>Your team</DialogTitle>
                        <DialogDescription>
                            Teams hide and seek together: one team hides a
                            round, the others seek. Another team needs its
                            password; a new one needs one of its own.
                        </DialogDescription>
                    </DialogHeader>
                    <TeamPicker
                        teams={game.teams}
                        players={game.players}
                        hiderTeamId={game.hiderTeamId}
                        mine={mine?.id ?? null}
                        value={value}
                        onChange={(next) => {
                            // Another team, another password.
                            if (
                                next.kind !== value?.kind ||
                                (next.kind === "existing" &&
                                    value.kind === "existing" &&
                                    next.id !== value.id)
                            ) {
                                setPassword("");
                            }
                            setChoice(next);
                        }}
                        password={password}
                        onPasswordChange={setPassword}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Button disabled={busy} onClick={() => void save()}>
                            Save
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

/**
 * Menu → Game: who this phone is, and the code that moves the player to
 * another phone (or back, after the browser forgot it).
 */
const PlayerCard = ({
    game,
    me,
    hider,
}: {
    game: GameState;
    me: Player;
    hider: boolean;
}) => {
    const team = game.teams.find((t) => t.id === me.teamId);
    const someoneHides = activePlayers(game).some((p) => p.hider);
    const shareCode = async () => {
        if (!me.code) return;
        const text = `My player code in our Jet Lag game: ${formatCode(me.code)}`;
        try {
            if (navigator.share) {
                await navigator.share({ text });
                return;
            }
        } catch {
            // Fall through to the clipboard.
        }
        try {
            await navigator.clipboard.writeText(formatCode(me.code));
            toast.success("Code copied", { autoClose: 2000 });
        } catch {
            toast.info(formatCode(me.code));
        }
    };
    return (
        <section
            className="flex flex-col gap-2 rounded-lg bg-slate-800/60 p-3"
            data-testid="player-card"
        >
            <p className="text-sm" data-testid="game-role">
                <strong>You:</strong> {me.name} ·{" "}
                {hider ? "the hider" : "a seeker"}
                {team && ` · team ${team.name}`}
            </p>
            <p className="text-xs text-slate-400">
                Use this code to join the game as this player if disconnected.
                Save this code somewhere.
            </p>
            {me.code && (
                <p
                    className="rounded-md bg-slate-900/60 py-2 text-center font-mono text-2xl tracking-[0.3em]"
                    data-testid="player-code"
                >
                    {formatCode(me.code)}
                </p>
            )}
            <Button
                variant="outline"
                className="min-h-11"
                onClick={() => void shareCode()}
            >
                Copy code
            </Button>
            {!game.settings.teams && !hider && !someoneHides && (
                <Button
                    className="min-h-11"
                    onClick={() => void setHiding(true).catch(showError)}
                >
                    I&apos;m the hider
                </Button>
            )}
            {!game.settings.teams && me.hider && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void setHiding(false).catch(showError)}
                >
                    I&apos;m not the hider after all
                </Button>
            )}
        </section>
    );
};

const showError = (error: unknown) => toast.error(errorMessage(error));

/** "live", "12 min", from when a player was last heard of. */
const seenText = (at: number, now: number) => {
    const minutes = Math.floor((now - at) / 60_000);
    if (minutes < 10) return "live";
    return minutes < 60
        ? `${minutes} min ago`
        : `${Math.floor(minutes / 60)} h ago`;
};

/** Menu → Game: everyone in the game; one gone quiet for an hour can be removed. */
const PlayersList = ({
    game,
    me,
}: {
    game: GameState;
    me: Player | undefined;
}) => {
    const players = activePlayers(game);
    useTick(players.length > 0, 60_000);
    const now = serverNow();
    const [removing, setRemoving] = useState<string | null>(null);
    if (players.length === 0) return null;
    const quiet = players.filter(
        (p) => p.id !== me?.id && playerStale(p, now),
    ).length;
    const teamName = (player: Player) =>
        game.teams.find((t) => t.id === player.teamId)?.name;
    return (
        <section className="flex flex-col gap-1" data-testid="players-list">
            <h4 className="flex justify-between text-xs text-slate-300">
                <span>Players ({players.length})</span>
                {quiet > 0 && (
                    <span className="text-slate-400">
                        {quiet} not heard from in an hour
                    </span>
                )}
            </h4>
            <ul className="flex flex-col gap-1">
                {players.map((player) => {
                    const stale = playerStale(player, now);
                    const team = teamName(player);
                    return (
                        <li
                            key={player.id}
                            className={`flex min-h-11 items-center justify-between gap-2 rounded-md border border-slate-700 px-3 text-sm ${stale ? "text-slate-500" : ""}`}
                        >
                            <span>
                                {player.name}
                                {player.id === me?.id && " (you)"}
                                {team && ` · ${team}`}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-400">
                                {seenText(player.lastSeen, now)}
                                {stale && player.id !== me?.id && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={removing === player.id}
                                        onClick={async () => {
                                            setRemoving(player.id);
                                            try {
                                                await removePlayer(player.id);
                                            } catch (error) {
                                                showError(error);
                                            } finally {
                                                setRemoving(null);
                                            }
                                        }}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
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

/**
 * Menu → Game, no game: the code that lets this phone start games (a
 * creator code from the organiser, or the admin code), typed once.
 */
const CodeField = () => {
    const $code = useStore(myCode);
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    if ($code) {
        return (
            <p
                className="flex items-center justify-between gap-2 text-xs text-slate-300"
                data-testid="my-code"
                data-tutorial-id="creator-code"
            >
                <span>
                    {$code.kind === "admin"
                        ? "Admin code: you can start games, and Menu → Admin is yours."
                        : `Creator code "${$code.name}": you can start games.`}
                </span>
                <Button size="sm" variant="outline" onClick={forgetCode}>
                    Forget
                </Button>
            </p>
        );
    }
    return (
        <form
            className="flex flex-col gap-1"
            data-tutorial-id="creator-code"
            onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                try {
                    const { kind } = await enterCode(typed);
                    setTyped("");
                    toast.success(
                        kind === "admin"
                            ? "Admin code saved: Menu → Admin is open to you."
                            : "Code saved: you can start games.",
                        { autoClose: 4000 },
                    );
                } catch (error) {
                    toast.error(errorMessage(error));
                } finally {
                    setBusy(false);
                }
            }}
        >
            <Label htmlFor="creator-code">Have a code?</Label>
            <p className="text-xs text-slate-400">
                Starting a game needs one, from whoever runs this site.
            </p>
            <div className="flex gap-2">
                <Input
                    id="creator-code"
                    type="password"
                    autoComplete="off"
                    maxLength={64}
                    placeholder="Creator or admin code"
                    className="min-h-11"
                    debounce={0}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                />
                <Button
                    type="submit"
                    variant="outline"
                    className="min-h-11"
                    disabled={busy || typed.trim() === ""}
                >
                    Save
                </Button>
            </div>
            <p className="text-xs text-slate-400">
                Joining a game needs no code: open the link someone sent you.
            </p>
        </form>
    );
};

/** Your name; in a game, the others see a new one once you leave the field. */
const NameInput = ({ inline = false }: { inline?: boolean }) => {
    const $name = useStore(playerName);
    const input = (
        <Input
            id="player-name"
            className={inline ? "min-w-0 flex-1" : undefined}
            value={$name}
            maxLength={40}
            placeholder="Shown to the others"
            onChange={(e) => playerName.set(e.target.value)}
            onBlur={(e) => void renameInGame(e.target.value)}
        />
    );
    // In a game: the label and the field on one row.
    return inline ? (
        <div className="flex items-center gap-3">
            <Label htmlFor="player-name" className="shrink-0">
                Your name
            </Label>
            {input}
        </div>
    ) : (
        <>
            <Label htmlFor="player-name">Your name</Label>
            {input}
        </>
    );
};

/**
 * The game's fixed settings, behind one row (round 42): a tap opens them.
 * The local rules are among them: they can't change during a game.
 */
const GameInfo = ({
    settings,
    playArea,
}: {
    settings: GameSettings;
    playArea: string;
}) => (
    <Dialog>
        <DialogTrigger asChild>
            <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-700 px-3 text-left text-sm hover:bg-white/5"
                data-testid="game-info"
            >
                <span className="flex-1">
                    <span className="font-semibold">Game settings</span>
                    <span className="block text-xs text-slate-400">
                        {SIZE_NAMES[settings.size]} game,{" "}
                        {REGION_LABELS[settings.region]} rules · fixed for this
                        game
                    </span>
                </span>
                <span
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-400 font-serif text-sm font-bold italic"
                    aria-hidden
                >
                    i
                </span>
            </button>
        </DialogTrigger>
        <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
            <DialogHeader>
                <DialogTitle>Game settings</DialogTitle>
                <DialogDescription>
                    Decided when the game started; they can&apos;t change during
                    it (the hider can widen the hiding zones). The local rules (
                    {REGION_LABELS[settings.region]}) are among them.
                </DialogDescription>
            </DialogHeader>
            <SettingsSummary settings={settings} playArea={playArea} />
        </DialogContent>
    </Dialog>
);

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
    // Only the phone that started a game deletes it, for everyone.
    const $mine = useStore(organiserTokens);
    const [open, setOpen] = useState(false);
    const $game = useStore(gameState);
    const $me = useStore(myPlayer);
    // The others still playing in the game this phone is in.
    const others = $game
        ? activePlayers($game).filter((p) => p.id !== $me?.id).length
        : 0;
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
                                    {$mine[game.id] && " · you started it"}
                                </p>
                                <p className="text-slate-400">
                                    Joined {when(game.joinedAt)} · last seen{" "}
                                    {when(game.lastSeen)} ·{" "}
                                    <span className="font-mono">{game.id}</span>
                                </p>
                                {game.id === $gameId && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        title="The whole game as a JSON file: questions, answers, rounds and links to the photos"
                                        onClick={() => {
                                            if (!downloadGame())
                                                toast.error(
                                                    "No game to download.",
                                                );
                                        }}
                                    >
                                        Download this game (file)
                                    </Button>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={game.id === $gameId}
                                        onClick={() => joinGame(game.id)}
                                    >
                                        Rejoin
                                    </Button>
                                    {!$mine[game.id] ? (
                                        <ForgetButton
                                            id={game.id}
                                            live={
                                                game.id === $gameId &&
                                                others > 0
                                            }
                                            others={others}
                                        />
                                    ) : (
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
                                                        Its questions, photos
                                                        and curses are removed
                                                        from the server; phones
                                                        still in it are dropped
                                                        out. This can&apos;t be
                                                        undone.
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
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-slate-400">
                        Only the phone that started a game can delete it, for
                        everyone (anyone can once it has been left alone for 30
                        days); the server drops it after a year without changes.
                        Forget only drops it from this phone.
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
    const $me = useStore(myPlayer);
    const $code = useStore(myCode);
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
                <section
                    className="flex flex-col gap-2 rounded-lg border border-blue-500/60 p-3"
                    data-tutorial-id="play-together"
                >
                    <h3 className="text-sm font-semibold font-poppins">
                        Play together
                    </h3>
                    <p className="text-xs text-slate-400">
                        Everyone (seekers and hider) opens one link and sees
                        questions as they&apos;re added and answered. The
                        settings are decided when the game starts.
                    </p>
                    <NameInput />
                    <CodeField />
                    {$code && (
                        <Button
                            onClick={() => setupDialog.set("start")}
                            data-tutorial-id="start-shared-game"
                        >
                            Start a shared game
                        </Button>
                    )}
                </section>
                <GamesList />
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
            <h3
                className="flex items-center justify-between gap-2 text-sm font-semibold font-poppins"
                data-testid="current-game"
            >
                <span>
                    Current game: <span className="font-mono">{$gameId}</span>
                </span>
                <ConnectionStatus />
            </h3>
            <NameInput inline />
            {$game && $me && !$me.left && (
                <PlayerCard game={$game} me={$me} hider={$role === "hider"} />
            )}
            <Button
                className="min-h-11"
                onClick={shareLink}
                data-tutorial-id="share-link"
            >
                Share link
            </Button>
            {$game && $me && !$me.left && $game.settings.teams && (
                <TeamLine game={$game} me={$me} />
            )}
            {$game && <PlayersList game={$game} me={$me} />}

            {$game && <Scoreboard game={$game} />}
            <GameInfo settings={settings} playArea={playArea} />
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
                                this round are put away (kept with the game).
                                {$game?.settings.teams
                                    ? " The team that claimed the next round hides it."
                                    : " Then whoever hides taps I'm the hider in Menu → Game."}{" "}
                                The play area and settings stay.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    // With teams, who hides next comes first.
                                    if (
                                        $game?.settings.teams &&
                                        $game.teams.length > 0 &&
                                        !$game.nextHiderTeamId
                                    ) {
                                        nextHiderOpen.set(true);
                                        return;
                                    }
                                    void sendOp({ type: "newRound" });
                                }}
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

/**
 * Forget a game on this phone. The game you're in, with others playing,
 * asks first, and the button says so (round 42: one tap dropped a live
 * game by accident).
 */
const ForgetButton = ({
    id,
    live,
    others,
}: {
    id: string;
    live: boolean;
    others: number;
}) => {
    if (!live) {
        return (
            <Button
                size="sm"
                variant="outline"
                title="Drop it from this phone; the game goes on for the others"
                onClick={() => forgetGameHere(id)}
            >
                Forget
            </Button>
        );
    }
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    size="sm"
                    variant="outline"
                    className="text-red-300"
                    title="You're in it: this phone leaves the game"
                >
                    Forget…
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Forget the game you&apos;re playing?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        It&apos;s live, with {others} other player
                        {others === 1 ? "" : "s"} in it. This phone leaves it
                        and drops it from the list; to come back you need the
                        game&apos;s link and your player code.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep playing</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-500"
                        onClick={() => forgetGameHere(id)}
                    >
                        Forget it
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
