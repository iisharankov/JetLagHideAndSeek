import { useStore } from "@nanostores/react";

import { SidebarTrigger } from "@/components/ui/sidebar-l";
import { sidebarTab } from "@/lib/context";
import { hiderPhone } from "@/lib/game/session";

/** Opens (or closes) the sidebar; says which tab it's on. */
export const SidebarButton = () => {
    const tab = useStore(sidebarTab);
    const hider = useStore(hiderPhone);
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
