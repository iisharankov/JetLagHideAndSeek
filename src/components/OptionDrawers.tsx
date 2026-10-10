import { useStore } from "@nanostores/react";
import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

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
    playAreaEditing,
    setupDialog,
    showTutorial,
} from "@/lib/context";
import { resumeGame } from "@/lib/game/session";
import { parseSharedGame } from "@/lib/sharedGame";
import { readSharedGameFromUrl } from "@/lib/shareLinks";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";

import { GamePanel } from "./game/GamePanel";
import { GamePopups } from "./game/GamePopups";
import { GameSetupDialog } from "./game/GameSetupDialog";
import { JoinDialog } from "./game/JoinDialog";
import { MenuGroup } from "./MenuGroup";
import { SettingsPanel } from "./SettingsPanel";
import { ShareCopyDialog } from "./ShareCopyDialog";
import { offerSharedGame, SharedGameDialog } from "./SharedGameDialog";
import { Button } from "./ui/button";
import { SegmentedControl } from "./ui/toggle-card";

export const OptionDrawers = ({ className }: { className?: string }) => {
    const isOptionsOpen = useStore(menuOpen);
    const setOptionsOpen = menuOpen.set;
    const [copyOpen, setCopyOpen] = useState(false);
    const [menuTab, setMenuTab] = useState<MenuTab>("game");
    const $setup = useStore(setupDialog);
    const $playAreaEditing = useStore(playAreaEditing);

    useEffect(() => {
        resumeGame();
        const params = new URL(window.location.toString()).searchParams;

        readSharedGameFromUrl(params)
            .then((shared) => {
                if (!shared) return;
                window.history.replaceState({}, "", window.location.pathname);
                offerSharedGame(parseSharedGame(shared.text), shared.source);
            })
            .catch((error) =>
                toast.error(
                    `Couldn't open the shared game: ${errorMessage(error)}`,
                ),
            );
    }, []);

    // Choosing the play area happens on the map, under the menu.
    useEffect(() => {
        if ($playAreaEditing) setOptionsOpen(false);
    }, [$playAreaEditing]);

    return (
        <div className={cn("flex justify-end gap-2", className)}>
            <SharedGameDialog />
            <GamePopups />
            <JoinDialog />
            {$setup !== null && (
                <GameSetupDialog
                    open
                    onOpenChange={(open) => !open && setupDialog.set(null)}
                    mode={$setup}
                />
            )}
            <ShareCopyDialog open={copyOpen} onOpenChange={setCopyOpen} />
            <Drawer
                open={isOptionsOpen}
                onOpenChange={setOptionsOpen}
                direction="right"
                shouldScaleBackground={false}
            >
                <DrawerTrigger asChild>
                    <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-black/30 bg-white text-black shadow-md hover:bg-[#f4f4f4]"
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
                            ]}
                            value={menuTab}
                            onValueChange={setMenuTab}
                        />
                        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
                            {menuTab === "game" && (
                                <>
                                    <GamePanel />
                                    <MenuGroup title="Help">
                                        <Button
                                            variant="outline"
                                            onClick={() => setCopyOpen(true)}
                                            data-tutorial-id="share-questions-button"
                                        >
                                            Share a copy, save or load a file…
                                        </Button>
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
                                            <Button
                                                variant="outline"
                                                className="col-span-2"
                                                onClick={() => {
                                                    setOptionsOpen(false);
                                                    showTutorial.set(true);
                                                }}
                                            >
                                                Tutorial
                                            </Button>
                                        </div>
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
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
};

type MenuTab = "game" | "settings";
