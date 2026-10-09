import { useStore } from "@nanostores/react";
import { SidebarCloseIcon } from "lucide-react";

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
    triggerLocalRefresh,
} from "@/lib/context";
import { gameState } from "@/lib/game/session";

import { AddQuestionDialog } from "./AddQuestionDialog";
import { CursesPanel } from "./game/CursesPanel";
import { NotePinList } from "./game/NotePins";
import { PhotosPanel } from "./game/PhotosPanel";
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
    "chosenStation",
]);

export const QuestionSidebar = () => {
    useStore(triggerLocalRefresh);
    const $questions = useStore(questions);
    const $autoSave = useStore(autoSave);
    const $isLoading = useStore(isLoading);
    const $game = useStore(gameState);
    const tab = useStore(sidebarTab);
    const activeCurses =
        $game?.curses.filter((curse) => !curse.clearedAt).length ?? 0;
    const waitingPhotos =
        $game?.photoRequests.filter((request) => !request.photoId).length ?? 0;

    return (
        <Sidebar>
            <div className="flex items-center justify-between">
                <h2 className="ml-4 mt-4 font-poppins text-2xl">
                    {tab === "questions"
                        ? "Questions"
                        : tab === "stations"
                          ? "Stations"
                          : tab === "photos"
                            ? "Photos"
                            : "Curses"}
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
                        { value: "questions", label: "Questions" },
                        { value: "stations", label: "Stations" },
                        {
                            value: "photos",
                            label: waitingPhotos
                                ? `Photos (${waitingPhotos})`
                                : "Photos",
                        },
                        {
                            value: "curses",
                            label: activeCurses
                                ? `Curses (${activeCurses})`
                                : "Curses",
                        },
                    ]}
                    value={tab}
                    onValueChange={sidebarTab.set}
                />
            </div>
            <SidebarContent className={tab === "stations" ? "" : "hidden"}>
                <StationsPanel />
            </SidebarContent>
            {tab === "photos" && (
                <SidebarContent>
                    <PhotosPanel />
                </SidebarContent>
            )}
            {tab === "curses" && (
                <SidebarContent>
                    <CursesPanel />
                </SidebarContent>
            )}
            <SidebarContent className={tab === "questions" ? "" : "hidden"}>
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
            <SidebarGroup className={tab === "questions" ? "" : "hidden"}>
                <SidebarGroupContent>
                    <SidebarMenu data-tutorial-id="add-questions-buttons">
                        <SidebarMenuItem>
                            <AddQuestionDialog>
                                <SidebarMenuButton disabled={$isLoading}>
                                    Add Question
                                </SidebarMenuButton>
                            </AddQuestionDialog>
                        </SidebarMenuItem>
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
