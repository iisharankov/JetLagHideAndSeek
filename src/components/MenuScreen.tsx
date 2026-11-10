import { useStore } from "@nanostores/react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { SidebarContext } from "@/components/ui/sidebar-l";
import { withBase } from "@/lib/config";
import {
    type MenuTab,
    menuTab,
    type SidebarTab,
    sidebarTab,
} from "@/lib/context";
import { myCode } from "@/lib/game/codes";
import { openRules } from "@/lib/rulesOverlay";
import { showTutorial, startTour, tutorialsSeen } from "@/lib/tour";
import { TOUR_LABELS, type TourId } from "@/lib/tourSteps";

import { AdminPanel } from "./game/AdminPanel";
import { GamePanel } from "./game/GamePanel";
import { MenuGroup } from "./MenuGroup";
import { SettingsPanel } from "./SettingsPanel";
import { Button } from "./ui/button";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";

/** The tab the Menu was opened from, and whether the sidebar was open. */
let before: SidebarTab = "questions";
let wasOpen = true;

/**
 * The Menu button: opens the Menu on the section it was last on (round 42:
 * back from the map, it's as you left it, scroll included).
 */
export const menuButton = () => openMenu();

/** Where each section was scrolled to, for coming back to it. */
const scrolls: Partial<Record<MenuTab, number>> = {};

/**
 * Opens the Menu: a tab of the sidebar (the sheet on a phone, the left
 * column on a desktop), on one of its sections.
 */
export const openMenu = (tab?: MenuTab) => {
    const current = sidebarTab.get();
    if (tab) menuTab.set(tab);
    const sidebar = SidebarContext.get();
    if (current !== "menu") {
        before = current;
        wasOpen = sidebar.isMobile ? sidebar.openMobile : sidebar.open;
    }
    sidebarTab.set("menu");
    if (sidebar.isMobile) {
        sidebar.setOpenMobile(true);
    } else sidebar.setOpen(true);
};

/** Closes the Menu: back to the tab it was opened from, as it was. */
export const closeMenu = () => {
    if (sidebarTab.get() !== "menu") return;
    sidebarTab.set(before);
    if (wasOpen) return;
    const sidebar = SidebarContext.get();
    if (sidebar.isMobile) sidebar.setOpenMobile(false);
    else sidebar.setOpen(false);
};

const TOURS_IN_MENU: Exclude<TourId, "ask">[] = [
    "seeker",
    "hider",
    "organiser",
];

/** Menu → Help: the rules, the tutorials, installing the app. */
const HelpPanel = () => {
    const $showTutorial = useStore(showTutorial);
    return (
        <MenuGroup title="Help" tutorialId="menu-help">
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="outline"
                    className="h-auto whitespace-normal py-2 text-center"
                    asChild
                >
                    <a
                        href={withBase("rules/")}
                        onClick={(event) => {
                            event.preventDefault();
                            openRules();
                        }}
                    >
                        Rules
                    </a>
                </Button>
                <Button
                    variant="outline"
                    className="h-auto whitespace-normal py-2 text-center"
                    asChild
                >
                    <a
                        href={withBase("reference/")}
                        onClick={(event) => {
                            event.preventDefault();
                            openRules("reference");
                        }}
                    >
                        Questions &amp; cards
                    </a>
                </Button>
            </div>
            <p className="text-xs text-slate-300">Tutorial</p>
            <div className="grid grid-cols-3 gap-2">
                {TOURS_IN_MENU.map((id) => (
                    <Button
                        key={id}
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal px-1 py-2"
                        aria-label={`${TOUR_LABELS[id]} tutorial`}
                        onClick={() => {
                            closeMenu();
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
                <summary className="flex min-h-11 cursor-pointer items-center text-slate-200">
                    Install on your phone
                </summary>
                <p className="mt-1">
                    Android (Chrome): the ⋮ menu → &quot;Add to Home
                    screen&quot; or &quot;Install app&quot;. iPhone (Safari):
                    Share → &quot;Add to Home Screen&quot;. It then opens
                    full-screen like an app; background notifications need the
                    installed app on iOS 16.4 or later.
                </p>
            </details>
        </MenuGroup>
    );
};

/**
 * The Menu tab (mock-up 16): Game (the game, you, the players), Settings,
 * Help, and Admin for the admin's phone. Escape closes it.
 */
export const MenuScreen = () => {
    const tab = useStore(menuTab);
    const admin = useStore(myCode)?.kind === "admin";
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            // A dialog over the Menu (the setup) takes its own Escape.
            if (
                event.key !== "Escape" ||
                document.querySelector('[role="dialog"], [role="alertdialog"]')
            )
                return;
            closeMenu();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    const shown = tab === "admin" && !admin ? "game" : tab;
    const ref = useRef<HTMLElement>(null);
    // The section's scroll, kept while away (the map, another tab).
    useLayoutEffect(() => {
        const box = ref.current?.closest<HTMLElement>(
            '[data-sidebar="content"]',
        );
        if (!box) return;
        box.scrollTop = scrolls[shown] ?? 0;
        const save = () => {
            scrolls[shown] = box.scrollTop;
        };
        box.addEventListener("scroll", save, { passive: true });
        return () => box.removeEventListener("scroll", save);
    }, [shown]);
    return (
        <section
            ref={ref}
            className="flex flex-col gap-3 px-3 pb-6 pt-2"
            aria-label="Menu"
            data-testid="menu-screen"
        >
            <SegmentedControl
                label="Menu section"
                options={[
                    { value: "game", label: "Game" },
                    { value: "settings", label: "Settings" },
                    { value: "help", label: "Help" },
                    ...(admin
                        ? [{ value: "admin" as const, label: "Admin" }]
                        : []),
                ]}
                value={shown}
                onValueChange={menuTab.set}
            />
            {shown === "game" && <GamePanel />}
            {shown === "settings" && <SettingsPanel />}
            {shown === "help" && <HelpPanel />}
            {shown === "admin" && <AdminPanel />}
        </section>
    );
};
