import { useStore } from "@nanostores/react";
import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";

import { withErrorBoundary } from "@/components/ErrorBoundary";
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
    Sidebar,
    SidebarContent,
    SidebarContext,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { SegmentedControl } from "@/components/ui/toggle-card";
import { showUndoToast } from "@/components/undoToast";
import { useTick } from "@/hooks/useTick";
import { withBase } from "@/lib/config";
import {
    clearQuestions,
    isLoading,
    openQuestion,
    questions,
    type SidebarTab,
    sidebarTab,
} from "@/lib/context";
import { formatDuration } from "@/lib/game/clock";
import { questionRows } from "@/lib/game/questionList";
import { serverNow } from "@/lib/game/serverTime";
import {
    gameConnection,
    gameRole,
    gameState,
    sendOp,
} from "@/lib/game/session";
import { sectionLabel } from "@/lib/game/tabBadges";
import { askFlow, openAsk, pushedScreen, wireBackButton } from "@/lib/screens";
import { cn } from "@/lib/utils";
import type { Question } from "@/maps/schema";

import { QuestionSubtype } from "./ask/QuestionSubtype";
import { QuestionTypes } from "./ask/QuestionTypes";
import { QuestionHeading } from "./cards/base";
import { CardsPanel } from "./game/CardsPanel";
import { CurseBanner } from "./game/CurseBanner";
import { LocationPrompt } from "./game/LocationPrompt";
import { NotePinList } from "./game/NotePins";
import { OtherPhotos, PhotoRows, PhotoScreen } from "./game/PhotoRequests";
import { RoundClock } from "./game/RoundClock";
import { HiderPanel as HiderPanelPlain } from "./HiderPanel";
import { MenuScreen } from "./MenuScreen";
import {
    MatchingQuestionComponent,
    MeasuringQuestionComponent,
    RadiusQuestionComponent,
    TentacleQuestionComponent,
    ThermometerQuestionComponent,
} from "./QuestionCards";
import { QuestionList, questionTitle } from "./QuestionList";
import { StationsPanel as Panel } from "./StationsPanel";
import { useSidebarSections } from "./TabBar";

// A crash in the stations panel keeps the question list working.
const StationsPanel = withErrorBoundary(Panel, "stations panel", [
    "displayHidingZones",
    "displayHidingZonesStyle",
    "displayHidingZonesOptions",
    "disabledStations",
    "endgame",
]);
const HiderPanel = withErrorBoundary(HiderPanelPlain, "hider panel", [
    "hiderStation",
    "isHiderMode",
    "showHiderPin",
]);

export const QuestionSidebar = () => {
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $connection = useStore(gameConnection);
    const tab = useStore(sidebarTab);
    const { isMobile } = useStore(SidebarContext);
    const $ask = useStore(askFlow);
    useEffect(() => wireBackButton(), []);
    const $screen = useStore(pushedScreen);
    // Which sections exist (the same as the phone's tab bar), and what
    // holds the hider in one: too many cards, no station yet.
    const {
        sections,
        overLimit,
        noStationYet,
        stationsTab,
        hider,
        research: researchCount,
    } = useSidebarSections();
    useEffect(() => {
        if (overLimit && tab !== "curses" && tab !== "menu")
            sidebarTab.set("curses");
    }, [overLimit, tab]);
    const move = $game?.move ?? null;
    // The hider's first job in a game is their station: the Hider tab
    // opens on it once. The other tabs stay open: the seekers may ask
    // before the hider has settled (round 41).
    useEffect(() => {
        if (noStationYet) sidebarTab.set("stations");
    }, [noStationYet]);
    // The hider's research goes with the station's confirmation.
    useEffect(() => {
        if (!noStationYet && researchCount === 0 && tab === "research") {
            sidebarTab.set("questions");
        }
    }, [noStationYet, researchCount, tab]);
    // The Move card's period: counted down; when it's over the game goes on
    // by itself (whichever phone notices first).
    useTick(!!move);
    const moveLeft = move ? move.endsAt - serverNow() : 0;
    const resumedFor = useRef<number | null>(null);
    useEffect(() => {
        if (!move || moveLeft > 0 || resumedFor.current === move.startedAt)
            return;
        resumedFor.current = move.startedAt;
        void sendOp({ type: "resumeMove" });
    }, [move, moveLeft]);
    useEffect(() => {
        if (!stationsTab && tab === "stations") sidebarTab.set("questions");
    }, [stationsTab, tab]);

    /** The hider's own probing questions, before the station is set. */
    const research = $questions.filter((q) => q.data.research);
    const asked = $questions.filter((q) => !q.data.research);
    const $open = useStore(openQuestion);
    const tabOptions: { value: SidebarTab; label: string }[] = sections.map(
        (section) => ({ value: section.value, label: sectionLabel(section) }),
    );
    /** The ask flow's screen, over the list (null: not asking). */
    const askScreen = (forResearch: boolean) =>
        $ask && $ask.research === forResearch ? (
            $ask.kind === null ? (
                <QuestionTypes />
            ) : (
                <QuestionSubtype key={$ask.kind} kind={$ask.kind} />
            )
        ) : null;
    const asking = askScreen(false);
    // The hider, before the station is set (or with research left): the
    // seekers' questions and their own research, one toggle (round 41).
    const researchToggle =
        hider && $game && (noStationYet || researchCount > 0) ? (
            <div className="px-2 pt-2" data-tutorial-id="tab-research">
                <SegmentedControl
                    label="Questions to show"
                    options={[
                        { value: "questions", label: "The seekers'" },
                        {
                            value: "research",
                            label:
                                researchCount > 0
                                    ? `My research (${researchCount})`
                                    : "My research",
                        },
                    ]}
                    value={tab === "research" ? "research" : "questions"}
                    onValueChange={(value) =>
                        sidebarTab.set(value as SidebarTab)
                    }
                />
            </div>
        ) : null;
    // A photo question, pushed over the Questions list.
    const photoScreen =
        $screen?.kind === "photo" ? (
            <PhotoScreen key={$screen.id} id={$screen.id} />
        ) : null;
    const askingResearch = askScreen(true);
    const cards = (list: Question[]) =>
        list.map((question) => {
            switch (question.id) {
                case "radius":
                    return (
                        <RadiusQuestionComponent
                            data={question.data}
                            key={question.key}
                            questionKey={question.key}
                        />
                    );
                case "thermometer":
                    return (
                        <ThermometerQuestionComponent
                            data={question.data}
                            key={question.key}
                            questionKey={question.key}
                        />
                    );
                case "tentacles":
                    return (
                        <TentacleQuestionComponent
                            data={question.data}
                            key={question.key}
                            questionKey={question.key}
                        />
                    );
                case "matching":
                    return (
                        <MatchingQuestionComponent
                            data={question.data}
                            key={question.key}
                            questionKey={question.key}
                        />
                    );
                case "measuring":
                    return (
                        <MeasuringQuestionComponent
                            data={question.data}
                            key={question.key}
                            questionKey={question.key}
                        />
                    );
                default:
                    return null;
            }
        });
    /** The open question's card, in place of the list (null: the list). */
    const openIn = (list: Question[], ownResearch: boolean) => {
        const question = list.find((q) => q.key === $open);
        const row =
            question &&
            questionRows(list, ownResearch ? null : $game).find(
                (r) => r.key === question.key,
            );
        if (!question || !row) return null;
        return (
            <QuestionHeading.Provider
                value={{
                    title: questionTitle(row.number, row.kind, ownResearch),
                    back: () => openQuestion.set(null),
                }}
            >
                {cards([question])}
            </QuestionHeading.Provider>
        );
    };
    const openAsked = openIn(asked, false);
    const openResearch = openIn(research, true);

    return (
        <Sidebar>
            <div className="flex items-center justify-between">
                <h2 className="ml-4 mt-4 font-poppins text-2xl">
                    {tab === "questions"
                        ? "Questions"
                        : tab === "stations"
                          ? hider
                              ? "Hider"
                              : "Stations"
                          : tab === "menu"
                            ? "Menu"
                            : tab === "research"
                              ? "Research"
                              : "Cards"}
                </h2>
                <a
                    href={withBase("reference/")}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 ml-auto mr-3 text-sm text-blue-400 underline"
                >
                    Reference
                </a>
            </div>
            {$game && $connection === "retrying" && (
                <p
                    className="mx-2 mt-2 rounded-md border border-amber-500/60 bg-amber-950/40 px-2 py-1 text-xs text-amber-200"
                    data-testid="connection-banner"
                >
                    No connection to the game: reconnecting. Questions and
                    answers wait until it&apos;s back.
                </p>
            )}
            {$game && $role === "seeker" && <LocationPrompt />}
            <div className="px-2 pt-2">
                {/* Phones have the tab bar at the bottom instead. */}
                {!isMobile && (
                    <div data-tutorial-id="sidebar-tabs">
                        <SegmentedControl
                            label="Sidebar section"
                            options={tabOptions}
                            value={tab === "research" ? "questions" : tab}
                            onValueChange={sidebarTab.set}
                            disabled={overLimit}
                        />
                    </div>
                )}
                {noStationYet && tab !== "stations" && tab !== "menu" && (
                    <p
                        className="mt-1 text-xs text-amber-400"
                        data-testid="no-station-note"
                    >
                        No station yet: pick it in the Hider tab. Until then
                        answers come from the station you tapped, or your pin.
                    </p>
                )}
                {overLimit && (
                    <p className="mt-1 text-xs text-amber-400">
                        Too many cards in your hand: play or discard down to the
                        limit first.
                    </p>
                )}
                {move && (
                    <div
                        className="mt-2 rounded-md border border-orange-500/60 bg-orange-950/40 p-2 text-xs"
                        data-testid="move-banner"
                    >
                        <p>
                            <strong>Move.</strong>{" "}
                            {$role === "hider"
                                ? "The seekers are frozen and know your old station. Pick your new station in the Hider tab, get there, then continue."
                                : `${move.by} left ${
                                      move.station?.name ?? "their station"
                                  } (shown on the map) and is moving. No questions until they continue; the questions so far are in Cards → History.`}{" "}
                            <span data-testid="move-countdown">
                                {moveLeft > 0
                                    ? `${formatDuration(moveLeft)} left; the game goes on by itself after that.`
                                    : "The period is over: the game goes on."}
                            </span>
                        </p>
                        {$role === "hider" && (
                            <Button
                                size="sm"
                                className="mt-1"
                                onClick={() =>
                                    void sendOp({ type: "resumeMove" })
                                }
                            >
                                Continue: the game goes on
                            </Button>
                        )}
                    </div>
                )}
            </div>
            <SidebarContent className={tab === "stations" ? "" : "hidden"}>
                {hider ? <HiderPanel /> : <StationsPanel />}
            </SidebarContent>
            {tab === "menu" && (
                <SidebarContent>
                    <MenuScreen />
                </SidebarContent>
            )}
            {tab === "curses" && (
                <SidebarContent>
                    <CardsPanel />
                </SidebarContent>
            )}
            <SidebarContent className={tab === "questions" ? "" : "hidden"}>
                {asking}
                {!asking && photoScreen}
                <div
                    className={cn(
                        "contents",
                        (asking || photoScreen) && "hidden",
                    )}
                >
                    {!openAsked && researchToggle}
                    <CurseBanner />
                    {openAsked}
                    {!openAsked &&
                        $game &&
                        $role === "seeker" &&
                        (($game.deck?.freeQuestions ?? 0) > 0 ||
                            ($game.freeQuestions ?? 0) > 0) && (
                            <p
                                className="mx-2 mt-2 rounded-md border border-green-500/60 bg-green-950/40 px-2 py-1 text-xs"
                                data-testid="free-question-note"
                            >
                                Your next question is free: the hider draws
                                nothing for it.
                            </p>
                        )}
                    <SidebarMenu
                        className={cn("px-2 pt-2", openAsked && "hidden")}
                        data-tutorial-id="add-questions-buttons"
                    >
                        {$game && $role === "hider" ? (
                            <p className="px-2 py-1 text-xs text-slate-400">
                                The seekers ask; you answer. Questions appear
                                here once they send them.
                            </p>
                        ) : (
                            <SidebarMenuItem>
                                <Button
                                    className="min-h-11 w-full font-semibold"
                                    disabled={$isLoading}
                                    data-tutorial-id="ask-question"
                                    onClick={() => openAsk()}
                                >
                                    <Plus className="h-5 w-5" aria-hidden />
                                    Ask a question
                                </Button>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                    {!openAsked && (
                        <>
                            <NotePinList />
                            <QuestionList list={asked} />
                            <PhotoRows />
                            <OtherPhotos />
                        </>
                    )}
                </div>
            </SidebarContent>
            <SidebarContent className={tab === "research" ? "" : "hidden"}>
                {askingResearch}
                <div className={cn("contents", askingResearch && "hidden")}>
                    {!openResearch && researchToggle}
                    {openResearch}
                    <SidebarMenu
                        className={cn("px-2 pt-2", openResearch && "hidden")}
                    >
                        <p
                            className="px-2 py-1 text-xs text-slate-400"
                            data-testid="research-note"
                        >
                            Only on your phone: probe a hiding spot before you
                            commit. The answers follow the station you tapped
                            (or your pin). These questions go when you confirm
                            your station.
                        </p>
                        <SidebarMenuItem>
                            <Button
                                className="min-h-11 w-full font-semibold"
                                disabled={$isLoading}
                                data-testid="add-research"
                                onClick={() => openAsk(true)}
                            >
                                Add a research question
                            </Button>
                        </SidebarMenuItem>
                    </SidebarMenu>
                    {!openResearch && <QuestionList list={research} research />}
                </div>
            </SidebarContent>
            <SidebarGroup>
                {$game && <RoundClock />}
                <SidebarGroupContent
                    className={tab === "questions" ? "" : "hidden"}
                >
                    <SidebarMenu>
                        {$questions.length > 0 && !$game && !openAsked && (
                            <SidebarMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <SidebarMenuButton
                                            disabled={$isLoading}
                                            className="text-red-300"
                                        >
                                            Clear all questions
                                        </SidebarMenuButton>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                Delete all {$questions.length}{" "}
                                                questions?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                You can undo this for a few
                                                seconds afterwards.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() =>
                                                    showUndoToast(
                                                        "All questions deleted.",
                                                        clearQuestions(),
                                                    )
                                                }
                                            >
                                                Delete all
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </Sidebar>
    );
};
