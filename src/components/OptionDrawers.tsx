import { useStore } from "@nanostores/react";
import { SettingsIcon } from "lucide-react";
import { useEffect } from "react";

import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { withBase } from "@/lib/config";
import {
    menuOpen,
    menuTab as menuTabStore,
    placeReview,
    playAreaEditing,
    setupDialog,
} from "@/lib/context";
import { myCode } from "@/lib/game/codes";
import { resumeGame } from "@/lib/game/session";
import { showTutorial, startTour, tour, tutorialsSeen } from "@/lib/tour";
import { TOUR_LABELS, type TourId } from "@/lib/tourSteps";
import { cn } from "@/lib/utils";

import { CoachMark } from "./CoachMark";
import { AdminPanel } from "./game/AdminPanel";
import { GamePanel } from "./game/GamePanel";
import { GamePopups } from "./game/GamePopups";
import { GameSetupDialog } from "./game/GameSetupDialog";
import { JoinDialog } from "./game/JoinDialog";
import { NextHiderDialog } from "./game/NextHiderDialog";
import { MenuGroup } from "./MenuGroup";
import { SettingsPanel } from "./SettingsPanel";
import { Button } from "./ui/button";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";

export const OptionDrawers = ({ className }: { className?: string }) => {
    const isOptionsOpen = useStore(menuOpen);
    const setOptionsOpen = menuOpen.set;
    const menuTab = useStore(menuTabStore);
    const setMenuTab = menuTabStore.set;
    const $setup = useStore(setupDialog);
    // A tour shows what's in the Menu with its note beside it: the Menu
    // isn't modal then, so the note can be tapped and the map seen.
    const modal = !useStore(tour);
    const $playAreaEditing = useStore(playAreaEditing);
    const admin = useStore(myCode)?.kind === "admin";

    useEffect(() => {
        resumeGame();
    }, []);

    // Choosing the play area, or reviewing its places, happens on the map,
    // under the menu.
    const $placeReview = useStore(placeReview);
    const $showTutorial = useStore(showTutorial);
    useEffect(() => {
        if ($playAreaEditing || $placeReview) setOptionsOpen(false);
    }, [$playAreaEditing, $placeReview]);

    return (
        <div className={cn("flex justify-end gap-2", className)}>
            <GamePopups />
            <JoinDialog />
            <CoachMark />
            <NextHiderDialog />
            {$setup !== null && (
                <GameSetupDialog
                    open
                    onOpenChange={(open) => !open && setupDialog.set(null)}
                    mode={$setup}
                />
            )}
            <Drawer
                // vaul can't change an open Menu between the two (its
                // overlay's hooks change): it starts afresh instead.
                key={modal ? "modal" : "tour"}
                open={isOptionsOpen}
                onOpenChange={setOptionsOpen}
                modal={modal}
                direction="right"
                shouldScaleBackground={false}
            >
                <DrawerTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full border-2 border-black/30 bg-white text-black shadow-md hover:bg-[#f4f4f4]",
                            // Phones open the Menu from the tab bar.
                            "max-md:hidden",
                            // Out of the way of its own panel.
                            isOptionsOpen && "invisible",
                        )}
                        data-tutorial-id="menu-button"
                        title="Game, settings and rules"
                        onClick={() => setMenuTab("game")}
                    >
                        <SettingsIcon className="h-5 w-5" />
                        <span className="sr-only">Menu</span>
                    </button>
                </DrawerTrigger>
                <DrawerContent side="right">
                    <div className="flex h-full w-full flex-col gap-3 px-4 pb-6 pt-4">
                        <DrawerHeader className="px-0 py-0 text-left">
                            <DrawerTitle className="text-2xl font-semibold font-poppins">
                                Menu
                            </DrawerTitle>
                        </DrawerHeader>
                        <SegmentedControl
                            label="Menu section"
                            options={[
                                { value: "game", label: "Game" },
                                { value: "settings", label: "Settings" },
                                ...(admin
                                    ? [
                                          {
                                              value: "admin" as const,
                                              label: "Admin",
                                          },
                                      ]
                                    : []),
                            ]}
                            value={
                                menuTab === "admin" && !admin ? "game" : menuTab
                            }
                            onValueChange={setMenuTab}
                        />
                        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
                            {(menuTab === "game" ||
                                (menuTab === "admin" && !admin)) && (
                                <>
                                    <GamePanel />
                                    <MenuGroup
                                        title="Help"
                                        tutorialId="menu-help"
                                    >
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="outline" asChild>
                                                <a
                                                    href={withBase("rules/")}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Rules
                                                </a>
                                            </Button>
                                            <Button variant="outline" asChild>
                                                <a
                                                    href={withBase(
                                                        "reference/",
                                                    )}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Questions &amp; cards
                                                </a>
                                            </Button>
                                        </div>
                                        <p className="text-xs text-slate-300">
                                            Tutorial
                                        </p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {TOURS_IN_MENU.map((id) => (
                                                <Button
                                                    key={id}
                                                    variant="outline"
                                                    size="sm"
                                                    aria-label={`${TOUR_LABELS[id]} tutorial`}
                                                    onClick={() => {
                                                        setOptionsOpen(false);
                                                        startTour(id);
                                                    }}
                                                >
                                                    {TOUR_LABELS[id]}
                                                </Button>
                                            ))}
                                        </div>
                                        <ToggleCard
                                            title="Tips for new players"
                                            description="Offer the tutorial the first time on this phone, and a short tip the first time something happens in a game. Switching on shows them all again."
                                            checked={$showTutorial}
                                            onCheckedChange={(on) => {
                                                if (on) tutorialsSeen.set({});
                                                showTutorial.set(on);
                                            }}
                                        />
                                        <details className="text-xs text-slate-400">
                                            <summary className="cursor-pointer text-slate-200">
                                                Install on your phone
                                            </summary>
                                            <p className="mt-1">
                                                Android (Chrome): the ⋮ menu →
                                                &quot;Add to Home screen&quot;
                                                or &quot;Install app&quot;.
                                                iPhone (Safari): Share →
                                                &quot;Add to Home Screen&quot;.
                                                It then opens full-screen like
                                                an app; background notifications
                                                need the installed app on iOS
                                                16.4 or later.
                                            </p>
                                        </details>
                                    </MenuGroup>
                                </>
                            )}
                            {menuTab === "settings" && <SettingsPanel />}
                            {menuTab === "admin" && admin && <AdminPanel />}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
};

const TOURS_IN_MENU: TourId[] = ["seeker", "hider", "organiser"];
