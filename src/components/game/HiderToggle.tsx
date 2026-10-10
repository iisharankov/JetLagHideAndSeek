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
import { Label } from "@/components/ui/label";
import { SidebarContext } from "@/components/ui/sidebar-l";
import { ToggleCard } from "@/components/ui/toggle-card";
import {
    hiderChoosing,
    hiderMode,
    leafletMapContext,
    mapGeoLocation,
    menuOpen,
    sidebarTab,
} from "@/lib/context";
import {
    claimHider,
    forgetHider,
    gameRole,
    gameState,
} from "@/lib/game/session";
import { errorMessage } from "@/maps/errors";

/** Opens the sidebar on the Hider tab, so the hider sees where to go next. */
const showHiderTab = () => {
    menuOpen.set(false);
    sidebarTab.set("stations");
    const sidebar = SidebarContext.get();
    if (sidebar.isMobile) sidebar.setOpenMobile(true);
    else sidebar.setOpen(true);
};

/**
 * Menu → Game: "I'm the hider". In a shared game it asks for the hider
 * password first (the first hider chooses it); alone it just turns hider
 * mode on. Either way the Stations tab becomes the Hider tab.
 */
export const HiderToggle = ({ onActivated }: { onActivated?: () => void }) => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $hiderMode = useStore(hiderMode);
    const [asking, setAsking] = useState(false);

    const on = $game ? $role === "hider" : $hiderMode !== false;

    const activated = () => {
        hiderChoosing.set(true);
        toast.success(
            "You're the hider. The Hider tab in the sidebar is yours: pick your station there.",
            { autoClose: 6000 },
        );
        onActivated?.();
        showHiderTab();
    };

    const turnOn = () => {
        if ($game) {
            setAsking(true);
            return;
        }
        const center = leafletMapContext.get()?.getCenter();
        const [lat, lng] = mapGeoLocation.get().geometry.coordinates;
        hiderMode.set({
            latitude: center?.lat ?? lat,
            longitude: center?.lng ?? lng,
        });
        activated();
    };

    const turnOff = () => {
        if ($game) forgetHider();
        else hiderMode.set(false);
        hiderChoosing.set(false);
    };

    return (
        <>
            <ToggleCard
                title={$game ? "I'm the hider" : "Hider mode"}
                description={
                    $game
                        ? "Asks for the hider password. Your phone then suggests each answer (from your station, and from your pin in the end game); nothing is sent until you tap it."
                        : "Answers every question automatically from your station (or the hider pin)."
                }
                checked={on}
                onCheckedChange={(checked) => (checked ? turnOn() : turnOff())}
            />
            {$game && !on && $game.hasHider && (
                <p className="text-xs text-slate-400">
                    A hider has already joined this game.
                </p>
            )}
            <Dialog open={asking} onOpenChange={setAsking}>
                <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                    <DialogHeader>
                        <DialogTitle>I&apos;m the hider</DialogTitle>
                        <DialogDescription>
                            {$game?.hasHider
                                ? "Enter the hider password."
                                : "Choose a hider password (at least 4 characters). The seekers don't get it."}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="flex flex-col gap-2"
                        onSubmit={async (event) => {
                            event.preventDefault();
                            // Read the field itself: the app's inputs report
                            // changes with a delay.
                            const password = String(
                                new FormData(event.currentTarget).get(
                                    "password",
                                ),
                            );
                            try {
                                await claimHider(password);
                                setAsking(false);
                                activated();
                            } catch (error) {
                                toast.error(errorMessage(error));
                            }
                        }}
                    >
                        <Label htmlFor="hider-password">Hider password</Label>
                        <input
                            id="hider-password"
                            name="password"
                            type="password"
                            autoComplete="off"
                            autoFocus
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="submit">Become the hider</Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setAsking(false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
};
