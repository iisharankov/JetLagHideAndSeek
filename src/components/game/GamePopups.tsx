import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";

import { CardText } from "@/components/RulesText";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { withBase } from "@/lib/config";
import { type CardInfo, CARDS, customCardInfo } from "@/lib/game/deck";
import { gameRole, gameState } from "@/lib/game/session";
import type { GameState } from "@/lib/game/types";
import { cardImage } from "@/lib/rules/cards";

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
 * What the hider plays pops up on the seekers' phones: curses always, and
 * the powerups that change their game (veto, randomize, move), or every
 * card when the game is set up that way.
 */
export const GamePopups = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const seen = useRef<{ game: string; ids: Set<string> } | null>(null);
    const [queue, setQueue] = useState<Popup[]>([]);

    useEffect(() => {
        if (!$game) {
            seen.current = null;
            return;
        }
        const ids = new Set([
            ...$game.curses.map((curse) => `c${curse.id}`),
            ...$game.powerups.map((powerup) => `p${powerup.id}`),
        ]);
        // The first state of a game: nothing new to announce.
        if (!seen.current || seen.current.game !== $game.id) {
            seen.current = { game: $game.id, ids };
            return;
        }
        const before = seen.current.ids;
        seen.current = { game: $game.id, ids };
        if ($role === "hider") return;

        const fresh: Popup[] = [];
        for (const curse of $game.curses) {
            if (before.has(`c${curse.id}`)) continue;
            fresh.push({
                key: `c${curse.id}`,
                title: `The hider cast ${curse.name}`,
                ...cardNamed($game, curse.name),
            });
        }
        for (const powerup of $game.powerups) {
            if (before.has(`p${powerup.id}`)) continue;
            if (
                $game.settings.cardPopups !== "all" &&
                !IMPORTANT.has(powerup.name)
            ) {
                continue;
            }
            fresh.push({
                key: `p${powerup.id}`,
                title: `${powerup.by || "The hider"} played ${powerup.name}`,
                ...cardNamed($game, powerup.name),
                note:
                    powerup.name === "Move"
                        ? `The hider is moving to a new station${
                              $game.move?.station
                                  ? ` and was at ${$game.move.station.name}`
                                  : ""
                          }. No questions until they continue; the questions so far are put away (Cards → History).`
                        : undefined,
            });
        }
        if (fresh.length > 0) {
            setQueue((current) => [...current, ...fresh]);
            try {
                navigator.vibrate?.(200);
            } catch {
                // No vibration on this device.
            }
        }
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
                            {current.card?.effect && (
                                <DialogDescription>
                                    <CardText
                                        text={current.card.effect}
                                        size={$game?.settings.size}
                                    />
                                </DialogDescription>
                            )}
                        </DialogHeader>
                        {current.card?.image ? (
                            <img
                                src={withBase(cardImage(current.card.image))}
                                alt={current.card.name}
                                className="mx-auto max-h-[50vh] rounded-md"
                            />
                        ) : current.photo ? (
                            <img
                                src={current.photo}
                                alt={current.card?.name ?? ""}
                                className="mx-auto max-h-[50vh] rounded-md"
                            />
                        ) : null}
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
