import { useStore } from "@nanostores/react";
import {
    Camera,
    EyeOff,
    Layers,
    Map as MapIcon,
    Menu as MenuIcon,
    MessageCircleQuestion,
    Plus,
    Search,
    TrainFront,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarContext } from "@/components/ui/sidebar-l";
import {
    endgame,
    menuOpen,
    menuTab,
    questions,
    type SidebarTab,
    sidebarTab,
} from "@/lib/context";
import { hand, handLimit } from "@/lib/game/hand";
import {
    gameRole,
    gameState,
    hiderPhone,
    zonesAllowed,
} from "@/lib/game/session";
import { sectionLabel, sidebarSections } from "@/lib/game/tabBadges";
import { chosenStation, hiderChoosing } from "@/lib/hiderSpot";
import { openAsk } from "@/lib/screens";
import { cn } from "@/lib/utils";

/** The phone's tab bar, in px (without the safe area under it). */
export const TAB_BAR_HEIGHT = 64;

/**
 * The sidebar's sections as they are now (QuestionSidebar.tsx and the tab
 * bar read the same): which exist, their counts, and what holds the hider.
 */
export const useSidebarSections = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $questions = useStore(questions);
    const hider = useStore(hiderPhone);
    const $hand = useStore(hand);
    const $limit = useStore(handLimit);
    const $chosen = useStore(chosenStation);
    const $choosing = useStore(hiderChoosing);
    const $allowed = useStore(zonesAllowed);
    const $endgame = useStore(endgame);
    // Too many cards in the hand: the hider stays in Cards until it's fixed.
    const overLimit =
        hider &&
        ($game?.deck
            ? $game.deck.hand.length > $game.deck.limit
            : $hand.length > $limit);
    // The hider's first job in a game is their station.
    const noStationYet = hider && !!$game && ($choosing || !$chosen);
    // Seekers in a game that keeps the stations to the hider have nothing
    // in that tab, until the end game shows its zone.
    const stationsTab = hider || $allowed || !!$endgame || !!$game?.revealedPin;
    const sections = sidebarSections({
        hider,
        noStationYet,
        stationsTab,
        waitingQuestions:
            $game && $role === "hider"
                ? Object.values($game.questions).filter(
                      (entry) => entry.state === "asked",
                  ).length
                : 0,
        waitingPhotos:
            $game?.photoRequests.filter((request) => !request.photoId).length ??
            0,
        activeCurses:
            $game?.curses.filter((curse) => !curse.clearedAt).length ?? 0,
        research: $questions.filter((q) => q.data.research).length,
    });
    return { sections, overLimit, noStationYet, stationsTab, hider };
};

// The tour points at the items as data-tutorial-id="tab-questions",
// data-tutorial-id="tab-stations", data-tutorial-id="tab-photos",
// data-tutorial-id="tab-curses" and data-tutorial-id="tab-research"
// (built below from the section's value).
const ICONS: Record<SidebarTab, typeof MapIcon> = {
    questions: MessageCircleQuestion,
    stations: TrainFront,
    photos: Camera,
    curses: Layers,
    research: Search,
};

/**
 * The phone's tab bar, always at the bottom: Map hides the sheet (what was
 * open stays open behind it), a section opens the sheet on it, Menu opens
 * the Menu. Desktop has the sections at the top of the sidebar instead.
 */
export const TabBar = () => {
    const { isMobile, openMobile, setOpenMobile } = useStore(SidebarContext);
    const tab = useStore(sidebarTab);
    const { sections, overLimit, hider } = useSidebarSections();
    if (!isMobile) return null;
    const item =
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold";
    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-[1036] flex border-t border-slate-700 bg-slate-950 text-slate-300"
            style={{
                height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
                paddingBottom: "env(safe-area-inset-bottom)",
            }}
            data-testid="tab-bar"
        >
            <button
                type="button"
                className={cn(item, !openMobile && "text-white")}
                aria-pressed={!openMobile}
                onClick={() => setOpenMobile(false)}
                data-tutorial-id="tab-map"
            >
                <MapIcon className="h-6 w-6" aria-hidden />
                Map
            </button>
            <div
                role="radiogroup"
                aria-label="Sidebar section"
                className="flex min-w-0 flex-[4]"
            >
                {sections.map((section) => {
                    const Icon =
                        section.value === "stations" && hider
                            ? EyeOff
                            : ICONS[section.value];
                    const on = openMobile && tab === section.value;
                    return (
                        <button
                            key={section.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            aria-label={sectionLabel(section)}
                            disabled={overLimit && section.value !== "curses"}
                            className={cn(
                                item,
                                on && "text-white",
                                "disabled:opacity-40",
                            )}
                            data-tutorial-id={`tab-${section.value}`}
                            onClick={() => {
                                sidebarTab.set(section.value);
                                setOpenMobile(true);
                            }}
                        >
                            <span
                                className={cn(
                                    "flex h-8 w-10 items-center justify-center rounded-lg",
                                    on && "bg-blue-600",
                                )}
                            >
                                <Icon className="h-5 w-5" aria-hidden />
                            </span>
                            {section.name}
                            {section.count > 0 && (
                                <span
                                    className="absolute right-[18%] top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] text-white"
                                    aria-hidden
                                >
                                    {section.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                className={item}
                aria-label="Menu"
                data-tutorial-id="menu-button"
                onClick={() => {
                    menuTab.set("game");
                    menuOpen.set(true);
                }}
            >
                <MenuIcon className="h-6 w-6" aria-hidden />
                Menu
            </button>
        </nav>
    );
};

/** "＋ Ask a question" over the map on a phone (the sheet down). */
export const AskButton = () => {
    const { isMobile, openMobile, setOpenMobile } = useStore(SidebarContext);
    const hider = useStore(hiderPhone);
    if (!isMobile || openMobile || hider) return null;
    return (
        <Button
            className="fixed left-4 right-20 z-[1031] h-12 text-base font-semibold shadow-lg"
            style={{
                bottom: `calc(${TAB_BAR_HEIGHT + 16}px + env(safe-area-inset-bottom))`,
            }}
            data-tutorial-id="ask-question"
            onClick={() => {
                sidebarTab.set("questions");
                openAsk();
                setOpenMobile(true);
            }}
        >
            <Plus className="h-5 w-5" aria-hidden />
            Ask a question
        </Button>
    );
};
