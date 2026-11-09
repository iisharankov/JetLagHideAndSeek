import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

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
import { SidebarContext } from "@/components/ui/sidebar-l";
import { coachMark } from "@/lib/coachMark";
import { menuOpen, sidebarTab } from "@/lib/context";
import { enablePush, pushSupported } from "@/lib/game/alerts";
import { knownGames } from "@/lib/game/knownGames";
import { activePlayers, parseCode } from "@/lib/game/players";
import {
    activeGameId,
    gameState,
    hiderToken,
    hiderTurn,
    joinAs,
    joinedHere,
    myPlayerId,
    playerName,
    rejoinWithCode,
} from "@/lib/game/session";
import { chosenStation, hiderChoosing } from "@/lib/hiderSpot";
import { offerTour } from "@/lib/tour";
import { errorMessage } from "@/maps/errors";

import { teamBody, type TeamChoice, TeamPicker } from "./TeamPicker";

/** No hiding spot yet: point at the Hider tab's instructions until one is picked. */
const pointAtStationPick = () => {
    if (chosenStation.get()) return;
    coachMark.set({
        target: '[data-tutorial-id="hider-pick"]',
        title: "Pick your hiding spot",
        text: "Tap your station on the map, or Mine in this list; the red circle around it is your hiding zone. Then tap Done.",
    });
};

/** Opens the sidebar (the sheet, on a phone) on the Hider tab. */
const showHiderTab = () => {
    menuOpen.set(false);
    sidebarTab.set("stations");
    const sidebar = SidebarContext.get();
    if (sidebar.isMobile) sidebar.setOpenMobile(true);
    else sidebar.setOpen(true);
};

/** Even with the app closed, if the phone can. */
const notifications = async (gameId: string) => {
    if (!pushSupported()) return;
    try {
        const result = await enablePush(gameId, hiderToken());
        if (result === "denied") {
            toast.info(
                "Notifications are blocked for this site; you can allow them in the browser's site settings.",
            );
        }
    } catch {
        // The game goes on without them.
    }
};

/**
 * This phone became the hider while open (joined as the hider, or a new
 * round went to its team): the Hider tab, and the pointer at the station.
 */
const useHiderTurn = () => {
    const $turn = useStore(hiderTurn);
    const handled = useRef($turn);
    useEffect(() => {
        if ($turn === handled.current) return;
        handled.current = $turn;
        const game = gameState.get();
        const team = game?.teams.find((t) => t.id === game.hiderTeamId);
        // The station is the game's: a phone joining a hider who has one
        // sees it, not "Pick your station".
        const station = chosenStation.get();
        hiderChoosing.set(!station);
        showHiderTab();
        const who = team
            ? `Team ${team.name} hides this round`
            : "You're the hider";
        if (station) {
            toast.success(`${who}. Your station is ${station.name}.`, {
                autoClose: 6000,
            });
        } else if (team) {
            toast.success(`${who}: the Hider tab is yours.`, {
                autoClose: 6000,
            });
        }
        // The first time as the hider on this phone: the tour first, the
        // pointer after it.
        if (!offerTour("hider", pointAtStationPick)) pointAtStationPick();
    }, [$turn]);
};

/** "Were you in this game on another phone?": the player code brings the player here. */
const RejoinWithCode = ({ busy }: { busy: boolean }) => {
    const [code, setCode] = useState("");
    const [sending, setSending] = useState(false);
    return (
        <section
            className="flex flex-col gap-2 rounded-lg bg-slate-800/60 p-3"
            data-testid="rejoin-with-code"
        >
            <p className="text-xs text-slate-300">
                <strong className="text-white">
                    Were you in this game on another phone?
                </strong>{" "}
                Your player code from that phone (Menu → Game) brings your
                player here.
            </p>
            <input
                type="text"
                aria-label="Player code"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={9}
                placeholder="Player code, e.g. K7M-4PQ"
                className="h-11 w-full rounded-md border border-input bg-background px-3 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case"
                value={code}
                onChange={(event) => setCode(event.target.value)}
            />
            <Button
                type="button"
                variant="outline"
                disabled={busy || sending || parseCode(code) === null}
                onClick={async () => {
                    setSending(true);
                    try {
                        await rejoinWithCode(code);
                        toast.success("Welcome back: you're in, as before.", {
                            autoClose: 4000,
                        });
                    } catch (error) {
                        toast.error(errorMessage(error));
                    } finally {
                        setSending(false);
                    }
                }}
            >
                Rejoin with the code
            </Button>
        </section>
    );
};

/**
 * Opening a game's link, or having just started a game: before anything
 * else, say who you are and whether you're hiding or seeking (with teams:
 * which team, with its password). Once per phone: a reload, a closed tab
 * or a new round doesn't ask again.
 */
export const JoinDialog = () => {
    const $gameId = useStore(activeGameId);
    const $joined = useStore(joinedHere);
    const $game = useStore(gameState);
    const $known = useStore(knownGames);
    const $name = useStore(playerName);
    const $me = useStore(myPlayerId);
    const [busy, setBusy] = useState(false);
    const [notifyMe, setNotifyMe] = useState(true);
    const [team, setTeam] = useState<TeamChoice | null>(null);
    const [password, setPassword] = useState("");
    const [hideToo, setHideToo] = useState(false);
    useHiderTurn();

    const open = $gameId !== "" && $game !== null && !$joined;
    // Each time it opens the choices start afresh.
    useEffect(() => {
        if (open) {
            setTeam(null);
            setPassword("");
            setHideToo(false);
        }
    }, [open]);
    if (!open || !$game) return null;

    const area = $known[$gameId]?.area;
    const name = $name.trim();
    const withTeams = $game.settings.teams;
    const teams = $game.teams;
    const choice: TeamChoice | null =
        team ??
        (withTeams && teams.length === 0 ? { kind: "new", name: "" } : null);
    const hiderTeam = teams.find((t) => t.id === $game.hiderTeamId);
    const chosenTeam =
        choice?.kind === "existing"
            ? teams.find((t) => t.id === choice.id)
            : undefined;
    const teamName =
        choice?.kind === "new" ? choice.name.trim() : (chosenTeam?.name ?? "");
    // With teams: the hiding team's members are the hiders.
    const hiding =
        !!choice && (hiderTeam ? chosenTeam?.id === hiderTeam.id : hideToo);
    const hider = withTeams
        ? undefined
        : activePlayers($game).find((p) => p.hider && p.id !== $me);

    const join = async (asHider: boolean) => {
        if (!name) {
            toast.error("Give your name first.");
            return;
        }
        if (withTeams && (!choice || !teamName)) {
            toast.error(
                choice ? "Give the team a name." : "Pick a team, or make one.",
            );
            return;
        }
        setBusy(true);
        try {
            await joinAs({
                name,
                ...(withTeams && choice
                    ? { team: teamBody(choice, password) }
                    : {}),
                ...(asHider && !hiderTeam ? { hider: true } : {}),
            });
            if (notifyMe) void notifications($gameId);
            // The first time as a seeker on this phone (a hider's tour
            // comes with the Hider tab).
            if (!asHider) offerTour("seeker");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open>
            <DialogContent
                closeIcon={false}
                onPointerDownOutside={(event) => event.preventDefault()}
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
                className="max-h-[100dvh] overflow-y-auto !bg-[hsl(var(--sidebar-background))] !text-white"
                data-testid="join-dialog"
            >
                <DialogHeader>
                    <DialogTitle>Joining the game</DialogTitle>
                    <DialogDescription>
                        {area ? `Hide and seek in ${area}. ` : ""}
                        {hiderTeam
                            ? `Round ${$game.rounds.length + 1}: team ${hiderTeam.name} hides. `
                            : ""}
                        {withTeams
                            ? "Who are you, and which team are you in?"
                            : "Who are you, and are you hiding or seeking?"}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void join(withTeams ? hiding : false);
                    }}
                >
                    <Label htmlFor="join-name">Your name</Label>
                    <Input
                        id="join-name"
                        name="name"
                        value={$name}
                        maxLength={40}
                        placeholder="Shown to the others"
                        debounce={0}
                        onChange={(event) => playerName.set(event.target.value)}
                        autoFocus={!name}
                    />
                    {withTeams ? (
                        <>
                            <Label>Team</Label>
                            <TeamPicker
                                teams={teams}
                                players={$game.players}
                                hiderTeamId={$game.hiderTeamId}
                                mine={null}
                                value={choice}
                                onChange={(next) => {
                                    // Another team, another password.
                                    if (
                                        next.kind !== choice?.kind ||
                                        (next.kind === "existing" &&
                                            choice.kind === "existing" &&
                                            next.id !== choice.id)
                                    ) {
                                        setPassword("");
                                    }
                                    setTeam(next);
                                }}
                                password={password}
                                onPasswordChange={setPassword}
                            />
                            {choice && !hiderTeam && (
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={hideToo}
                                        onChange={(event) =>
                                            setHideToo(event.target.checked)
                                        }
                                    />
                                    We hide this round
                                </label>
                            )}
                            {hiding ? (
                                <p
                                    className="rounded-lg border border-amber-500/70 bg-amber-950/40 p-3 text-xs text-amber-200"
                                    data-testid="hiding-team-note"
                                >
                                    <strong className="text-white">
                                        {teamName || "Your team"} hide this
                                        round.
                                    </strong>{" "}
                                    Everyone in the team is a hider: you&apos;ll
                                    see the Hider tab and your position
                                    isn&apos;t shared with the seekers.
                                </p>
                            ) : (
                                <p
                                    className="text-xs text-slate-400"
                                    data-testid="seekers-tracked"
                                >
                                    Seekers: the hider sees where you are on
                                    their map, as the rules ask. You&apos;ll be
                                    asked to turn your location on.
                                </p>
                            )}
                            <Button
                                type="submit"
                                className="min-h-11"
                                disabled={busy || !choice}
                            >
                                {choice
                                    ? `Join as ${name || "…"} · ${hiding ? "hiding" : "seeking"} with ${teamName || "…"}`
                                    : "Pick a team first"}
                            </Button>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="submit"
                                className="min-h-11"
                                disabled={busy}
                            >
                                I&apos;m a seeker
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11"
                                disabled={busy || !!hider}
                                onClick={() => void join(true)}
                            >
                                I&apos;m the hider
                            </Button>
                            {hider && (
                                <p className="col-span-2 text-xs text-amber-300">
                                    {hider.name} is the hider. If that&apos;s
                                    you on another phone, rejoin with your code
                                    below.
                                </p>
                            )}
                            <p
                                className="col-span-2 text-xs text-slate-400"
                                data-testid="seekers-tracked"
                            >
                                Seekers: the hider sees where you are on their
                                map, as the rules ask. You&apos;ll be asked to
                                turn your location on.
                            </p>
                        </div>
                    )}
                    {pushSupported() && (
                        <label className="flex items-start gap-2 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={notifyMe}
                                onChange={(event) =>
                                    setNotifyMe(event.target.checked)
                                }
                            />
                            <span>
                                Notify me on this phone when the game needs me,
                                even with the app closed (the browser will ask).
                            </span>
                        </label>
                    )}
                </form>
                <RejoinWithCode busy={busy} />
            </DialogContent>
        </Dialog>
    );
};
