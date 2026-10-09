import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
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
import { SegmentedControl, ToggleCard } from "@/components/ui/toggle-card";
import { gameSettings, mapGeoLocation, polyGeoJSON } from "@/lib/context";
import { startGame } from "@/lib/game/session";
import {
    hidingRadiusDefaultKm,
    LAKE_AREA_CHOICES,
    questionKey,
    radarDefaultKm,
    regionDisabledQuestions,
} from "@/lib/game/settings";
import type { GameSettings, GameSize } from "@/lib/game/types";
import { applyGameSettings } from "@/lib/gameSettings";
import { TYPES } from "@/lib/questionInfo";
import { errorMessage } from "@/maps/errors";

const STEPS = ["Game", "Hiding zones", "Questions"] as const;

const CATEGORY_NAMES: Record<keyof typeof TYPES, string> = {
    matching: "Matching",
    measuring: "Measuring",
    tentacles: "Tentacles",
};

/**
 * The game's settings, a few screens at a time: size and rules, hiding
 * zones, which questions are in the game. Used before a shared game starts
 * (mode "start": the last button starts it) and for playing alone.
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

    useEffect(() => {
        if (open) {
            setDraft(gameSettings.get());
            setStep(0);
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

    const playArea = polyGeoJSON.get()
        ? "a drawn area"
        : (mapGeoLocation.get().properties.name ?? "no play area yet");
    const lakeEnabled = !draft.disabledQuestions.includes(
        questionKey("measuring", "lake"),
    );

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
                            <p className="text-slate-300">
                                Play area: <strong>{playArea}</strong>
                                <span className="text-xs text-slate-400">
                                    {" "}
                                    (chosen on the map, at the top)
                                </span>
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
                                The rulebook&apos;s ¼ mile (small and medium
                                games) or ½ mile (large) is 0.5 km or 1 km.
                            </p>
                            <Label>Which stops count as stations</Label>
                            <ToggleCard
                                title="Train stations"
                                description="Always."
                                checked
                                disabled
                                onCheckedChange={() => undefined}
                            />
                            <ToggleCard
                                title="Halts"
                                description="Small request stops on railway lines."
                                checked={draft.stationKinds.halts}
                                onCheckedChange={(halts) =>
                                    update({
                                        stationKinds: {
                                            ...draft.stationKinds,
                                            halts,
                                        },
                                    })
                                }
                            />
                            <ToggleCard
                                title="Tram stops"
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
                            <p className="text-xs text-slate-400">
                                Untick a question type to leave it out of this
                                game. Radar and thermometer questions are always
                                in.
                            </p>
                            {(Object.keys(TYPES) as (keyof typeof TYPES)[]).map(
                                (category) => (
                                    <section key={category}>
                                        <h3 className="mb-1 font-semibold font-poppins">
                                            {CATEGORY_NAMES[category]}
                                        </h3>
                                        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                            {Object.entries(
                                                TYPES[category],
                                            ).map(([type, info]) => {
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
                                                            checked={enabled}
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
                                ),
                            )}
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
