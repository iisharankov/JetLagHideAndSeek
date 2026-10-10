import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { CardText } from "@/components/RulesText";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/config";
import { gameSettings, hiderMode } from "@/lib/context";
import {
    bonusMinutes,
    cardChoices,
    cardLabel,
    discardCard,
    discardHand,
    DRAWS,
    hand,
    type HandCard,
    handLimit,
    keepCard,
    removeOne,
    SIZE_INDEX,
} from "@/lib/game/hand";
import { gameRole, gameState, sendOp } from "@/lib/game/session";
import type { GameSize } from "@/lib/game/types";
import { type Curse, CURSES, POWERUPS } from "@/lib/rules/cards";

type Draw = { draw: number; keep: number; label: string };

/** Re-renders every 30 s, for the countdowns. */
const useTick = () => {
    const [, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(timer);
    }, []);
};

const CurseText = ({ curse, size }: { curse: Curse; size?: GameSize }) => (
    <>
        <p>
            <CardText text={curse.effect} size={size} />
        </p>
        <p className="text-xs">
            <strong>Casting cost: </strong>
            <CardText text={curse.castingCost} size={size} />
        </p>
    </>
);

/**
 * Sidebar → Cards: the hider's hand (hider's phone only), the curses on the
 * seekers, and the powerups played.
 */
export const CardsPanel = () => {
    useTick();
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $hiderMode = useStore(hiderMode);
    const $settings = useStore(gameSettings);
    const $hand = useStore(hand);
    const $limit = useStore(handLimit);
    const [choosing, setChoosing] = useState(false);
    const [picked, setPicked] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [pickedPowerup, setPickedPowerup] = useState<string | null>(null);
    const [drawing, setDrawing] = useState<"pick" | Draw | null>(null);
    const [toKeep, setToKeep] = useState(1);
    const size = $game?.settings.size ?? $settings.size;
    const hider = $hiderMode !== false && (!$game || $role === "hider");

    /** A powerup leaves the hand when played; some do more. */
    const afterPlay = (name: string) => {
        removeOne(name);
        if (name === "Draw 1, Expand 1") {
            handLimit.set($limit + 1);
            toast.info(
                `Your hand may hold ${$limit + 1} cards now. Add the card you drew (Draw cards → Add a card).`,
                { autoClose: 8000 },
            );
        }
        if (name === "Move") {
            discardHand();
            void sendOp({ type: "clock", action: "pause" });
            toast.info(
                "Move: your hand is discarded and the clock paused. Tell the seekers your station, then pick the new one in the Hider tab.",
                { autoClose: 10000 },
            );
        }
    };

    if (!$game && !hider) {
        return (
            <div className="flex flex-col gap-2 p-3 text-sm">
                <p className="rounded-md bg-slate-800 p-2 text-xs text-slate-300">
                    Start a shared game (Menu → Game) to track curses and
                    powerups: the hider casts or plays them, everyone sees them,
                    the seekers clear curses. The hider also keeps their hand of
                    cards here.
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
    const played = [...($game?.powerups ?? [])].reverse();
    const bonus = bonusMinutes($hand);
    const duplicates = $hand.filter(
        (card) => card.name === "Duplicate Another Card",
    ).length;

    return (
        <div className="flex flex-col gap-3 p-3 text-sm">
            {hider && (
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
                        Only on your phone. The real deck is still yours: record
                        what you keep, and the time bonuses still in your hand
                        are added at the end of the round.
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
                            <div className="grid grid-cols-2 gap-1">
                                {Object.entries(DRAWS).map(([key, draw]) => (
                                    <Button
                                        key={key}
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setDrawing(draw);
                                            setToKeep(draw.keep);
                                        }}
                                    >
                                        {draw.label}: {draw.draw} → {draw.keep}
                                    </Button>
                                ))}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="col-span-2"
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
                        </div>
                    )}
                    {drawing !== null && drawing !== "pick" && (
                        <div className="flex flex-col gap-1 rounded-md bg-slate-900 p-2">
                            <p className="text-xs">
                                {drawing.draw > 0
                                    ? `${drawing.label}: draw ${drawing.draw}, keep ${drawing.keep}. `
                                    : ""}
                                Tap the{" "}
                                {toKeep === 1 ? "card" : `${toKeep} cards`} you
                                kept.
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {cardChoices(size).map((choice) => (
                                    <button
                                        key={cardLabel(choice)}
                                        type="button"
                                        className="rounded-md bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                                        onClick={() => {
                                            keepCard(choice);
                                            if (toKeep <= 1) setDrawing(null);
                                            else setToKeep(toKeep - 1);
                                        }}
                                    >
                                        {cardLabel(choice)}
                                    </button>
                                ))}
                            </div>
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
                        <ul className="flex flex-col">
                            {$hand.map((card: HandCard) => (
                                <li
                                    key={card.id}
                                    className="flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-accent"
                                >
                                    <span className="flex-1 truncate">
                                        {cardLabel(card)}
                                    </span>
                                    {card.kind === "curse" && $game && (
                                        <button
                                            type="button"
                                            className="rounded-md bg-red-800 px-1.5 py-0.5 text-xs"
                                            onClick={() => {
                                                void sendOp({
                                                    type: "castCurse",
                                                    name: card.name,
                                                });
                                                discardCard(card.id);
                                            }}
                                        >
                                            Cast
                                        </button>
                                    )}
                                    {card.kind === "powerup" && $game && (
                                        <button
                                            type="button"
                                            className="rounded-md bg-amber-800 px-1.5 py-0.5 text-xs"
                                            onClick={() => {
                                                void sendOp({
                                                    type: "playPowerup",
                                                    name: card.name,
                                                });
                                                discardCard(card.id);
                                                afterPlay(card.name);
                                            }}
                                        >
                                            Play
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="rounded-md bg-slate-700 px-1.5 py-0.5 text-xs"
                                        onClick={() => discardCard(card.id)}
                                    >
                                        Discard
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-xs">
                        Time bonuses in hand: <strong>{bonus} min</strong>
                        {duplicates > 0 &&
                            " (each Duplicate counts as your biggest bonus)"}
                        . Sent to the seekers when the round ends (the clock at
                        the top).
                    </p>
                </section>
            )}
            {$game && (
                <>
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold font-poppins">
                            On the seekers ({active.length})
                        </h3>
                        {active.length === 0 && (
                            <p className="text-xs text-slate-400">
                                No active curses.
                            </p>
                        )}
                        {active.map((entry) => {
                            const curse = CURSES.find(
                                (c) => c.name === entry.name,
                            );
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
                                    <p className="font-semibold">
                                        {entry.name}
                                    </p>
                                    {curse && (
                                        <CurseText curse={curse} size={size} />
                                    )}
                                    <p className="text-xs text-slate-300">
                                        Cast{" "}
                                        {new Date(
                                            entry.castAt,
                                        ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
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
                    </section>

                    {$role === "hider" && !choosing && (
                        <Button onClick={() => setChoosing(true)}>
                            Cast a curse
                        </Button>
                    )}
                    {$role === "hider" && choosing && (
                        <section className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold font-poppins">
                                    Cast a curse
                                </h3>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setChoosing(false);
                                        setPicked(null);
                                    }}
                                >
                                    Close
                                </Button>
                            </div>
                            {CURSES.map((curse) => (
                                <div
                                    key={curse.name}
                                    className="flex flex-col gap-1 rounded-md bg-slate-900 p-2"
                                >
                                    <button
                                        type="button"
                                        className="text-left font-semibold"
                                        onClick={() =>
                                            setPicked(
                                                picked === curse.name
                                                    ? null
                                                    : curse.name,
                                            )
                                        }
                                    >
                                        {curse.name}
                                    </button>
                                    {picked === curse.name && (
                                        <>
                                            <CurseText
                                                curse={curse}
                                                size={size}
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    void sendOp({
                                                        type: "castCurse",
                                                        name: curse.name,
                                                    });
                                                    removeOne(curse.name);
                                                    setChoosing(false);
                                                    setPicked(null);
                                                }}
                                            >
                                                Cast it (casting cost paid)
                                            </Button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </section>
                    )}

                    <section
                        className="flex flex-col gap-2"
                        data-testid="powerups"
                    >
                        <h3 className="font-semibold font-poppins">
                            Powerups played ({played.length})
                        </h3>
                        {played.length === 0 && (
                            <p className="text-xs text-slate-400">
                                None this round.
                            </p>
                        )}
                        {played.map((entry) => {
                            const powerup = POWERUPS.find(
                                (p) => p.name === entry.name,
                            );
                            return (
                                <div
                                    key={entry.id}
                                    className="flex flex-col gap-1 rounded-md border border-amber-500/60 bg-amber-950/30 p-2"
                                    data-testid="played-powerup"
                                >
                                    <p className="font-semibold">
                                        {entry.name}
                                    </p>
                                    {powerup && (
                                        <p>
                                            <CardText
                                                text={powerup.effect}
                                                size={size}
                                            />
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-300">
                                        Played{" "}
                                        {new Date(
                                            entry.playedAt,
                                        ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                        {entry.by && ` by ${entry.by}`}
                                    </p>
                                </div>
                            );
                        })}
                        {$role === "hider" && !playing && (
                            <Button
                                variant="outline"
                                onClick={() => setPlaying(true)}
                            >
                                Play a powerup
                            </Button>
                        )}
                        {$role === "hider" && playing && (
                            <section className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold font-poppins">
                                        Play a powerup
                                    </h4>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setPlaying(false);
                                            setPickedPowerup(null);
                                        }}
                                    >
                                        Close
                                    </Button>
                                </div>
                                {POWERUPS.map((powerup) => (
                                    <div
                                        key={powerup.name}
                                        className="flex flex-col gap-1 rounded-md bg-slate-900 p-2"
                                    >
                                        <button
                                            type="button"
                                            className="text-left font-semibold"
                                            onClick={() =>
                                                setPickedPowerup(
                                                    pickedPowerup ===
                                                        powerup.name
                                                        ? null
                                                        : powerup.name,
                                                )
                                            }
                                        >
                                            {powerup.name}
                                        </button>
                                        {pickedPowerup === powerup.name && (
                                            <>
                                                <p>
                                                    <CardText
                                                        text={powerup.effect}
                                                        size={size}
                                                    />
                                                </p>
                                                {powerup.name === "Move" && (
                                                    <p className="text-xs text-slate-300">
                                                        Tell the seekers which
                                                        station you were at,
                                                        then pick your new one
                                                        in the Hider tab (Change
                                                        station).
                                                    </p>
                                                )}
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        void sendOp({
                                                            type: "playPowerup",
                                                            name: powerup.name,
                                                        });
                                                        afterPlay(powerup.name);
                                                        setPlaying(false);
                                                        setPickedPowerup(null);
                                                    }}
                                                >
                                                    Play it (the seekers are
                                                    told)
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                ))}
                                <p className="text-xs text-slate-400">
                                    A wider hiding zone, where a card allows it:
                                    Menu → Game → hiding zone radius. The
                                    seekers&apos; map follows.
                                </p>
                            </section>
                        )}
                    </section>

                    {cleared.length > 0 && (
                        <details>
                            <summary className="cursor-pointer text-slate-300">
                                Cleared ({cleared.length})
                            </summary>
                            <ul className="mt-1 flex flex-col gap-1 text-xs text-slate-400">
                                {cleared.map((entry) => (
                                    <li key={entry.id}>
                                        {entry.name}, cleared by{" "}
                                        {entry.clearedBy}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </>
            )}
        </div>
    );
};
