import { useStore } from "@nanostores/react";
import { MenuIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { withBase } from "@/lib/config";
import {
    allowPublicOverpass,
    animateMapMovements,
    autoSave,
    autoZoom,
    baseTileLayer,
    customInitPreference,
    defaultCustomQuestions,
    defaultUnit,
    followMe,
    hidingZone,
    leafletMapContext,
    menuOpen,
    overpassCustomHost,
    planningModeEnabled,
    playAreaEditing,
    questions,
    referencePlacesMode,
    regionChoice,
    setupDialog,
    showTutorial,
    triggerLocalRefresh,
} from "@/lib/context";
import { resumeGame } from "@/lib/game/session";
import { downloadSharedGame, uploadSharedGame } from "@/lib/shareApi";
import {
    applySharedGame,
    parseSharedGame,
    summarizeSharedGame,
} from "@/lib/sharedGame";
import { cn, compress, decompress, shareOrFallback } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";
import type { RegionChoice } from "@/maps/regionRules";

import { GamePanel } from "./game/GamePanel";
import { GamePopups } from "./game/GamePopups";
import { GameSetupDialog } from "./game/GameSetupDialog";
import { offerSharedGame, SharedGameDialog } from "./SharedGameDialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";
import { UnitSelect } from "./UnitSelect";

const SHARE_URL_PARAM = "share"; // id on our own share service
const HIDING_ZONE_COMPRESSED_URL_PARAM = "hzc"; // the whole game in the link
const HIDING_ZONE_URL_PARAM = "hz"; // legacy, uncompressed
const FETCH_URL_PARAM = "url"; // a game file hosted somewhere else
const MAX_LINK_LENGTH = 2000;

/** The shared game in the page's URL, if any. */
const readSharedGameFromUrl = async (
    params: URLSearchParams,
): Promise<{ text: string; source?: string } | null> => {
    const shareId = params.get(SHARE_URL_PARAM);
    if (shareId) return { text: await downloadSharedGame(shareId) };

    const compressed = params.get(HIDING_ZONE_COMPRESSED_URL_PARAM);
    if (compressed) return { text: await decompress(compressed) };

    const legacy = params.get(HIDING_ZONE_URL_PARAM);
    if (legacy) return { text: atob(legacy) };

    const url = params.get(FETCH_URL_PARAM);
    if (url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }
        return { text: await response.text(), source: url };
    }

    return null;
};

export const OptionDrawers = ({ className }: { className?: string }) => {
    useStore(triggerLocalRefresh);
    const $defaultCustomQuestions = useStore(defaultCustomQuestions);
    const $defaultUnit = useStore(defaultUnit);
    const $regionChoice = useStore(regionChoice);
    const $animateMapMovements = useStore(animateMapMovements);
    const $autoZoom = useStore(autoZoom);
    const $planningMode = useStore(planningModeEnabled);
    const $baseTileLayer = useStore(baseTileLayer);
    const $followMe = useStore(followMe);
    const $referencePlaces = useStore(referencePlacesMode);
    const $customInitPref = useStore(customInitPreference);
    const $allowPublicOverpass = useStore(allowPublicOverpass);
    const $autoSave = useStore(autoSave);
    const $overpassCustomHost = useStore(overpassCustomHost);
    const isOptionsOpen = useStore(menuOpen);
    const setOptionsOpen = menuOpen.set;
    const [copyOpen, setCopyOpen] = useState(false);
    const [menuTab, setMenuTab] = useState<MenuTab>("game");
    const $setup = useStore(setupDialog);
    const $playAreaEditing = useStore(playAreaEditing);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    /** Loads a game the player chose explicitly (file or clipboard). */
    const loadHidingZone = (text: string) => {
        try {
            const game = parseSharedGame(text);
            applySharedGame(game);
            toast.success(`Loaded ${summarizeSharedGame(game)}.`, {
                autoClose: 2000,
            });
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    const shareGame = async () => {
        const game = JSON.stringify(hidingZone.get());
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        let shareUrl: string;

        try {
            shareUrl = `${baseUrl}?${SHARE_URL_PARAM}=${await uploadSharedGame(game)}`;
        } catch (error) {
            console.warn("Share service unreachable, using a long link", error);
            shareUrl = `${baseUrl}?${HIDING_ZONE_COMPRESSED_URL_PARAM}=${await compress(game)}`;
            if (shareUrl.length > MAX_LINK_LENGTH) {
                toast.info(
                    "The share service isn't reachable and the game is too big for a link, so it was saved as a file instead.",
                );
                saveToFile();
                return;
            }
        }

        const result = await shareOrFallback(shareUrl);
        if (result === false) {
            toast.error(`Couldn't copy the link. Here it is: ${shareUrl}`, {
                className: "p-0 w-[1000px]",
            });
        } else if (result === "clipboard") {
            toast.success("Game link copied to the clipboard", {
                autoClose: 2000,
            });
        }
    };

    const saveToFile = () => {
        try {
            const data = JSON.stringify(hidingZone.get(), null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.download = `jetlag-hiding-zone-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Hiding zone saved to file", { autoClose: 2000 });
        } catch (e) {
            console.error("Failed to save file:", e);
            toast.error(`Failed to save file: ${e}`);
        }
    };

    const loadFromFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === "string") {
                loadHidingZone(result);
            } else {
                toast.error("Failed to read file");
            }
        };
        reader.onerror = () => {
            toast.error("Failed to read file");
        };
        reader.readAsText(file);
    };

    const setPlanningMode = (on: boolean) => {
        if (!on) {
            leafletMapContext.get()?.eachLayer((layer: any) => {
                if (layer.questionKey || layer.questionKey === 0) {
                    leafletMapContext.get()?.removeLayer(layer);
                }
            });
        } else {
            questions.set([...questions.get()]);
        }
        planningModeEnabled.set(on);
    };

    const copyGame = () => {
        if (!navigator?.clipboard)
            return toast.error("Clipboard not supported");
        navigator.clipboard.writeText(JSON.stringify(hidingZone.get()));
        toast.success("Game copied", { autoClose: 2000 });
    };

    const pasteGame = () => {
        if (!navigator?.clipboard)
            return toast.error("Clipboard not supported");
        navigator.clipboard.readText().then(loadHidingZone);
    };

    return (
        <div className={cn("flex justify-end gap-2", className)}>
            <SharedGameDialog />
            <GamePopups />
            <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
                <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                    <DialogHeader>
                        <DialogTitle>Share a copy</DialogTitle>
                        <DialogDescription>
                            A snapshot (not live) of the play area, questions
                            and hiding zone settings. Anyone opening it is asked
                            before their own game is replaced.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2">
                        <Button className="col-span-2" onClick={shareGame}>
                            Share a copy as a link
                        </Button>
                        <Button variant="outline" onClick={saveToFile}>
                            Save to file
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Load from file
                        </Button>
                        <Button variant="outline" onClick={copyGame}>
                            Copy game
                        </Button>
                        <Button variant="outline" onClick={pasteGame}>
                            Paste game
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {$setup !== null && (
                <GameSetupDialog
                    open
                    onOpenChange={(open) => !open && setupDialog.set(null)}
                    mode={$setup}
                />
            )}
            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadFromFile(file);
                    e.target.value = "";
                }}
            />
            <Drawer open={isOptionsOpen} onOpenChange={setOptionsOpen}>
                <DrawerTrigger asChild>
                    <Button
                        className="shadow-md"
                        data-tutorial-id="menu-button"
                        onClick={() => setMenuTab("game")}
                    >
                        <MenuIcon className="mr-1 h-4 w-4" />
                        Menu
                    </Button>
                </DrawerTrigger>
                <DrawerContent>
                    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pb-6">
                        <DrawerHeader className="px-0">
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
                        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pb-2">
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
                                    </MenuGroup>
                                </>
                            )}
                            {menuTab === "settings" && (
                                <>
                                    <MenuGroup title="Game rules">
                                        <Label>Local rules</Label>
                                        <Select
                                            trigger="Local rules"
                                            options={{
                                                auto: "Automatic (by play area)",
                                                standard:
                                                    "Standard Jet Lag rules",
                                                switzerland: "Switzerland",
                                            }}
                                            value={$regionChoice}
                                            onValueChange={(v) =>
                                                regionChoice.set(
                                                    v as RegionChoice,
                                                )
                                            }
                                        />
                                        <p className="text-xs text-slate-400">
                                            Swiss rules: &quot;major city&quot;
                                            means 100,000+ people, coastline and
                                            7-Eleven questions are hidden and
                                            the lake shore question is added.
                                        </p>
                                        <Label>Default unit</Label>
                                        <UnitSelect
                                            unit={$defaultUnit}
                                            onChange={defaultUnit.set}
                                        />
                                    </MenuGroup>
                                    <MenuGroup title="Map">
                                        <Label>Reference places</Label>
                                        <SegmentedControl
                                            label="Reference places"
                                            options={[
                                                {
                                                    value: "active",
                                                    label: "Active question",
                                                },
                                                {
                                                    value: "all",
                                                    label: "All questions",
                                                },
                                                { value: "off", label: "Off" },
                                            ]}
                                            value={$referencePlaces}
                                            onValueChange={
                                                referencePlacesMode.set
                                            }
                                        />
                                        <p className="text-xs text-slate-400">
                                            A star on the place a question
                                            measures from, dots on the other
                                            candidates and the seeker&apos;s
                                            zone outline. The active question is
                                            the card you last opened, tapped or
                                            added.
                                        </p>
                                        <ToggleCard
                                            title="Follow me (GPS)"
                                            description="Show your own position on the map."
                                            checked={$followMe}
                                            onCheckedChange={followMe.set}
                                        />
                                        <ToggleCard
                                            title="Auto zoom"
                                            description="Zoom to what's left after each answer."
                                            checked={$autoZoom}
                                            onCheckedChange={autoZoom.set}
                                        />
                                        <ToggleCard
                                            title="Animate map movements"
                                            checked={$animateMapMovements}
                                            onCheckedChange={
                                                animateMapMovements.set
                                            }
                                        />
                                        <Label>Base map</Label>
                                        <Select
                                            trigger="Base map style"
                                            options={{
                                                selfhosted:
                                                    "Own server (light)",
                                                "selfhosted-dark":
                                                    "Own server (dark)",
                                                osmcarto:
                                                    "OpenStreetMap Carto (external)",
                                            }}
                                            value={$baseTileLayer}
                                            onValueChange={(v) =>
                                                baseTileLayer.set(v as any)
                                            }
                                        />
                                    </MenuGroup>
                                    <MenuGroup title="Questions">
                                        <ToggleCard
                                            title="Planning mode"
                                            description="Unlocked questions only draw where they would split the map, without applying an answer."
                                            checked={$planningMode}
                                            onCheckedChange={setPlanningMode}
                                        />
                                        <ToggleCard
                                            title="Auto save"
                                            description="Apply every change straight away. Off: changes wait for Save."
                                            checked={$autoSave}
                                            onCheckedChange={autoSave.set}
                                        />
                                        <ToggleCard
                                            title="Default to custom questions"
                                            checked={$defaultCustomQuestions}
                                            onCheckedChange={
                                                defaultCustomQuestions.set
                                            }
                                        />
                                        <Label>New custom questions</Label>
                                        <Select
                                            trigger="New custom default"
                                            options={{
                                                ask: "Ask each time",
                                                blank: "Start blank",
                                                prefill: "Copy from current",
                                            }}
                                            value={$customInitPref}
                                            onValueChange={(v) =>
                                                customInitPreference.set(
                                                    v as any,
                                                )
                                            }
                                        />
                                    </MenuGroup>
                                    <MenuGroup title="Map data">
                                        <p className="text-xs text-slate-400">
                                            Questions are answered from this
                                            app&apos;s own server.
                                        </p>
                                        <Input
                                            type="text"
                                            value={$overpassCustomHost}
                                            onChange={(e) =>
                                                overpassCustomHost.set(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Extra Overpass server (optional)"
                                        />
                                        <ToggleCard
                                            title="Fall back to public Overpass servers"
                                            description="Public servers are often overloaded, and they see the play area and question locations."
                                            checked={$allowPublicOverpass}
                                            onCheckedChange={
                                                allowPublicOverpass.set
                                            }
                                        />
                                    </MenuGroup>
                                </>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
};

type MenuTab = "game" | "settings";

const MenuGroup = ({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) => (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3">
        <h3 className="text-sm font-semibold font-poppins text-slate-200">
            {title}
        </h3>
        {children}
    </section>
);
