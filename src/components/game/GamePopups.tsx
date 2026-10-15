import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { notify } from "@/lib/game/alerts";
import { type CardInfo, CARDS, customCardInfo } from "@/lib/game/deck";
import { gameEvents, needsAttention } from "@/lib/game/events";
import { gameRole, gameState } from "@/lib/game/session";
import type { GameState } from "@/lib/game/types";

import { CardFace } from "./CardFace";

/** Powerups the seekers must know about at once. */
const IMPORTANT = new Set(["Veto Question", "Randomize Question", "Move"]);

interface Popup {
    key: string;
    title: string;
    card?: CardInfo;
    photo?: string;
    note?: string;
}

const cardNamed = (state: GameState, name: string) => {
    const printed = CARDS.find((card) => card.name === name);
    if (printed) return { card: printed };
    const own = state.settings.customCards.find((card) => card.name === name);
    return own ? { card: customCardInfo(own), photo: own.photo } : {};
};

/**
 * The news of a shared game, as it reaches this phone: a toast with a buzz
 * and a beep for questions, answers and photos; a popup with the card for
 * curses and the powerups that change the seekers' game (or every card,
 * when the game is set up that way).
 */
export const GamePopups = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const previous = useRef<GameState | null>(null);
    const [queue, setQueue] = useState<Popup[]>([]);

    useEffect(() => {
        const before = previous.current;
        previous.current = $game;
        if (!$game) return;
        const events = gameEvents(before, $game, $role);
        const popups: Popup[] = [];
        for (const event of events) {
            if (
                event.kind === "powerup" &&
                $game.settings.cardPopups !== "all" &&
                !IMPORTANT.has(event.name ?? "")
            ) {
                continue;
            }
            if (
                event.kind === "curse" ||
                event.kind === "powerup" ||
                event.kind === "move"
            ) {
                popups.push({
                    key: event.key,
                    title: event.title,
                    ...cardNamed($game, event.name ?? ""),
                    note: event.body,
                });
            } else {
                toast.info(
                    event.body ? `${event.title}: ${event.body}` : event.title,
                    { toastId: event.key, autoClose: 8000 },
                );
            }
        }
        if (events.length > 0) {
            // A sound only for news worth one (not "the rest is over").
            notify(
                events[0].title,
                events[0].body,
                events.some(needsAttention),
            );
        }
        if (popups.length > 0) setQueue((current) => [...current, ...popups]);
    }, [$game, $role]);

    const current = queue[0];
    return (
        <Dialog
            open={current !== undefined}
            onOpenChange={(open) =>
                !open && setQueue((items) => items.slice(1))
            }
        >
            <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                {current && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{current.title}</DialogTitle>
                        </DialogHeader>
                        {current.card && (
                            <CardFace
                                card={current.card}
                                size={$game?.settings.size}
                                photo={current.photo}
                                className="mx-auto max-h-[55vh] max-w-[340px]"
                            />
                        )}
                        {current.note && (
                            <p className="text-sm">{current.note}</p>
                        )}
                        <Button
                            onClick={() => setQueue((items) => items.slice(1))}
                        >
                            OK
                            {queue.length > 1
                                ? ` (${queue.length - 1} more)`
                                : ""}
                        </Button>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
