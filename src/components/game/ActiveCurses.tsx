// Cards → On the seekers.
import { CardText } from "@/components/RulesText";
import { Button } from "@/components/ui/button";
import { serverNow } from "@/lib/game/serverTime";
import { sendOp } from "@/lib/game/session";
import type { CurseEntry, CustomCard, Deck, GameSize } from "@/lib/game/types";
import { CURSES } from "@/lib/rules/cards";

const SIZE_INDEX: Record<GameSize, number> = { small: 0, medium: 1, large: 2 };

const time = (at: number) =>
    new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Cards → "On the seekers": the curses still in force, and clearing them. */
export const ActiveCurses = ({
    active,
    custom,
    size,
    deck,
    deckSizes,
}: {
    active: CurseEntry[];
    custom: CustomCard[];
    size: GameSize;
    deck: Deck | null;
    /** Seekers with the digital deck: how many cards the hider holds. */
    deckSizes: boolean;
}) => (
    <section className="flex flex-col gap-2">
        <h3 className="font-semibold font-poppins">
            On the seekers ({active.length})
        </h3>
        {active.length === 0 && (
            <p className="text-xs text-slate-400">No active curses.</p>
        )}
        {active.map((entry: CurseEntry) => {
            const curse = CURSES.find((c) => c.name === entry.name);
            const own = custom.find((c) => c.name === entry.name);
            const endsAt =
                curse?.minutes && size
                    ? entry.castAt + curse.minutes[SIZE_INDEX[size]] * 60_000
                    : undefined;
            const left = endsAt
                ? Math.ceil((endsAt - serverNow()) / 60_000)
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
                                <CardText text={curse.effect} size={size} />
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
                            (left > 0 ? ` · ${left} min left` : " · time's up")}
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
        {deckSizes && deck && (
            <p className="text-xs text-slate-400">
                The hider holds {deck.handSize ?? 0} card
                {deck.handSize === 1 ? "" : "s"}; {deck.deckSize ?? 0} left in
                the deck.
            </p>
        )}
    </section>
);
