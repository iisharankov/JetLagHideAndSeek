import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
    ChoiceCards,
    SegmentedControl,
    ToggleCard,
} from "@/components/ui/toggle-card";
import { withBase } from "@/lib/config";
import {
    additionalMapGeoLocations,
    gameSettings,
    mapGeoLocation,
    playAreaEditing,
    polyGeoJSON,
} from "@/lib/context";
import {
    type CardInfo,
    CARDS,
    deckComposition,
    defaultCount,
} from "@/lib/game/deck";
import { shrinkImageDataUrl } from "@/lib/game/photos";
import { startGame } from "@/lib/game/session";
import {
    ALWAYS_OFF,
    hidingRadiusDefaultKm,
    LAKE_AREA_CHOICES,
    questionKey,
    radarDefaultKm,
    regionDisabledQuestions,
} from "@/lib/game/settings";
import type { CustomCard, GameSettings, GameSize } from "@/lib/game/types";
import { applyGameSettings } from "@/lib/gameSettings";
import { TYPES } from "@/lib/questionInfo";
import { cardImage } from "@/lib/rules/cards";
import type { OpenStreetMap } from "@/maps/api";
import { errorMessage } from "@/maps/errors";

const STEPS = ["Game", "Hiding zones", "Questions"] as const;

/** "Zürich, Switzerland": a place as the search shows it. */
const placeName = (location: OpenStreetMap) =>
    [location.properties.name, location.properties.country]
        .filter(Boolean)
        .join(", ");

/** The draft kept while the play area is being chosen on the map. */
let pendingDraft: GameSettings | null = null;

const CATEGORY_NAMES: Record<keyof typeof TYPES, string> = {
    matching: "Matching",
    measuring: "Measuring",
    tentacles: "Tentacles",
};

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
const DeckEditor = ({
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

/**
 * The game's settings, a few screens at a time: deck, play area, size and
 * rules; hiding zones; which questions are in the game. Used before a
 * shared game starts (mode "start": the last button starts it) and for
 * playing alone.
 */
export const GameSetupDialog = ({
    open,
    onOpenChange,
    mode,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "solo" | "start";
}) => {
    const $settings = useStore(gameSettings);
    const [draft, setDraft] = useState<GameSettings>($settings);
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [showDeck, setShowDeck] = useState(false);
    const [showQuestions, setShowQuestions] = useState(false);

    useEffect(() => {
        if (open) {
            setDraft(pendingDraft ?? gameSettings.get());
            pendingDraft = null;
            setStep(0);
            setShowDeck(false);
            setShowQuestions(false);
        }
    }, [open]);

    const update = (changes: Partial<GameSettings>) =>
        setDraft((current) => ({ ...current, ...changes }));

    const setSize = (size: GameSize) =>
        update({ size, hidingRadiusKm: hidingRadiusDefaultKm(size) });

    const setRegion = (region: GameSettings["region"]) =>
        update({ region, disabledQuestions: regionDisabledQuestions(region) });

    const toggleQuestion = (key: string, enabled: boolean) =>
        update({
            disabledQuestions: enabled
                ? draft.disabledQuestions.filter((k) => k !== key)
                : [...draft.disabledQuestions, key],
        });

    const finish = async () => {
        setBusy(true);
        try {
            applyGameSettings(draft);
            if (mode === "start") {
                await startGame();
                toast.success(
                    "Shared game started. Send the link to the others (Menu → Game).",
                );
            } else {
                toast.success("Game settings saved.", { autoClose: 2000 });
            }
            onOpenChange(false);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const $polyGeoJSON = useStore(polyGeoJSON);
    const $mapGeoLocation = useStore(mapGeoLocation);
    const $additional = useStore(additionalMapGeoLocations);
    const playArea = $polyGeoJSON
        ? "a drawn area"
        : [$mapGeoLocation, ...$additional.map((x) => x.location)]
              .map(placeName)
              .join("; ");
    const changePlayArea = () => {
        pendingDraft = draft;
        onOpenChange(false);
        playAreaEditing.set(mode);
    };
    const lakeEnabled = !draft.disabledQuestions.includes(
        questionKey("measuring", "lake"),
    );
    const deckSize = deckComposition(draft).length;
    const deckChanged =
        Object.keys(draft.deckCounts).length > 0 ||
        draft.customCards.length > 0;
    const allTypes = (Object.keys(TYPES) as (keyof typeof TYPES)[]).flatMap(
        (category) =>
            Object.keys(TYPES[category])
                .map((type) => questionKey(category, type))
                .filter((key) => !ALWAYS_OFF.includes(key)),
    );
    const typesOn = allTypes.filter(
        (key) => !draft.disabledQuestions.includes(key),
    ).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "start" ? "New shared game" : "Game settings"}
                        <span className="ml-2 text-sm font-normal text-slate-400">
                            {step + 1} of {STEPS.length}: {STEPS[step]}
                        </span>
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "start"
                            ? "Decided now, fixed once the game has started (the hider can still widen the hiding zones)."
                            : "How this phone plays: sizes, rules and questions."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 overflow-y-auto pr-1 text-sm">
                    {step === 0 && (
                        <>
                            <Label>Hider deck</Label>
                            <ChoiceCards<GameSettings["deck"]>
                                label="Hider deck"
                                options={[
                                    {
                                        value: "real",
                                        title: "Physical deck",
                                        description:
                                            "You have the cards. The hider records what they keep.",
                                    },
                                    {
                                        value: "virtual",
                                        title: "Digital deck",
                                        description:
                                            "The app shuffles and deals: after each answer the hider's cards come by themselves.",
                                    },
                                ]}
                                value={draft.deck}
                                onValueChange={(deck) => update({ deck })}
                            />
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-600 px-3 py-2">
                                <span className="text-xs">
                                    <strong>{deckSize} cards</strong>
                                    {deckChanged
                                        ? ", customised"
                                        : ": the printed deck"}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowDeck(!showDeck)}
                                    aria-expanded={showDeck}
                                >
                                    {showDeck ? "Done" : "Customise"}
                                </Button>
                            </div>
                            {showDeck && (
                                <DeckEditor draft={draft} update={update} />
                            )}
                            <Label>
                                Seekers see which cards the hider plays
                            </Label>
                            <SegmentedControl<GameSettings["cardPopups"]>
                                label="Card popups"
                                options={[
                                    {
                                        value: "important",
                                        label: "Curses, veto, move",
                                    },
                                    { value: "all", label: "Every card" },
                                ]}
                                value={draft.cardPopups}
                                onValueChange={(cardPopups) =>
                                    update({ cardPopups })
                                }
                            />
                            <Label>Play area</Label>
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-600 px-3 py-2">
                                <span className="min-w-0 truncate font-semibold">
                                    {playArea}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={changePlayArea}
                                    data-testid="change-play-area"
                                >
                                    Change
                                </Button>
                            </div>
                            <p className="text-xs text-slate-400">
                                Search for a place, or draw the area on the map.
                                In a shared game everyone gets it.
                            </p>
                            <Label>Game size</Label>
                            <SegmentedControl<GameSize>
                                label="Game size"
                                options={[
                                    { value: "small", label: "Small" },
                                    { value: "medium", label: "Medium" },
                                    { value: "large", label: "Large" },
                                ]}
                                value={draft.size}
                                onValueChange={setSize}
                            />
                            <p className="text-xs text-slate-400">
                                A town or part of a city, a region or canton, a
                                country. Sets the defaults: radar questions
                                start at {radarDefaultKm(draft.size)} km, hiding
                                zones at {hidingRadiusDefaultKm(draft.size)} km.
                            </p>
                            <Label>Local rules</Label>
                            <SegmentedControl<GameSettings["region"]>
                                label="Local rules"
                                options={[
                                    {
                                        value: "switzerland",
                                        label: "Switzerland",
                                    },
                                    { value: "standard", label: "Standard" },
                                ]}
                                value={draft.region}
                                onValueChange={setRegion}
                            />
                            <p className="text-xs text-slate-400">
                                Switzerland: &quot;major city&quot; means
                                100,000+ people, lake shores stand in for the
                                coast, no 7-Eleven. Changing this resets the
                                question list on the last screen.
                            </p>
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <Label htmlFor="hiding-radius">
                                Hiding zone radius (km)
                            </Label>
                            <Input
                                id="hiding-radius"
                                type="number"
                                inputMode="decimal"
                                min={0.1}
                                max={50}
                                step={0.1}
                                value={draft.hidingRadiusKm}
                                debounce={0}
                                onChange={(event) => {
                                    const value = Number(event.target.value);
                                    if (value > 0 && value <= 50) {
                                        update({ hidingRadiusKm: value });
                                    }
                                }}
                            />
                            <p className="text-xs text-slate-400">
                                The rulebook&apos;s 500 m (small and medium
                                games) or 1 km (large).
                            </p>
                            <Label>Which stops count as stations</Label>
                            <ToggleCard
                                title="Train stations"
                                description="Always, small halts included."
                                checked
                                disabled
                                onCheckedChange={() => undefined}
                            />
                            <ToggleCard
                                title="Tram stops"
                                description="Funiculars count as trams."
                                checked={draft.stationKinds.trams}
                                onCheckedChange={(trams) =>
                                    update({
                                        stationKinds: {
                                            ...draft.stationKinds,
                                            trams,
                                        },
                                    })
                                }
                            />
                            <ToggleCard
                                title="Boat stops"
                                checked={draft.stationKinds.boats}
                                onCheckedChange={(boats) =>
                                    update({
                                        stationKinds: {
                                            ...draft.stationKinds,
                                            boats,
                                        },
                                    })
                                }
                            />
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-600 px-3 py-2">
                                <span className="text-xs">
                                    <strong>
                                        {typesOn} of {allTypes.length} question
                                        types
                                    </strong>{" "}
                                    on (
                                    {draft.region === "switzerland"
                                        ? "Swiss"
                                        : "standard"}{" "}
                                    rules). Radar and thermometer are always in.
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        setShowQuestions(!showQuestions)
                                    }
                                    aria-expanded={showQuestions}
                                >
                                    {showQuestions ? "Done" : "Customise"}
                                </Button>
                            </div>
                            {showQuestions &&
                                (
                                    Object.keys(TYPES) as (keyof typeof TYPES)[]
                                ).map((category) => (
                                    <section key={category}>
                                        <h3 className="mb-1 font-semibold font-poppins">
                                            {CATEGORY_NAMES[category]}
                                        </h3>
                                        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                            {Object.entries(TYPES[category])
                                                .filter(
                                                    ([type]) =>
                                                        !ALWAYS_OFF.includes(
                                                            questionKey(
                                                                category,
                                                                type,
                                                            ),
                                                        ),
                                                )
                                                .map(([type, info]) => {
                                                    const key = questionKey(
                                                        category,
                                                        type,
                                                    );
                                                    const enabled =
                                                        !draft.disabledQuestions.includes(
                                                            key,
                                                        );
                                                    return (
                                                        <li
                                                            key={type}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Checkbox
                                                                id={`q-${key}`}
                                                                checked={
                                                                    enabled
                                                                }
                                                                onCheckedChange={(
                                                                    checked,
                                                                ) =>
                                                                    toggleQuestion(
                                                                        key,
                                                                        !!checked,
                                                                    )
                                                                }
                                                            />
                                                            <label
                                                                htmlFor={`q-${key}`}
                                                                className="cursor-pointer"
                                                            >
                                                                {info.label}
                                                            </label>
                                                        </li>
                                                    );
                                                })}
                                        </ul>
                                    </section>
                                ))}
                            {lakeEnabled && (
                                <>
                                    <Label>
                                        Lake shore question: lakes of at least
                                    </Label>
                                    <Select
                                        trigger="Minimum lake size"
                                        options={Object.fromEntries(
                                            LAKE_AREA_CHOICES.map((km2) => [
                                                String(km2),
                                                `${km2} km²`,
                                            ]),
                                        )}
                                        value={String(draft.minLakeAreaKm2)}
                                        onValueChange={(value) =>
                                            update({
                                                minLakeAreaKm2: Number(value),
                                            })
                                        }
                                    />
                                </>
                            )}
                            {mode === "start" && (
                                <ToggleCard
                                    title="Seekers can answer questions"
                                    description="Off: only the hider answers, and answered questions are locked for the seekers. The hider can change this later."
                                    checked={draft.seekersCanAnswer}
                                    onCheckedChange={(seekersCanAnswer) =>
                                        update({ seekersCanAnswer })
                                    }
                                />
                            )}
                        </>
                    )}
                </div>

                <div className="flex justify-between gap-2 pt-2">
                    <Button
                        variant="outline"
                        disabled={step === 0 || busy}
                        onClick={() => setStep(step - 1)}
                    >
                        Back
                    </Button>
                    {step < STEPS.length - 1 ? (
                        <Button onClick={() => setStep(step + 1)}>Next</Button>
                    ) : (
                        <Button onClick={finish} disabled={busy}>
                            {mode === "start" ? "Start the game" : "Save"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
