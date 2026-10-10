import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ChoiceCards,
    SegmentedControl,
    ToggleCard,
} from "@/components/ui/toggle-card";
import {
    additionalMapGeoLocations,
    gameSettings,
    mapGeoLocation,
    playAreaEditing,
    polyGeoJSON,
} from "@/lib/context";
import { deckComposition } from "@/lib/game/deck";
import { startGame } from "@/lib/game/session";
import {
    hidingRadiusDefaultKm,
    RADAR_KM,
    radarDefaultKm,
    radarDefaults,
    regionDisabledQuestions,
    tentacleDefaults,
} from "@/lib/game/settings";
import type { GameSettings, GameSize } from "@/lib/game/types";
import { applyGameSettings } from "@/lib/gameSettings";
import { playAreaParts } from "@/lib/sharedGame";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";

import { DeckEditor } from "./setup/DeckEditor";
import { QuestionsStep } from "./setup/QuestionsStep";

const STEPS = ["Game", "Hiding zones", "Questions"] as const;

/** The draft kept while the play area is being chosen on the map. */
let pendingDraft: GameSettings | null = null;

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
        update({
            size,
            hidingRadiusKm: hidingRadiusDefaultKm(size),
            radarKm: radarDefaults(size),
        });
    const toggleRadius = (km: number) => {
        const on = draft.radarKm.includes(km);
        if (on && draft.radarKm.length === 1) return;
        update({
            radarKm: on
                ? draft.radarKm.filter((other) => other !== km)
                : [...draft.radarKm, km].sort((a, b) => a - b),
        });
    };

    const setRegion = (region: GameSettings["region"]) =>
        update({
            region,
            disabledQuestions: regionDisabledQuestions(region),
            tentacleKm: tentacleDefaults(region),
        });

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
        ? { base: "a drawn area", added: [], removed: [] }
        : playAreaParts({
              kind: "place",
              location: $mapGeoLocation,
              alternateLocations: $additional,
          });
    const changePlayArea = () => {
        pendingDraft = draft;
        onOpenChange(false);
        playAreaEditing.set(mode);
    };
    const deckSize = deckComposition(draft).length;
    const deckChanged =
        Object.keys(draft.deckCounts).length > 0 ||
        draft.customCards.length > 0;

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
                                <div
                                    className="flex min-w-0 flex-wrap items-center gap-1"
                                    data-testid="play-area-summary"
                                >
                                    <span className="font-semibold">
                                        {playArea.base}
                                    </span>
                                    {playArea.added.map((name) => (
                                        <span
                                            key={`+${name}`}
                                            className="rounded bg-green-900/70 px-1.5 text-xs"
                                        >
                                            + {name}
                                        </span>
                                    ))}
                                    {playArea.removed.map((name) => (
                                        <span
                                            key={`-${name}`}
                                            className="rounded bg-red-900/70 px-1.5 text-xs"
                                        >
                                            − {name}
                                        </span>
                                    ))}
                                </div>
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
                            <Label>Radar distances</Label>
                            <div
                                className="flex flex-wrap gap-1"
                                role="group"
                                aria-label="Radar distances"
                                data-testid="radar-choices"
                            >
                                {RADAR_KM.map((km) => {
                                    const on = draft.radarKm.includes(km);
                                    return (
                                        <button
                                            key={km}
                                            type="button"
                                            aria-pressed={on}
                                            className={cn(
                                                "rounded-md px-2 py-1 text-xs font-semibold",
                                                on
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-slate-700",
                                            )}
                                            onClick={() => toggleRadius(km)}
                                        >
                                            {km < 1
                                                ? `${km * 1000} m`
                                                : `${km} km`}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-slate-400">
                                The radar question&apos;s distances in this
                                game; the size picks a sensible set, tap to
                                change it.
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
                            <Label>Seekers</Label>
                            <ToggleCard
                                title="Seekers can show the hiding zones"
                                description="The stations still in play, as green circles on their map. Off: only the hider's phone shows them; the seekers keep the shaded map."
                                checked={draft.seekersSeeStations}
                                onCheckedChange={(seekersSeeStations) =>
                                    update({ seekersSeeStations })
                                }
                            />
                            <Label>The hider</Label>
                            <ToggleCard
                                title="Late answers cost"
                                description="Over five minutes to answer: two warnings, then the seekers' next question is free (the hider draws nothing for it)."
                                checked={draft.latePenalty}
                                onCheckedChange={(latePenalty) =>
                                    update({ latePenalty })
                                }
                            />
                            <Label>Tentacle distances (km)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="flex flex-col gap-1 text-xs">
                                    Museums, hospitals, cinemas…
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        min={0.1}
                                        step={0.5}
                                        aria-label="Tentacle distance, small places (km)"
                                        value={draft.tentacleKm[0]}
                                        debounce={0}
                                        onChange={(event) => {
                                            const km = Number(
                                                event.target.value,
                                            );
                                            if (km > 0) {
                                                update({
                                                    tentacleKm: [
                                                        km,
                                                        draft.tentacleKm[1],
                                                    ],
                                                });
                                            }
                                        }}
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-xs">
                                    Zoos, parks, aquariums
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        min={0.1}
                                        step={0.5}
                                        aria-label="Tentacle distance, big places (km)"
                                        value={draft.tentacleKm[1]}
                                        debounce={0}
                                        onChange={(event) => {
                                            const km = Number(
                                                event.target.value,
                                            );
                                            if (km > 0) {
                                                update({
                                                    tentacleKm: [
                                                        draft.tentacleKm[0],
                                                        km,
                                                    ],
                                                });
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-slate-400">
                                Under the Swiss rules 2 and 10 km; the
                                rulebook&apos;s 2 and 25 km otherwise.
                            </p>
                        </>
                    )}

                    {step === 2 && (
                        <QuestionsStep
                            draft={draft}
                            mode={mode}
                            update={update}
                            toggleQuestion={toggleQuestion}
                            showQuestions={showQuestions}
                            setShowQuestions={setShowQuestions}
                        />
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
