import { useStore } from "@nanostores/react";

import { CardFace } from "@/components/game/CardFace";
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
import { cardInfo } from "@/lib/game/deck";
import { gameState } from "@/lib/game/session";

/**
 * "Play Veto?": the card's face, what it does, Cancel or Play. Instead of
 * the browser's own confirm (the hider's answer screen, a photo question).
 */
export const PlayCardConfirm = ({
    cardId,
    title,
    text,
    action,
    onPlay,
    onClose,
}: {
    /** The card to play, or null when the dialog is closed. */
    cardId: string | null;
    title: string;
    text: string;
    action: string;
    onPlay: () => void;
    onClose: () => void;
}) => {
    const $game = useStore(gameState);
    return (
        <AlertDialog
            open={cardId !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <AlertDialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{text}</AlertDialogDescription>
                </AlertDialogHeader>
                {cardId && (
                    <CardFace
                        card={cardInfo(cardId)}
                        size={$game?.settings.size}
                        className="mx-auto max-h-[40vh] max-w-[220px]"
                    />
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onPlay}>
                        {action}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export const VETO_ID = "powerup_veto_question";
export const RANDOMIZE_ID = "powerup_randomize_question";
