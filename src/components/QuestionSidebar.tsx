import { useStore } from "@nanostores/react";
import { SidebarCloseIcon } from "lucide-react";
import { useEffect } from "react";

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
import { withBase } from "@/lib/config";
import {
    autoSave,
    clearQuestions,
    isLoading,
    questions,
    save,
    sidebarTab,
} from "@/lib/context";
import { hand, handLimit } from "@/lib/game/hand";
import { gameRole, gameState, hiderPhone, sendOp } from "@/lib/game/session";

import { AddQuestionDialog } from "./AddQuestionDialog";
import { CardsPanel } from "./game/CardsPanel";
import { NotePinList } from "./game/NotePins";
import { PhotosPanel } from "./game/PhotosPanel";
import { RoundClock } from "./game/RoundClock";
import { HiderPanel as HiderPanelPlain } from "./HiderPanel";
import {
    MatchingQuestionComponent,
    MeasuringQuestionComponent,
    RadiusQuestionComponent,
    TentacleQuestionComponent,
    ThermometerQuestionComponent,
} from "./QuestionCards";
import { StationsPanel as Panel } from "./StationsPanel";

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
    const $autoSave = useStore(autoSave);
    const $isLoading = useStore(isLoading);
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const tab = useStore(sidebarTab);
    // The hider's phone: the Stations tab is the Hider tab.
    const hider = useStore(hiderPhone);
    // Too many cards in the hand: the hider stays in Cards until it's fixed.
    const $hand = useStore(hand);
    const $limit = useStore(handLimit);
    const overLimit =
        hider &&
        ($game?.deck
            ? $game.deck.hand.length > $game.deck.limit
            : $hand.length > $limit);
    useEffect(() => {
        if (overLimit && tab !== "curses") sidebarTab.set("curses");
    }, [overLimit, tab]);
    const move = $game?.move ?? null;
    const activeCurses =
        $game?.curses.filter((curse) => !curse.clearedAt).length ?? 0;
    // The hider: questions waiting for an answer.
    const waitingQuestions =
        $game && $role === "hider"
            ? Object.values($game.questions).filter(
                  (entry) => entry.state === "asked",
              ).length
            : 0;
    const waitingPhotos =
        $game?.photoRequests.filter((request) => !request.photoId).length ?? 0;

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
                          : tab === "photos"
                            ? "Photos"
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
                <SidebarCloseIcon
                    className="mr-2 visible md:hidden"
                    onClick={() => {
                        SidebarContext.get().setOpenMobile(false);
                    }}
                />
            </div>
            <div className="px-2 pt-2">
                <SegmentedControl
                    label="Sidebar section"
                    options={[
                        {
                            value: "questions",
                            label: waitingQuestions
                                ? `Questions (${waitingQuestions})`
                                : "Questions",
                        },
                        {
                            value: "stations",
                            label: hider ? "Hider" : "Stations",
                        },
                        {
                            value: "photos",
                            label: waitingPhotos
                                ? `Photos (${waitingPhotos})`
                                : "Photos",
                        },
                        {
                            value: "curses",
                            label: activeCurses
                                ? `Cards (${activeCurses})`
                                : "Cards",
                        },
                    ]}
                    value={tab}
                    onValueChange={sidebarTab.set}
                    disabled={overLimit}
                />
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
                                  } (shown on the map) and is moving. No questions until they continue; the questions so far are in Cards → History.`}
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
            {tab === "photos" && (
                <SidebarContent>
                    <PhotosPanel />
                </SidebarContent>
            )}
            {tab === "curses" && (
                <SidebarContent>
                    <CardsPanel />
                </SidebarContent>
            )}
            <SidebarContent className={tab === "questions" ? "" : "hidden"}>
                <SidebarMenu
                    className="px-2 pt-2"
                    data-tutorial-id="add-questions-buttons"
                >
                    {$game && $role === "hider" ? (
                        <p className="px-2 py-1 text-xs text-slate-400">
                            The seekers ask; you answer. Questions appear here
                            once they send them.
                        </p>
                    ) : (
                        <SidebarMenuItem>
                            <AddQuestionDialog>
                                <SidebarMenuButton disabled={$isLoading}>
                                    Add Question
                                </SidebarMenuButton>
                            </AddQuestionDialog>
                        </SidebarMenuItem>
                    )}
                </SidebarMenu>
                <NotePinList />
                {$questions.map((question) => {
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
                })}
            </SidebarContent>
            <SidebarGroup>
                {$game && <RoundClock />}
                <SidebarGroupContent
                    className={tab === "questions" ? "" : "hidden"}
                >
                    <SidebarMenu>
                        {$questions.length > 0 && !$game && (
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
                        {!$autoSave && (
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    className="bg-blue-600 p-2 rounded-md font-semibold font-poppins transition-shadow duration-500"
                                    onClick={save}
                                    disabled={$isLoading}
                                >
                                    Save
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </Sidebar>
    );
};
