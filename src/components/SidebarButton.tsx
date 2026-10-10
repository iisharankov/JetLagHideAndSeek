import { useStore } from "@nanostores/react";

import { SidebarTrigger } from "@/components/ui/sidebar-l";
import { hiderMode, sidebarTab } from "@/lib/context";
import { gameRole, gameState } from "@/lib/game/session";

/** Opens (or closes) the sidebar; says which tab it's on. */
export const SidebarButton = () => {
    const tab = useStore(sidebarTab);
    const $hiderMode = useStore(hiderMode);
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const hider = $hiderMode !== false && (!$game || $role === "hider");
    const label = {
        questions: "Questions",
        stations: hider ? "Hider" : "Stations",
        photos: "Photos",
        curses: "Cards",
    }[tab];
    return (
        <SidebarTrigger title="Open or close the sidebar">
            {label}
        </SidebarTrigger>
    );
};
