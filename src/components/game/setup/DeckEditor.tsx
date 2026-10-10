// Game setup: every card and how many of it are in the deck, plus the
// players' own cards (text or a photo).
import { useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/toggle-card";
import { withBase } from "@/lib/config";
import { type CardInfo, CARDS, defaultCount } from "@/lib/game/deck";
import { shrinkImageDataUrl } from "@/lib/game/photos";
import type { CustomCard, GameSettings } from "@/lib/game/types";
import { cardImage } from "@/lib/rules/cards";
import { errorMessage } from "@/maps/errors";

const CARD_GROUPS: { kind: CardInfo["kind"]; title: string }[] = [
    { kind: "time", title: "Time bonuses (small / medium / large)" },
    { kind: "powerup", title: "Powerups" },
    { kind: "curse", title: "Curses" },
];

const cardTitle = (card: CardInfo) =>
    card.kind === "time"
        ? `Time bonus ${card.minutes!.join(" / ")} min`
        : card.name;

const FIELD =
    "flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm";

const Stepper = ({
    value,
    onChange,
}: {
    value: number;
    onChange: (value: number) => void;
}) => (
    <span className="flex items-center gap-1">
        <button
            type="button"
            className="h-6 w-6 rounded bg-slate-700 text-sm"
            aria-label="One fewer"
            onClick={() => onChange(value - 1)}
        >
            −
        </button>
        <span className="w-6 text-center tabular-nums">{value}</span>
        <button
            type="button"
            className="h-6 w-6 rounded bg-slate-700 text-sm"
            aria-label="One more"
            onClick={() => onChange(value + 1)}
        >
            +
        </button>
    </span>
);

/** Every card and how many of it are in the deck; the players' own cards. */
export const DeckEditor = ({
    draft,
    update,
}: {
    draft: GameSettings;
    update: (changes: Partial<GameSettings>) => void;
}) => {
    const [adding, setAdding] = useState(false);
    const [kind, setKind] = useState<CustomCard["kind"]>("curse");
    const [photo, setPhoto] = useState<string | undefined>();
    const fileRef = useRef<HTMLInputElement>(null);

    const count = (id: string) => draft.deckCounts[id] ?? defaultCount(id);
    const setCount = (id: string, value: number) => {
        const next = { ...draft.deckCounts };
        const clamped = Math.max(0, Math.min(40, value));
        if (clamped === defaultCount(id)) delete next[id];
        else next[id] = clamped;
        update({ deckCounts: next });
    };
    const changed =
        Object.keys(draft.deckCounts).length > 0 ||
        draft.customCards.length > 0;

    return (
        <div
            className="flex flex-col gap-2 rounded-lg border border-slate-600 p-2"
            data-testid="deck-editor"
        >
            {changed && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update({ deckCounts: {}, customCards: [] })}
                >
                    Back to the printed deck
                </Button>
            )}
            {CARD_GROUPS.map((group) => (
                <section key={group.kind}>
                    <h4 className="mb-1 text-xs font-semibold text-slate-400">
                        {group.title}
                    </h4>
                    <ul className="flex flex-col gap-1">
                        {CARDS.filter((card) => card.kind === group.kind).map(
                            (card) => (
                                <li
                                    key={card.id}
                                    className="flex items-center gap-2 text-xs"
                                >
                                    <img
                                        src={withBase(cardImage(card.image))}
                                        alt=""
                                        loading="lazy"
                                        className="h-8 w-6 rounded-sm object-cover"
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                        {cardTitle(card)}
                                    </span>
                                    <Stepper
                                        value={count(card.id)}
                                        onChange={(value) =>
                                            setCount(card.id, value)
                                        }
                                    />
                                </li>
                            ),
                        )}
                    </ul>
                </section>
            ))}
            {draft.customCards.length > 0 && (
                <section>
                    <h4 className="mb-1 text-xs font-semibold text-slate-400">
                        Your own cards
                    </h4>
                    <ul className="flex flex-col gap-1">
                        {draft.customCards.map((card) => (
                            <li
                                key={card.id}
                                className="flex items-center gap-2 text-xs"
                            >
                                {card.photo ? (
                                    <img
                                        src={card.photo}
                                        alt=""
                                        className="h-8 w-6 rounded-sm object-cover"
                                    />
                                ) : (
                                    <span className="h-8 w-6 rounded-sm bg-slate-200" />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    {card.name}{" "}
                                    <span className="text-slate-400">
                                        (
                                        {card.kind === "time"
                                            ? "time bonus"
                                            : card.kind}
                                        )
                                    </span>
                                </span>
                                <Stepper
                                    value={card.count}
                                    onChange={(value) =>
                                        update({
                                            customCards: draft.customCards.map(
                                                (c) =>
                                                    c.id === card.id
                                                        ? {
                                                              ...c,
                                                              count: Math.max(
                                                                  0,
                                                                  Math.min(
                                                                      40,
                                                                      value,
                                                                  ),
                                                              ),
                                                          }
                                                        : c,
                                            ),
                                        })
                                    }
                                />
                                <button
                                    type="button"
                                    className="px-1 text-red-300"
                                    aria-label={`Remove ${card.name}`}
                                    onClick={() =>
                                        update({
                                            customCards:
                                                draft.customCards.filter(
                                                    (c) => c.id !== card.id,
                                                ),
                                        })
                                    }
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {!adding ? (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAdding(true)}
                >
                    Add a card of your own (a blank card)
                </Button>
            ) : (
                <form
                    className="flex flex-col gap-2 rounded-md bg-slate-900 p-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        const minutes = ["s", "m", "l"].map((size) =>
                            Number(form.get(`minutes-${size}`)),
                        );
                        const card: CustomCard = {
                            id: crypto.randomUUID().slice(0, 8),
                            kind,
                            name:
                                String(form.get("name") ?? "")
                                    .trim()
                                    .slice(0, 60) || "Custom card",
                            text: String(form.get("text") ?? "").slice(0, 600),
                            count: Math.max(
                                1,
                                Math.min(40, Number(form.get("count")) || 1),
                            ),
                            ...(kind === "time" &&
                            minutes.every((m) => Number.isFinite(m) && m >= 0)
                                ? {
                                      minutes: minutes as [
                                          number,
                                          number,
                                          number,
                                      ],
                                  }
                                : {}),
                            ...(photo ? { photo } : {}),
                        };
                        update({ customCards: [...draft.customCards, card] });
                        setAdding(false);
                        setPhoto(undefined);
                        setKind("curse");
                    }}
                >
                    <SegmentedControl<CustomCard["kind"]>
                        label="Kind of card"
                        options={[
                            { value: "curse", label: "Curse" },
                            { value: "powerup", label: "Powerup" },
                            { value: "time", label: "Time bonus" },
                        ]}
                        value={kind}
                        onValueChange={setKind}
                    />
                    <input
                        name="name"
                        placeholder="Name"
                        maxLength={60}
                        required
                        className={FIELD}
                    />
                    <textarea
                        name="text"
                        placeholder="What it does (the text on the card)"
                        maxLength={600}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                    {kind === "time" && (
                        <div className="grid grid-cols-3 gap-1">
                            {["s", "m", "l"].map((size, index) => (
                                <input
                                    key={size}
                                    name={`minutes-${size}`}
                                    type="number"
                                    min={0}
                                    max={600}
                                    required
                                    placeholder={`${["Small", "Medium", "Large"][index]} min`}
                                    className={FIELD}
                                />
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                        <label htmlFor="custom-count">Copies</label>
                        <input
                            id="custom-count"
                            name="count"
                            type="number"
                            min={1}
                            max={40}
                            defaultValue={1}
                            className={`${FIELD} w-16`}
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => fileRef.current?.click()}
                        >
                            {photo ? "Photo added ✓" : "Add a photo"}
                        </Button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (!file) return;
                                try {
                                    setPhoto(await shrinkImageDataUrl(file));
                                } catch (error) {
                                    toast.error(errorMessage(error));
                                }
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button type="submit" size="sm">
                            Add to the deck
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setAdding(false);
                                setPhoto(undefined);
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
};
