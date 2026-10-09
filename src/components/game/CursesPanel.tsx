import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import { CardText } from "@/components/RulesText";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/config";
import { gameRole, gameState, sendOp } from "@/lib/game/session";
import type { GameSize } from "@/lib/game/types";
import { type Curse, CURSES } from "@/lib/rules/cards";

const SIZE_INDEX: Record<GameSize, number> = { small: 0, medium: 1, large: 2 };

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

/** Sidebar → Curses: the curses on the seekers, and casting new ones. */
export const CursesPanel = () => {
    useTick();
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const [choosing, setChoosing] = useState(false);
    const [picked, setPicked] = useState<string | null>(null);
    const size = $game?.settings.size;

    if (!$game) {
        return (
            <div className="flex flex-col gap-2 p-3 text-sm">
                <p className="rounded-md bg-slate-800 p-2 text-xs text-slate-300">
                    Start a shared game (Menu → Game) to track curses: the hider
                    casts them, everyone sees them, the seekers clear them.
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

    const active = $game.curses.filter((c) => !c.clearedAt).reverse();
    const cleared = $game.curses.filter((c) => c.clearedAt).reverse();

    return (
        <div className="flex flex-col gap-3 p-3 text-sm">
            <section className="flex flex-col gap-2">
                <h3 className="font-semibold font-poppins">
                    On the seekers ({active.length})
                </h3>
                {active.length === 0 && (
                    <p className="text-xs text-slate-400">No active curses.</p>
                )}
                {active.map((entry) => {
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
                            {curse && <CurseText curse={curse} size={size} />}
                            <p className="text-xs text-slate-300">
                                Cast{" "}
                                {new Date(entry.castAt).toLocaleTimeString([], {
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
                <Button onClick={() => setChoosing(true)}>Cast a curse</Button>
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
                                    <CurseText curse={curse} size={size} />
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            void sendOp({
                                                type: "castCurse",
                                                name: curse.name,
                                            });
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

            {cleared.length > 0 && (
                <details>
                    <summary className="cursor-pointer text-slate-300">
                        Cleared ({cleared.length})
                    </summary>
                    <ul className="mt-1 flex flex-col gap-1 text-xs text-slate-400">
                        {cleared.map((entry) => (
                            <li key={entry.id}>
                                {entry.name}, cleared by {entry.clearedBy}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
};
