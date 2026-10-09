import { useStore } from "@nanostores/react";
import { atom } from "nanostores";
import { toast } from "react-toastify";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { questions } from "@/lib/context";
import {
    applySharedGame,
    type SharedGame,
    summarizeSharedGame,
} from "@/lib/sharedGame";

/** A shared game waiting for the player to confirm replacing theirs. */
export const pendingSharedGame = atom<{
    game: SharedGame;
    source?: string;
} | null>(null);

/** Loads a shared game, asking first if it would replace existing questions. */
export const offerSharedGame = (game: SharedGame, source?: string) => {
    if (questions.get().length === 0) {
        applySharedGame(game);
        toast.success(`Loaded ${summarizeSharedGame(game)}.`, {
            autoClose: 3000,
        });
    } else {
        pendingSharedGame.set({ game, source });
    }
};

export const SharedGameDialog = () => {
    const pending = useStore(pendingSharedGame);
    const $questions = useStore(questions);

    if (!pending) return null;

    return (
        <AlertDialog
            open
            onOpenChange={(open) => !open && pendingSharedGame.set(null)}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Load the shared game?</AlertDialogTitle>
                    <AlertDialogDescription>
                        The link contains {summarizeSharedGame(pending.game)}.
                        Loading it replaces your current game (
                        {$questions.length} question
                        {$questions.length === 1 ? "" : "s"}).
                        {pending.source && (
                            <span className="mt-2 block break-all text-xs">
                                From: {pending.source}
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep my game</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            applySharedGame(pending.game);
                            pendingSharedGame.set(null);
                            toast.success("Shared game loaded.", {
                                autoClose: 2000,
                            });
                        }}
                    >
                        Load shared game
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
