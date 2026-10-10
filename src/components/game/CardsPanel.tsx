import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTick } from "@/hooks/useTick";
import { withBase } from "@/lib/config";
import { gameSettings } from "@/lib/context";
import { activeCurses, curseRule } from "@/lib/game/curseRules";
import {
    type CardInfo,
    cardInfo,
    cardLabel,
    CARDS,
    castingCostText,
    CURSE_COSTS,
    CUSTOM_PREFIX,
} from "@/lib/game/deck";
import { deckAct, localDeck, newLocalDeck } from "@/lib/game/deckSession";
import {
    discardCard,
    discardHand as discardRealHand,
    hand,
    type HandCard,
    handLimit,
    keepCard,
} from "@/lib/game/hand";
import { serverNow } from "@/lib/game/serverTime";
import { gameState, hiderPhone, sendOp } from "@/lib/game/session";
import type {
    Draw,
    GameSize,
    PowerupEntry,
    SharedQuestion,
} from "@/lib/game/types";
import { chosenStation } from "@/lib/hiderSpot";

import { ActiveCurses } from "./ActiveCurses";
import { CardHistory } from "./CardHistory";
import { CardDialog, CardPicture, DrawButtons, HandTile } from "./CardTiles";
import { DrainedBrainChooser } from "./DrainedBrainChooser";

const SIZE_INDEX: Record<GameSize, number> = { small: 0, medium: 1, large: 2 };

/** "Discard N, draw M": how many other cards go. */
const DISCARDS: Record<string, number> = {
    powerup_discard_1_draw_2: 1,
    powerup_discard_2_draw_3: 2,
};

const CATEGORY_LABELS: Record<string, string> = {
    radius: "Radar",
    thermometer: "Thermometer",
    tentacles: "Tentacles",
    matching: "Matching",
    measuring: "Measuring",
};

/** "Radar 5 km", "Matching (zone)". */
const questionLabel = (question: SharedQuestion) => {
    const data = question.data as {
        type?: string;
        locationType?: string;
        radius?: number;
        unit?: string;
    };
    const category = CATEGORY_LABELS[question.id] ?? question.id;
    if (question.id === "radius" && typeof data.radius === "number") {
        return `${category} ${data.radius} ${data.unit === "kilometers" ? "km" : data.unit}`;
    }
    const type = data.type ?? data.locationType;
    return type ? `${category} (${type.replace(/[-_]/g, " ")})` : category;
};

/**
 * Sidebar → Cards: the hider's hand (hider's phone only), the curses on the
 * seekers, and the round's history. With the digital deck the game deals
 * the hider's draws after each answer; with the physical deck the hider
 * records what they keep.
 */
export const CardsPanel = () => {
    // "x min ago" stays right.
    useTick(true, 30_000);
    const $game = useStore(gameState);
    const hider = useStore(hiderPhone);
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
        /** A casting cost that takes only this kind of card. */
        kind?: "time" | "powerup";
        /** "Cast" a curse, "Play" a powerup. */
        verb: "Play" | "Cast";
        /** Duplicate Another Card standing in for the card at this index. */
        copyOf?: number;
    } | null>(null);
    const [moving, setMoving] = useState<
        | { digital: true; index: number; copyOf?: number }
        | { digital: false; cardId: string }
        | null
    >(null);
    // Duplicate Another Card: which card in the hand it copies.
    const [copying, setCopying] = useState<number | null>(null);
    // Randomize Question: which asked question it is played on.
    const [randomizing, setRandomizing] = useState(false);

    const settings = $game?.settings ?? $settings;
    const size = settings.size;
    const custom = settings.customCards;
    const digital = settings.deck === "virtual";
    const deck = $game ? $game.deck : digital ? $localDeck : null;

    // Playing alone with the digital deck: this phone shuffles one.
    useEffect(() => {
        if (!$game && digital && hider && !$localDeck) newLocalDeck();
    }, [$game, digital, hider, $localDeck]);

    const info = (id: string) => cardInfo(id, custom);

    const askedQuestions = Object.values($game?.questions ?? {}).filter(
        (entry) => entry.state === "asked",
    );
    // Photo questions waiting for their photo count too.
    const pendingPhotos = ($game?.photoRequests ?? []).filter(
        (request) => !request.photoId,
    );
    /** Randomize Question is played on a question, from the question's card. */
    const randomize = () => {
        if (!$game) {
            toast.info("Randomize Question needs a shared game.");
            return;
        }
        if (askedQuestions.length === 0 && pendingPhotos.length === 0) {
            toast.info("No question is waiting for an answer.");
            return;
        }
        setRandomizing(true);
    };

    /** Plays the card at `index`; a Duplicate plays as the card at `copyOf`. */
    const playDigital = (index: number, copyOf?: number) => {
        const id = deck?.hand[copyOf ?? index];
        if (!id || !deck) return;
        if (copyOf === undefined && id === "powerup_duplicate_another_card") {
            setCopying(index);
            return;
        }
        if (id === "powerup_move") {
            setMoving({ digital: true, index, copyOf });
            return;
        }
        if (id === "powerup_randomize_question") {
            randomize();
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
            setSwap({ index, need, picked: [], verb: "Play", copyOf });
            return;
        }
        // A curse's casting cost in cards.
        const cost = CURSE_COSTS[id];
        if (cost?.discard === "hand") {
            const others = deck.hand.length - 1;
            if (
                window.confirm(
                    `${info(id).name}: casting it discards your whole hand (${others} other card${others === 1 ? "" : "s"}). Cast it?`,
                )
            ) {
                deckAct({ type: "playCard", index, copyOf });
            }
            return;
        }
        if (cost) {
            const fitting = deck.hand.filter(
                (other, i) =>
                    i !== index &&
                    (!cost.kind || info(other).kind === cost.kind),
            ).length;
            if (fitting < cost.discard) {
                toast.error(
                    `${info(id).name} costs ${castingCostText(cost)}, which you don't have.`,
                );
                return;
            }
            setSwap({
                index,
                need: cost.discard,
                picked: [],
                kind: cost.kind,
                verb: "Cast",
                copyOf,
            });
            return;
        }
        deckAct({ type: "playCard", index, copyOf });
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
        if (card.name === "Randomize Question") {
            randomize();
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
            deckAct({
                type: "playCard",
                index: moving.index,
                station,
                copyOf: moving.copyOf,
            });
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

    // Timed curses end by themselves; the server clears them on its next change.
    const active = $game
        ? activeCurses($game, serverNow()).slice().reverse()
        : [];
    const brainToChoose =
        hider && $game
            ? active.find(
                  (entry) =>
                      curseRule(entry.name).takes === "kinds" && !entry.kinds,
              )
            : undefined;
    const freeNext =
        (deck?.freeQuestions ?? 0) > 0 ||
        ($game?.freeQuestions ?? 0) > 0 ||
        (!digital &&
            active.some((entry) => curseRule(entry.name).freeQuestion));
    const cleared = ($game?.curses ?? []).filter((c) => c.clearedAt).reverse();
    const played: PowerupEntry[] = [...($game?.powerups ?? [])].reverse();
    const log = [...(deck?.log ?? [])].reverse();
    const moves = [...($game?.moves ?? [])].reverse();
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
                    {freeNext && (
                        <p
                            className="text-xs text-amber-300"
                            data-testid="free-question"
                        >
                            The seekers&apos; next question is free (a curse, or
                            three late answers): no draw for it.
                        </p>
                    )}
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
                                tap {swap.need}{" "}
                                {swap.kind === "time"
                                    ? "time bonus"
                                    : swap.kind === "powerup"
                                      ? "powerup"
                                      : "other card"}
                                {swap.need === 1 ? "" : "s"} to discard, then{" "}
                                {swap.verb.toLowerCase()} it.
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
                                            copyOf: swap.copyOf,
                                        });
                                        setSwap(null);
                                    }}
                                >
                                    {swap.verb} ({swap.picked.length}/
                                    {swap.need})
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
                                    selecting &&
                                    index !== swap.index &&
                                    index !== swap.copyOf &&
                                    (!swap.kind || card.kind === swap.kind);
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
                                        onDiscard={
                                            // Only down to the hand limit; a
                                            // card's cost picks its own.
                                            deck.hand.length > deck.limit
                                                ? () =>
                                                      deckAct({
                                                          type: "discardCard",
                                                          index,
                                                      })
                                                : undefined
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
                            {freeNext && (
                                <p className="text-xs text-amber-300">
                                    The seekers&apos; next question is free (a
                                    curse, or three late answers): no draw.
                                </p>
                            )}
                            {active.some(
                                (c) =>
                                    c.name ===
                                    "Curse of the Overflowing Chalice",
                            ) && (
                                <p className="text-xs text-amber-300">
                                    Overflowing Chalice is on: draw one card
                                    more than shown, keep the same number.
                                </p>
                            )}
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
                                        onDiscard={
                                            $hand.length > $limit
                                                ? () => discardCard(card.id)
                                                : undefined
                                        }
                                    />
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}

            {$game && (
                <ActiveCurses active={active} custom={custom} size={size} />
            )}
            {$game && (
                <CardHistory
                    moves={moves}
                    played={played}
                    cleared={cleared}
                    log={log}
                    size={size}
                    hiderReadyAt={$game.hiderReadyAt ?? null}
                />
            )}
            <CardDialog
                card={open}
                custom={custom}
                size={size}
                onClose={() => setOpen(null)}
            />
            {brainToChoose && <DrainedBrainChooser curse={brainToChoose} />}
            <Dialog
                open={copying !== null}
                onOpenChange={(open) => !open && setCopying(null)}
            >
                <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                    <DialogHeader>
                        <DialogTitle>Play as a copy of which card?</DialogTitle>
                        <DialogDescription>
                            Duplicate Another Card: the card it copies stays in
                            your hand. A time bonus is copied by itself at the
                            end of the round.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="flex flex-col gap-2">
                        {(deck?.hand ?? []).map((id, index) => {
                            const card = info(id);
                            if (
                                index === copying ||
                                card.kind === "time" ||
                                id === "powerup_duplicate_another_card"
                            ) {
                                return null;
                            }
                            return (
                                <li key={`${id}-${index}`}>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => {
                                            const from = copying;
                                            setCopying(null);
                                            if (from !== null)
                                                playDigital(from, index);
                                        }}
                                    >
                                        {cardLabel(id, size, custom)}
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                </DialogContent>
            </Dialog>
            <Dialog open={randomizing} onOpenChange={setRandomizing}>
                <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
                    <DialogHeader>
                        <DialogTitle>Randomize which question?</DialogTitle>
                        <DialogDescription>
                            It becomes another question of its kind, chosen at
                            random, which you answer instead.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="flex flex-col gap-2">
                        {askedQuestions.map((entry) => (
                            <li key={entry.question.key}>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled={
                                        entry.question.id === "thermometer"
                                    }
                                    onClick={() => {
                                        setRandomizing(false);
                                        void sendOp({
                                            type: "randomizeQuestion",
                                            key: entry.question.key,
                                        });
                                    }}
                                >
                                    {questionLabel(entry.question)}
                                    {entry.question.id === "thermometer" &&
                                        " (no variants)"}
                                </Button>
                            </li>
                        ))}
                        {pendingPhotos.map((request) => (
                            <li key={request.id}>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setRandomizing(false);
                                        void sendOp({
                                            type: "randomizePhoto",
                                            id: request.id,
                                        });
                                    }}
                                >
                                    Photo: {request.name}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </DialogContent>
            </Dialog>
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
