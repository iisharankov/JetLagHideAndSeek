import { useStore } from "@nanostores/react";
import { useState } from "react";
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
import { joinedGames, knownGames, markJoined } from "@/lib/game/knownGames";
import {
    activeGameId,
    claimHider,
    forgetHider,
    gameState,
    hiderToken,
    playerName,
} from "@/lib/game/session";
import { chosenStation, hiderChoosing } from "@/lib/hiderSpot";
import { errorMessage } from "@/maps/errors";

/** Opens the sidebar (the sheet, on a phone) on the Hider tab. */
const showHiderTab = () => {
    menuOpen.set(false);
    sidebarTab.set("stations");
    const sidebar = SidebarContext.get();
    if (sidebar.isMobile) sidebar.setOpenMobile(true);
    else sidebar.setOpen(true);
};

/**
 * Opening a game's link, or having just started a game: before anything
 * else, say who you are and whether you're hiding or seeking. Nothing
 * behind it can be touched until then.
 */
export const JoinDialog = () => {
    const $gameId = useStore(activeGameId);
    const $joined = useStore(joinedGames);
    const $game = useStore(gameState);
    const $known = useStore(knownGames);
    const $name = useStore(playerName);
    const [hiding, setHiding] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notifyMe, setNotifyMe] = useState(true);

    const open = $gameId !== "" && !$joined[$gameId];
    if (!open) return null;
    const area = $known[$gameId]?.area;
    const named = $name.trim().length > 0;

    return (
        <Dialog open>
            <DialogContent
                closeIcon={false}
                onPointerDownOutside={(event) => event.preventDefault()}
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
                className="!bg-[hsl(var(--sidebar-background))] !text-white"
                data-testid="join-dialog"
            >
                <DialogHeader>
                    <DialogTitle>Joining the game</DialogTitle>
                    <DialogDescription>
                        {area ? `Hide and seek in ${area}. ` : ""}
                        Who are you, and are you hiding or seeking?
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-3"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        // The name field writes straight to the store.
                        const name = playerName.get().trim();
                        if (!name) {
                            toast.error("Give your name first.");
                            return;
                        }
                        playerName.set(name);
                        // Even with the app closed, if the phone can.
                        const notifications = async () => {
                            if (!notifyMe || !pushSupported()) return;
                            try {
                                const result = await enablePush(
                                    $gameId,
                                    hiderToken(),
                                );
                                if (result === "denied") {
                                    toast.info(
                                        "Notifications are blocked for this site; you can allow them in the browser's site settings.",
                                    );
                                }
                            } catch {
                                // The game goes on without them.
                            }
                        };
                        if (!hiding) {
                            // A seeker, whatever this phone was before.
                            if (hiderToken()) forgetHider();
                            markJoined($gameId);
                            void notifications();
                            return;
                        }
                        const password = String(form.get("password") ?? "");
                        setBusy(true);
                        try {
                            await claimHider(password);
                            markJoined($gameId);
                            void notifications();
                            hiderChoosing.set(true);
                            showHiderTab();
                            if (chosenStation.get()) {
                                toast.success(
                                    "You're the hider. The Hider tab is yours.",
                                    { autoClose: 6000 },
                                );
                            } else {
                                // No hiding spot yet: point at the Hider tab's
                                // instructions until a station is picked.
                                coachMark.set({
                                    target: '[data-tutorial-id="hider-pick"]',
                                    title: "Pick your hiding spot",
                                    text: "Tap your station on the map or in this list; the red circle around it is your hiding zone. Then tap Done.",
                                });
                            }
                        } catch (error) {
                            toast.error(errorMessage(error));
                        } finally {
                            setBusy(false);
                        }
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
                        autoFocus={!named}
                    />
                    {!hiding ? (
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="submit" disabled={busy}>
                                I&apos;m a seeker
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy || !$game}
                                onClick={() => setHiding(true)}
                            >
                                I&apos;m the hider
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Label htmlFor="join-password">
                                Hider password
                            </Label>
                            <input
                                id="join-password"
                                name="password"
                                type="password"
                                autoComplete="off"
                                autoFocus
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-slate-400">
                                {$game?.hasHider
                                    ? "The hider's password, from whoever hid first."
                                    : "Choose one (at least 4 characters); the seekers don't get it."}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="submit" disabled={busy}>
                                    Become the hider
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => setHiding(false)}
                                >
                                    Back
                                </Button>
                            </div>
                        </>
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
                    {!$game && (
                        <p className="text-xs text-slate-400">Connecting…</p>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
};
