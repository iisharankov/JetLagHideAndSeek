// Menu → Game → Share a copy, save or load a file.
import { useRef } from "react";
import { toast } from "react-toastify";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { hidingZone } from "@/lib/context";
import { uploadSharedGame } from "@/lib/shareApi";
import {
    applySharedGame,
    parseSharedGame,
    summarizeSharedGame,
} from "@/lib/sharedGame";
import {
    HIDING_ZONE_COMPRESSED_URL_PARAM,
    MAX_LINK_LENGTH,
    SHARE_URL_PARAM,
} from "@/lib/shareLinks";
import { compress, shareOrFallback } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";

import { Button } from "./ui/button";

/**
 * Menu → Game → "Share a copy, save or load a file": a snapshot of the play
 * area, questions and hiding zone settings as a link, a file or text.
 */
export const ShareCopyDialog = ({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
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
        </>
    );
};
