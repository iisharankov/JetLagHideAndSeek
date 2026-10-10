import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

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
import { gameSettings, hiderMode } from "@/lib/context";
import {
    type CardInfo,
    cardInfo,
    cardLabel,
    CARDS,
    DRAWS,
    handBonusMinutes,
} from "@/lib/game/deck";
import { deckAct, localDeck, newLocalDeck } from "@/lib/game/deckSession";
import {
    bonusMinutes,
    discardCard,
    discardHand as discardRealHand,
    hand,
    type HandCard,
    handLimit,
    keepCard,
} from "@/lib/game/hand";
import { gameRole, gameState, sendOp } from "@/lib/game/session";
import type {
    CurseEntry,
    Draw,
    GameSize,
    PowerupEntry,
} from "@/lib/game/types";
import { cardImage, CURSES, POWERUPS } from "@/lib/rules/cards";
import { cn } from "@/lib/utils";

const SIZE_INDEX: Record<GameSize, number> = { small: 0, medium: 1, large: 2 };

/** Re-renders every 30 s, for the countdowns. */
const useTick = () => {
    const [, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(timer);
    }, []);
};

const time = (at: number) =>
    new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** A card's picture; tap to see it big. */
const CardPicture = ({
    card,
    onOpen,
    selected,
    className,
}: {
    card: CardInfo;
    onOpen: () => void;
    selected?: boolean;
    className?: string;
}) => (
    <button
        type="button"
        aria-label={card.name}
        onClick={onOpen}
        className={cn(
            "block w-full overflow-hidden rounded-md border-2 border-transparent",
            selected && "border-blue-400 ring-2 ring-blue-400",
            className,
        )}
    >
        <img
            src={withBase(cardImage(card.image))}
            alt={card.name}
            loading="lazy"
            className="w-full"
        />
    </button>
);

/** The big view of a card, with its text. */
const CardDialog = ({
    card,
    size,
    onClose,
}: {
    card: CardInfo | null;
    size: GameSize;
    onClose: () => void;
}) => (
    <Dialog open={card !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
            {card && (
                <>
                    <DialogHeader>
                        <DialogTitle>{cardLabel(card.id, size)}</DialogTitle>
                        {card.effect && (
                            <DialogDescription>
                                <CardText text={card.effect} size={size} />
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <img
                        src={withBase(cardImage(card.image))}
                        alt={card.name}
                        className="mx-auto max-h-[65vh] rounded-md"
                    />
                </>
            )}
        </DialogContent>
    </Dialog>
);

/** A card in the hand: picture, name, what you can do with it. */
const HandTile = ({
    card,
    size,
    onOpen,
    onPlay,
    onDiscard,
}: {
    card: CardInfo;
    size: GameSize;
    onOpen: () => void;
    onPlay?: () => void;
    onDiscard: () => void;
}) => (
    <li className="flex flex-col gap-1" data-testid="hand-card">
        <CardPicture card={card} onOpen={onOpen} />
        <p className="line-clamp-2 text-center text-xs leading-tight">
            {cardLabel(card.id, size)}
        </p>
        <div className="flex gap-1">
            {onPlay && (
                <Button
                    size="sm"
                    className={cn(
                        "flex-1",
                        card.kind === "curse"
                            ? "bg-red-700 hover:bg-red-600"
                            : "bg-amber-700 hover:bg-amber-600",
                    )}
                    onClick={onPlay}
                >
                    {card.kind === "curse" ? "Cast" : "Play"}
                </Button>
            )}
            <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onDiscard}
            >
                Discard
            </Button>
        </div>
    </li>
);

const DrawButtons = ({ onPick }: { onPick: (draw: Draw) => void }) => (
    <div className="flex flex-col gap-1">
        {Object.entries(DRAWS).map(([key, draw]) => (
            <Button
                key={key}
                size="sm"
                variant="outline"
                className="justify-start whitespace-normal text-left"
                onClick={() => onPick(draw)}
            >
                {draw.label}: draw {draw.draw}, keep {draw.keep}
            </Button>
        ))}
    </div>
);

/**
 * Sidebar → Cards: the hider's hand (hider's phone only), the curses on the
 * seekers, and the round's history. With the virtual deck the game shuffles
 * and draws; with the real deck the hider records what they keep.
 */
export const CardsPanel = () => {
    useTick();
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $hiderMode = useStore(hiderMode);
    const $settings = useStore(gameSettings);
    const $hand = useStore(hand);
    const $limit = useStore(handLimit);
    const $localDeck = useStore(localDeck);
    const [open, setOpen] = useState<CardInfo | null>(null);
    const [picks, setPicks] = useState<number[]>([]);
    const [drawing, setDrawing] = useState<"pick" | Draw | null>(null);
    const [toKeep, setToKeep] = useState(1);
    const [extra, setExtra] = useState(false);

    const settings = $game?.settings ?? $settings;
    const size = settings.size;
    const virtual = settings.deck === "virtual";
    const hider = $hiderMode !== false && (!$game || $role === "hider");
    const deck = $game ? $game.deck : virtual ? $localDeck : null;

    // Playing alone with the virtual deck: this phone shuffles one.
    useEffect(() => {
        if (!$game && virtual && hider && !$localDeck) newLocalDeck();
    }, [$game, virtual, hider, $localDeck]);

    const playVirtual = (index: number) => {
        const id = deck?.hand[index];
        if (!id) return;
        deckAct({ type: "playCard", index });
        if (id === "powerup_move") {
            if ($game) void sendOp({ type: "clock", action: "pause" });
            toast.info(
                "Move: your hand is discarded and the clock paused. Tell the seekers your station, then pick the new one in the Hider tab.",
                { autoClose: 10000 },
            );
        } else if (id === "powerup_draw_1_expand_1") {
            toast.info(
                "Your hand may hold one more card now; select the card you drew below.",
                { autoClose: 8000 },
            );
        }
    };

    const playReal = (card: HandCard) => {
        if ($game) {
            void sendOp(
                card.kind === "curse"
                    ? { type: "castCurse", name: card.name }
                    : { type: "playPowerup", name: card.name },
            );
        }
        discardCard(card.id);
        if (card.name === "Draw 1, Expand 1") {
            handLimit.set($limit + 1);
            toast.info(
                `Your hand may hold ${$limit + 1} cards now. Add the card you drew (Draw cards → Add a card).`,
                { autoClose: 8000 },
            );
        }
        if (card.name === "Move") {
            discardRealHand();
            if ($game) void sendOp({ type: "clock", action: "pause" });
            toast.info(
                "Move: your hand is discarded and the clock paused. Tell the seekers your station, then pick the new one in the Hider tab.",
                { autoClose: 10000 },
            );
        }
    };

    const realCard = (card: HandCard): CardInfo =>
        CARDS.find((c) => c.image === card.image) ??
        CARDS.find((c) => c.name === card.name && c.kind === card.kind) ?? {
            id: card.name,
            kind: card.kind,
            name: card.name,
            image: "",
        };

    if (!$game && !hider) {
        return (
            <div className="flex flex-col gap-2 p-3 text-sm">
                <p className="rounded-md bg-slate-800 p-2 text-xs text-slate-300">
                    Start a shared game (Menu → Game) to track curses and
                    powerups: the hider plays them from their hand, everyone
                    sees them, the seekers clear curses.
                </p>
                <a
                    href={withBase("reference/#curses")}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline"
                >
                    All curses and their rules
                </a>
            </div>
        );
    }

    const active = ($game?.curses ?? []).filter((c) => !c.clearedAt).reverse();
    const cleared = ($game?.curses ?? []).filter((c) => c.clearedAt).reverse();
    const played: PowerupEntry[] = [...($game?.powerups ?? [])].reverse();
    const log = [...(deck?.log ?? [])].reverse();
    const history = cleared.length + played.length + log.length;

    return (
        <div className="flex flex-col gap-3 p-3 text-sm">
            {hider && virtual && deck && (
                <section
                    className="flex flex-col gap-2 rounded-md border border-yellow-500/50 p-2"
                    data-testid="hand"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold font-poppins">
                            Your hand ({deck.hand.length}/{deck.limit})
                        </h3>
                        <span className="text-xs text-slate-400">
                            {deck.remaining.length} in the deck
                        </span>
                    </div>
                    {deck.hand.length > deck.limit && (
                        <p className="text-xs text-amber-400">
                            Over the limit: play or discard down to {deck.limit}
                            .
                        </p>
                    )}
                    {deck.owed.length > 0 && deck.pending.length === 0 && (
                        <Button
                            onClick={() => deckAct({ type: "drawCards" })}
                            data-testid="select-new-cards"
                        >
                            Select new cards: {deck.owed[0].label} (draw{" "}
                            {deck.owed[0].draw}, keep {deck.owed[0].keep})
                            {deck.owed.length > 1 &&
                                ` +${deck.owed.length - 1}`}
                        </Button>
                    )}
                    {deck.pending.length > 0 && (
                        <div
                            className="flex flex-col gap-2 rounded-md bg-slate-900 p-2"
                            data-testid="pending-cards"
                        >
                            <p className="text-xs">
                                Keep {deck.pendingKeep} of these{" "}
                                {deck.pending.length}: tap to pick.
                            </p>
                            <ul className="grid grid-cols-2 gap-2">
                                {deck.pending.map((id, index) => (
                                    <li key={index}>
                                        <CardPicture
                                            card={cardInfo(id)}
                                            selected={picks.includes(index)}
                                            onOpen={() =>
                                                setPicks(
                                                    picks.includes(index)
                                                        ? picks.filter(
                                                              (i) =>
                                                                  i !== index,
                                                          )
                                                        : [...picks, index],
                                                )
                                            }
                                        />
                                        <p className="line-clamp-2 text-center text-xs leading-tight">
                                            {cardLabel(id, size)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                            <Button
                                disabled={picks.length !== deck.pendingKeep}
                                onClick={() => {
                                    deckAct({ type: "keepCards", picks });
                                    setPicks([]);
                                }}
                            >
                                Keep {picks.length}/{deck.pendingKeep}
                            </Button>
                        </div>
                    )}
                    {deck.hand.length > 0 && (
                        <ul className="grid grid-cols-2 gap-2">
                            {deck.hand.map((id, index) => {
                                const card = cardInfo(id);
                                return (
                                    <HandTile
                                        key={`${id}-${index}`}
                                        card={card}
                                        size={size}
                                        onOpen={() => setOpen(card)}
                                        onPlay={
                                            card.kind === "time"
                                                ? undefined
                                                : () => playVirtual(index)
                                        }
                                        onDiscard={() =>
                                            deckAct({
                                                type: "discardCard",
                                                index,
                                            })
                                        }
                                    />
                                );
                            })}
                        </ul>
                    )}
                    <p className="text-xs">
                        Time bonuses in hand:{" "}
                        <strong>{handBonusMinutes(deck.hand, size)} min</strong>
                        . Added to your hiding time when the round ends (the
                        clock at the bottom).
                    </p>
                    <details
                        open={extra}
                        onToggle={(event) =>
                            setExtra((event.target as HTMLDetailsElement).open)
                        }
                    >
                        <summary className="cursor-pointer text-xs text-slate-400">
                            Extra draw (a question asked again, a card the app
                            missed){$game ? ": the seekers are told" : ""}
                        </summary>
                        <div className="mt-1">
                            <DrawButtons
                                onPick={(draw) => {
                                    deckAct({ type: "drawCards", extra: draw });
                                    setExtra(false);
                                }}
                            />
                            {!$game && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-1"
                                    onClick={newLocalDeck}
                                >
                                    Shuffle a new deck
                                </Button>
                            )}
                        </div>
                    </details>
                </section>
            )}

            {hider && !virtual && (
                <section
                    className="flex flex-col gap-2 rounded-md border border-yellow-500/50 p-2"
                    data-testid="hand"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold font-poppins">
                            Your hand ({$hand.length}/{$limit})
                        </h3>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                setDrawing(drawing === null ? "pick" : null)
                            }
                        >
                            {drawing === null ? "Draw cards" : "Close"}
                        </Button>
                    </div>
                    <p className="text-xs text-slate-400">
                        Only on your phone. The real deck is yours: record what
                        you keep; the time bonuses still in your hand are added
                        at the end of the round.
                    </p>
                    {$hand.length > $limit && (
                        <p className="text-xs text-amber-400">
                            Over the limit: play or discard down to {$limit}.
                        </p>
                    )}
                    {drawing === "pick" && (
                        <div className="flex flex-col gap-1 rounded-md bg-slate-900 p-2">
                            <p className="text-xs text-slate-400">
                                Which question did you answer?
                            </p>
                            <DrawButtons
                                onPick={(draw) => {
                                    setDrawing(draw);
                                    setToKeep(draw.keep);
                                }}
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setDrawing({
                                        draw: 0,
                                        keep: 1,
                                        label: "Any card",
                                    });
                                    setToKeep(1);
                                }}
                            >
                                Add a card
                            </Button>
                        </div>
                    )}
                    {drawing !== null && drawing !== "pick" && (
                        <div className="flex flex-col gap-2 rounded-md bg-slate-900 p-2">
                            <p className="text-xs">
                                {drawing.draw > 0 &&
                                    `${drawing.label}: draw ${drawing.draw}, keep ${drawing.keep}. `}
                                Tap the{" "}
                                {toKeep === 1 ? "card" : `${toKeep} cards`} you
                                kept.
                            </p>
                            <ul className="grid grid-cols-3 gap-1">
                                {CARDS.map((card) => (
                                    <li key={card.id}>
                                        <CardPicture
                                            card={card}
                                            onOpen={() => {
                                                keepCard({
                                                    kind: card.kind,
                                                    name: card.name,
                                                    image: card.image,
                                                    minutes:
                                                        card.minutes?.[
                                                            SIZE_INDEX[size]
                                                        ],
                                                });
                                                if (toKeep <= 1)
                                                    setDrawing(null);
                                                else setToKeep(toKeep - 1);
                                            }}
                                        />
                                        <p className="line-clamp-2 text-center text-[10px] leading-tight">
                                            {cardLabel(card.id, size)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDrawing(null)}
                            >
                                Done
                            </Button>
                        </div>
                    )}
                    {$hand.length > 0 && (
                        <ul className="grid grid-cols-2 gap-2">
                            {$hand.map((card) => {
                                const info = realCard(card);
                                return (
                                    <HandTile
                                        key={card.id}
                                        card={info}
                                        size={size}
                                        onOpen={() => setOpen(info)}
                                        onPlay={
                                            card.kind === "time" || !$game
                                                ? undefined
                                                : () => playReal(card)
                                        }
                                        onDiscard={() => discardCard(card.id)}
                                    />
                                );
                            })}
                        </ul>
                    )}
                    <p className="text-xs">
                        Time bonuses in hand:{" "}
                        <strong>{bonusMinutes($hand)} min</strong>. Added to
                        your hiding time when the round ends (the clock at the
                        bottom).
                    </p>
                </section>
            )}

            {$game && (
                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold font-poppins">
                        On the seekers ({active.length})
                    </h3>
                    {active.length === 0 && (
                        <p className="text-xs text-slate-400">
                            No active curses.
                        </p>
                    )}
                    {active.map((entry: CurseEntry) => {
                        const curse = CURSES.find((c) => c.name === entry.name);
                        const endsAt =
                            curse?.minutes && size
                                ? entry.castAt +
                                  curse.minutes[SIZE_INDEX[size]] * 60_000
                                : undefined;
                        const left = endsAt
                            ? Math.ceil((endsAt - Date.now()) / 60_000)
                            : undefined;
                        return (
                            <div
                                key={entry.id}
                                className="flex flex-col gap-1 rounded-md border border-red-500/60 bg-red-950/40 p-2"
                                data-testid="active-curse"
                            >
                                <p className="font-semibold">{entry.name}</p>
                                {curse && (
                                    <>
                                        <p>
                                            <CardText
                                                text={curse.effect}
                                                size={size}
                                            />
                                        </p>
                                        <p className="text-xs">
                                            <strong>Casting cost: </strong>
                                            <CardText
                                                text={curse.castingCost}
                                                size={size}
                                            />
                                        </p>
                                    </>
                                )}
                                <p className="text-xs text-slate-300">
                                    Cast {time(entry.castAt)}
                                    {left !== undefined &&
                                        (left > 0
                                            ? ` · ${left} min left`
                                            : " · time's up")}
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        void sendOp({
                                            type: "clearCurse",
                                            id: entry.id,
                                        })
                                    }
                                >
                                    Cleared
                                </Button>
                            </div>
                        );
                    })}
                    {$role !== "hider" && virtual && deck && (
                        <p className="text-xs text-slate-400">
                            The hider holds {deck.handSize ?? 0} card
                            {deck.handSize === 1 ? "" : "s"};{" "}
                            {deck.deckSize ?? 0} left in the deck.
                        </p>
                    )}
                </section>
            )}

            {$game && (
                <details className="rounded-md border border-slate-700 p-2">
                    <summary className="cursor-pointer font-semibold font-poppins">
                        History ({history})
                    </summary>
                    <div className="mt-2 flex flex-col gap-2 text-xs">
                        {history === 0 && (
                            <p className="text-slate-400">Nothing yet.</p>
                        )}
                        {played.map((entry) => {
                            const powerup = POWERUPS.find(
                                (p) => p.name === entry.name,
                            );
                            return (
                                <div
                                    key={entry.id}
                                    className="rounded-md border border-amber-500/60 bg-amber-950/30 p-2"
                                    data-testid="played-powerup"
                                >
                                    <p className="font-semibold">
                                        {entry.name} · played{" "}
                                        {time(entry.playedAt)}
                                        {entry.by && ` by ${entry.by}`}
                                    </p>
                                    {powerup && (
                                        <p className="text-slate-300">
                                            <CardText
                                                text={powerup.effect}
                                                size={size}
                                            />
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                        {cleared.map((entry) => (
                            <p key={entry.id} className="text-slate-300">
                                {entry.name}: cast {time(entry.castAt)}, cleared
                                by {entry.clearedBy}
                            </p>
                        ))}
                        {log.map((entry, index) => (
                            <p key={index} className="text-slate-300">
                                {time(entry.at)} {entry.text}
                            </p>
                        ))}
                    </div>
                </details>
            )}

            <CardDialog card={open} size={size} onClose={() => setOpen(null)} />
        </div>
    );
};
