import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { CardText } from "@/components/RulesText";
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
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { withBase } from "@/lib/config";
import { chosenStation, gameSettings, hiderMode } from "@/lib/context";
import {
    type CardInfo,
    cardInfo,
    cardLabel,
    CARDS,
    CUSTOM_PREFIX,
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
    CustomCard,
    Draw,
    GameSize,
    PowerupEntry,
} from "@/lib/game/types";
import { CURSES, POWERUPS } from "@/lib/rules/cards";
import { cn } from "@/lib/utils";

import { CardFace } from "./CardFace";

const SIZE_INDEX: Record<GameSize, number> = { small: 0, medium: 1, large: 2 };

/** "Discard N, draw M": how many other cards go. */
const DISCARDS: Record<string, number> = {
    powerup_discard_1_draw_2: 1,
    powerup_discard_2_draw_3: 2,
};

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

const customPhoto = (card: CardInfo, custom: CustomCard[]) =>
    custom.find((own) => CUSTOM_PREFIX + own.id === card.id)?.photo;

/** A card's picture (a blank card with its name for the players' own). */
const CardPicture = ({
    card,
    custom,
    size,
    onOpen,
    selected,
    className,
}: {
    card: CardInfo;
    custom: CustomCard[];
    size: GameSize;
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
        <CardFace card={card} size={size} photo={customPhoto(card, custom)} />
    </button>
);

/** The big view of a card, with its text. */
const CardDialog = ({
    card,
    custom,
    size,
    onClose,
}: {
    card: CardInfo | null;
    custom: CustomCard[];
    size: GameSize;
    onClose: () => void;
}) => (
    <Dialog open={card !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
            {card && (
                <>
                    <DialogHeader>
                        <DialogTitle>
                            {cardLabel(card.id, size, custom)}
                        </DialogTitle>
                        <DialogDescription>
                            {card.kind === "time"
                                ? "Counts at the end of the round if it's still in your hand."
                                : "Tap outside to close."}
                        </DialogDescription>
                    </DialogHeader>
                    <CardFace
                        card={card}
                        size={size}
                        photo={customPhoto(card, custom)}
                        className="mx-auto max-h-[70vh] max-w-[360px]"
                    />
                </>
            )}
        </DialogContent>
    </Dialog>
);

/** A card in the hand: picture, name, what you can do with it. */
const HandTile = ({
    card,
    custom,
    size,
    onOpen,
    onPlay,
    onDiscard,
    selected,
    onSelect,
}: {
    card: CardInfo;
    custom: CustomCard[];
    size: GameSize;
    onOpen: () => void;
    onPlay?: () => void;
    onDiscard: () => void;
    /** Choosing cards to discard for a "Discard N, draw M". */
    selected?: boolean;
    onSelect?: () => void;
}) => (
    <li className="flex flex-col gap-1" data-testid="hand-card">
        <CardPicture
            card={card}
            custom={custom}
            size={size}
            selected={selected}
            onOpen={onOpen}
        />
        <p className="line-clamp-2 text-center text-xs leading-tight">
            {cardLabel(card.id, size, custom)}
        </p>
        {onSelect && (
            <Button
                size="sm"
                variant={selected ? "default" : "outline"}
                onClick={onSelect}
            >
                {selected ? "Discard ✓" : "Discard this"}
            </Button>
        )}
        {!onSelect && (
            <div className="flex flex-col gap-1">
                {onPlay && (
                    <Button
                        size="sm"
                        className={cn(
                            "w-full",
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
                    className="w-full"
                    onClick={onDiscard}
                >
                    Discard
                </Button>
            </div>
        )}
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
 * seekers, and the round's history. With the digital deck the game deals
 * the hider's draws after each answer; with the physical deck the hider
 * records what they keep.
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
    const [swap, setSwap] = useState<{
        index: number;
        need: number;
        picked: number[];
    } | null>(null);
    const [moving, setMoving] = useState<
        | { digital: true; index: number }
        | { digital: false; cardId: string }
        | null
    >(null);

    const settings = $game?.settings ?? $settings;
    const size = settings.size;
    const custom = settings.customCards;
    const digital = settings.deck === "virtual";
    const hider = $hiderMode !== false && (!$game || $role === "hider");
    const deck = $game ? $game.deck : digital ? $localDeck : null;

    // Playing alone with the digital deck: this phone shuffles one.
    useEffect(() => {
        if (!$game && digital && hider && !$localDeck) newLocalDeck();
    }, [$game, digital, hider, $localDeck]);

    const info = (id: string) => cardInfo(id, custom);

    const playDigital = (index: number) => {
        const id = deck?.hand[index];
        if (!id || !deck) return;
        if (id === "powerup_move") {
            setMoving({ digital: true, index });
            return;
        }
        const need = DISCARDS[id];
        if (need) {
            if (deck.hand.length - 1 < need) {
                toast.error(
                    `You need ${need} other card${need === 1 ? "" : "s"} to discard.`,
                );
                return;
            }
            setSwap({ index, need, picked: [] });
            return;
        }
        deckAct({ type: "playCard", index });
        if (id === "powerup_draw_1_expand_1") {
            toast.info(
                "Your hand may hold one more card now; the card you drew is below.",
                { autoClose: 6000 },
            );
        }
    };

    const playReal = (card: HandCard) => {
        if (card.name === "Move") {
            setMoving({ digital: false, cardId: card.id });
            return;
        }
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
    };

    const confirmMove = () => {
        if (!moving) return;
        const station = chosenStation.get();
        if (moving.digital) {
            deckAct({ type: "playCard", index: moving.index, station });
        } else {
            discardRealHand();
            if ($game) void sendOp({ type: "move", station });
        }
        setMoving(null);
        toast.info(
            "Move: your hand is discarded and the clock paused. Pick your new station in the Hider tab, get there, then continue.",
            { autoClose: 10000 },
        );
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
    const moves = [...($game?.moves ?? [])].reverse();
    const history = cleared.length + played.length + log.length + moves.length;
    const handSize = digital ? (deck?.hand.length ?? 0) : $hand.length;
    const limit = digital ? (deck?.limit ?? 6) : $limit;
    const over = hider && handSize > limit;

    return (
        <div className="flex flex-col gap-3 p-3 text-sm">
            {over && (
                <p
                    className="rounded-md border border-amber-500/60 bg-amber-950/40 p-2 text-xs text-amber-200"
                    data-testid="over-limit"
                >
                    <strong>Too many cards:</strong> {handSize} in hand, the
                    limit is {limit}. Play or discard {handSize - limit} before
                    you go on.
                </p>
            )}

            {hider && digital && deck && (
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
                    {deck.pending.length === 0 && (
                        <p className="text-xs text-slate-400">
                            Your cards come by themselves when you answer a
                            question
                            {$game
                                ? " (the rulebook's draw for each kind)."
                                : "."}
                        </p>
                    )}
                    {deck.pending.length > 0 && (
                        <div
                            className="flex flex-col gap-2 rounded-md bg-slate-900 p-2"
                            data-testid="pending-cards"
                        >
                            <p className="text-xs">
                                <strong>Draw cards:</strong> keep{" "}
                                {deck.pendingKeep} of these{" "}
                                {deck.pending.length}. Tap to pick.
                            </p>
                            <ul className="grid grid-cols-2 gap-2">
                                {deck.pending.map((id, index) => {
                                    const picked = picks.includes(index);
                                    return (
                                        <li
                                            key={index}
                                            className="flex flex-col gap-1"
                                        >
                                            <CardPicture
                                                card={info(id)}
                                                custom={custom}
                                                size={size}
                                                selected={picked}
                                                onOpen={() => setOpen(info(id))}
                                            />
                                            <p className="line-clamp-2 text-center text-xs leading-tight">
                                                {cardLabel(id, size, custom)}
                                            </p>
                                            <Button
                                                size="sm"
                                                variant={
                                                    picked
                                                        ? "default"
                                                        : "outline"
                                                }
                                                onClick={() =>
                                                    setPicks(
                                                        picked
                                                            ? picks.filter(
                                                                  (i) =>
                                                                      i !==
                                                                      index,
                                                              )
                                                            : [...picks, index],
                                                    )
                                                }
                                            >
                                                {picked ? "Keep ✓" : "Keep"}
                                            </Button>
                                        </li>
                                    );
                                })}
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
                    {swap && (
                        <div className="flex flex-col gap-2 rounded-md bg-slate-900 p-2">
                            <p className="text-xs">
                                <strong>
                                    {info(deck.hand[swap.index]).name}:
                                </strong>{" "}
                                tap {swap.need} other card
                                {swap.need === 1 ? "" : "s"} to discard, then
                                play it.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    size="sm"
                                    disabled={swap.picked.length !== swap.need}
                                    onClick={() => {
                                        deckAct({
                                            type: "playCard",
                                            index: swap.index,
                                            discards: swap.picked,
                                        });
                                        setSwap(null);
                                    }}
                                >
                                    Play ({swap.picked.length}/{swap.need})
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSwap(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                    {deck.hand.length > 0 && (
                        <ul className="grid grid-cols-2 gap-2">
                            {deck.hand.map((id, index) => {
                                const card = info(id);
                                const selecting = swap !== null;
                                const selectable =
                                    selecting && index !== swap.index;
                                return (
                                    <HandTile
                                        key={`${id}-${index}`}
                                        card={card}
                                        custom={custom}
                                        size={size}
                                        onOpen={() => setOpen(card)}
                                        onPlay={
                                            card.kind === "time"
                                                ? undefined
                                                : () => playDigital(index)
                                        }
                                        onDiscard={() =>
                                            deckAct({
                                                type: "discardCard",
                                                index,
                                            })
                                        }
                                        selected={
                                            selecting &&
                                            (index === swap.index ||
                                                swap.picked.includes(index))
                                        }
                                        onSelect={
                                            selectable
                                                ? () => {
                                                      setSwap({
                                                          ...swap,
                                                          picked: swap.picked.includes(
                                                              index,
                                                          )
                                                              ? swap.picked.filter(
                                                                    (i) =>
                                                                        i !==
                                                                        index,
                                                                )
                                                              : [
                                                                    ...swap.picked,
                                                                    index,
                                                                ],
                                                      });
                                                  }
                                                : undefined
                                        }
                                    />
                                );
                            })}
                        </ul>
                    )}
                    <p className="text-xs">
                        Time bonuses in hand:{" "}
                        <strong>
                            {handBonusMinutes(deck.hand, size, custom)} min
                        </strong>
                        . Added to your hiding time when the round ends (the
                        clock at the bottom).
                    </p>
                    {!$game && (
                        <details>
                            <summary className="cursor-pointer text-xs text-slate-400">
                                Playing alone: draw by hand
                            </summary>
                            <div className="mt-1 flex flex-col gap-1">
                                <DrawButtons
                                    onPick={(draw) =>
                                        deckAct({
                                            type: "drawCards",
                                            extra: draw,
                                        })
                                    }
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={newLocalDeck}
                                >
                                    Shuffle a new deck
                                </Button>
                            </div>
                        </details>
                    )}
                </section>
            )}

            {hider && !digital && (
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
                                {[
                                    ...CARDS,
                                    ...custom.map((own) =>
                                        cardInfo(
                                            CUSTOM_PREFIX + own.id,
                                            custom,
                                        ),
                                    ),
                                ].map((card) => (
                                    <li key={card.id}>
                                        <CardPicture
                                            card={card}
                                            custom={custom}
                                            size={size}
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
                                            {cardLabel(card.id, size, custom)}
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
                                const shown = realCard(card);
                                return (
                                    <HandTile
                                        key={card.id}
                                        card={shown}
                                        custom={custom}
                                        size={size}
                                        onOpen={() => setOpen(shown)}
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
                        const own = custom.find((c) => c.name === entry.name);
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
                                {!curse && own && <p>{own.text}</p>}
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
                    {$role !== "hider" && digital && deck && (
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
                        {moves.map((entry, index) => (
                            <p key={`m${index}`} className="text-slate-300">
                                Move at {time(entry.at)}
                                {entry.station && ` from ${entry.station.name}`}
                                : {entry.questions.length} question
                                {entry.questions.length === 1 ? "" : "s"} put
                                away.
                            </p>
                        ))}
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
                            <p key={`l${index}`} className="text-slate-300">
                                {time(entry.at)} {entry.text}
                            </p>
                        ))}
                    </div>
                </details>
            )}

            <CardDialog
                card={open}
                custom={custom}
                size={size}
                onClose={() => setOpen(null)}
            />
            <AlertDialog
                open={moving !== null}
                onOpenChange={(isOpen) => !isOpen && setMoving(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Play Move?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your whole hand is discarded and the clock pauses.
                            The seekers are told your station
                            {chosenStation.get()
                                ? ` (${chosenStation.get()!.name})`
                                : ""}{" "}
                            and frozen; the questions so far are put away. Then
                            pick your new station in the Hider tab and continue
                            from there. Not during the end game.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmMove}>
                            Play Move
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
