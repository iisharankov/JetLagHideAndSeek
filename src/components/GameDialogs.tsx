import { useStore } from "@nanostores/react";
import { SettingsIcon } from "lucide-react";
import { useEffect } from "react";

import {
    placeReview,
    playAreaEditing,
    setupDialog,
    sidebarTab,
} from "@/lib/context";
import { resumeGame } from "@/lib/game/session";
import { cn } from "@/lib/utils";

import { CoachMark } from "./CoachMark";
import { GamePopups } from "./game/GamePopups";
import { GameSetupDialog } from "./game/GameSetupDialog";
import { JoinDialog } from "./game/JoinDialog";
import { NextHiderDialog } from "./game/NextHiderDialog";
import { closeMenu, menuButton } from "./MenuScreen";
import { RulesOverlay } from "./RulesOverlay";
import { SidebarContext } from "./ui/sidebar-l";

/**
 * What sits over the map whatever the tab: the game's dialogs and popups,
 * the tutorial, and on a desktop the Menu button (phones have it in the
 * tab bar). The Menu itself is a sidebar tab (MenuScreen.tsx).
 */
export const GameDialogs = ({ className }: { className?: string }) => {
    const $setup = useStore(setupDialog);
    const $tab = useStore(sidebarTab);
    const $playAreaEditing = useStore(playAreaEditing);
    const $placeReview = useStore(placeReview);

    useEffect(() => {
        resumeGame();
    }, []);

    // Choosing the play area, or reviewing its places, happens on the map:
    // the Menu closes (it comes back when the review is done) and the
    // phone's sheet gets out of the way.
    useEffect(() => {
        if (!$playAreaEditing && !$placeReview) return;
        closeMenu();
        const sidebar = SidebarContext.get();
        if (sidebar.isMobile) sidebar.setOpenMobile(false);
    }, [$playAreaEditing, $placeReview]);

    return (
        <div className={cn("flex justify-end gap-2", className)}>
            <GamePopups />
            <JoinDialog />
            <CoachMark />
            <NextHiderDialog />
            <RulesOverlay />
            {$setup !== null && (
                <GameSetupDialog
                    open
                    onOpenChange={(open) => !open && setupDialog.set(null)}
                    mode={$setup}
                />
            )}
            <button
                type="button"
                className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 border-black/30 bg-white text-black shadow-md hover:bg-[#f4f4f4]",
                    // Phones open the Menu from the tab bar.
                    "max-md:hidden",
                )}
                aria-pressed={$tab === "menu"}
                data-tutorial-id="menu-button"
                title="Game, settings and help"
                onClick={menuButton}
            >
                <SettingsIcon className="h-5 w-5" />
                <span className="sr-only">Menu</span>
            </button>
        </div>
    );
};
