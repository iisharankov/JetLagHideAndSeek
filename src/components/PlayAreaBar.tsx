import { useStore } from "@nanostores/react";
import { useEffect } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { SegmentedControl, ToggleCard } from "@/components/ui/toggle-card";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    additionalMapGeoLocations,
    mapGeoLocation,
    playAreaDrawing,
    playAreaEditing,
    polyGeoJSON,
    setupDialog,
} from "@/lib/context";
import {
    applyPlaces,
    currentPlaces,
    flipPlace,
    PICK_LEVELS,
    pickHint,
    pickLevel,
    type PickMode,
    pickMode,
    type PlayAreaPlaces,
    plural,
    removePlace,
} from "@/lib/playAreaPick";
import { cn } from "@/lib/utils";
import { adminLevelLabel } from "@/maps/adminBorders";
import { startPickLayer } from "@/maps/playAreaPickLayer";

import { PlacePicker } from "./PlacePicker";

const capitalised = (text: string) => text[0].toUpperCase() + text.slice(1);

/** A change from the list, unless it would leave no area at all. */
const change = (next: PlayAreaPlaces | null) => {
    if (next) applyPlaces(next);
    else
        toast.info("The play area needs at least one area.", {
            toastId: "play-area-empty",
        });
};

/**
 * Choosing the play area, over the map: tap cantons, districts or
 * municipalities on the map, search for a place, or draw the area. The
 * list shows what's in and what's cut out. Opened from game setup, and
 * goes back to it.
 */
export const PlayAreaBar = ({ className }: { className?: string }) => {
    const $editing = useStore(playAreaEditing);
    const $drawing = useStore(playAreaDrawing);
    const $polyGeoJSON = useStore(polyGeoJSON);
    const $base = useStore(mapGeoLocation);
    const $extra = useStore(additionalMapGeoLocations);
    const $level = useStore(pickLevel);
    const $mode = useStore(pickMode);
    const $hint = useStore(pickHint);
    const isMobile = useIsMobile();
    useEffect(() => ($editing ? startPickLayer() : undefined), [!!$editing]);
    if (!$editing) return null;

    const done = () => {
        playAreaDrawing.set(false);
        playAreaEditing.set(false);
        setupDialog.set($editing);
    };
    const country = $base.properties.countrycode;
    const places = [
        { location: $base, added: true },
        ...$extra.map(({ location, added }) => ({ location, added })),
    ];

    return (
        <section
            className={cn(
                // On a phone, clear of the Menu button at the top right.
                "flex max-h-[calc(100svh-6rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto rounded-lg border border-slate-700 bg-[hsl(var(--sidebar-background))] p-3 text-white shadow-lg max-md:mr-14",
                className,
            )}
            data-testid="play-area-bar"
        >
            <h2 className="text-sm font-semibold font-poppins">Play area</h2>
            <SegmentedControl<string>
                label="Areas on the map"
                options={[
                    ...PICK_LEVELS.map((level) => ({
                        value: String(level),
                        label: capitalised(
                            plural(adminLevelLabel(level, country)),
                        ),
                    })),
                    { value: "off", label: "Off" },
                ]}
                value={$level === null ? "off" : String($level)}
                onValueChange={(value) =>
                    pickLevel.set(value === "off" ? null : Number(value))
                }
            />
            {$level !== null && (
                <>
                    <SegmentedControl<PickMode>
                        label="A tap on an area"
                        options={[
                            { value: "add", label: "Tap adds" },
                            { value: "cut", label: "Tap cuts out" },
                        ]}
                        value={$mode}
                        onValueChange={pickMode.set}
                    />
                    <p className="text-xs text-slate-400">
                        {$hint ||
                            ($mode === "add"
                                ? "Tap an area to add it, again to take it out. One inside an area you have replaces it."
                                : "Tap an area to cut it out of the play area (a lake, a town), again to put it back.")}
                    </p>
                </>
            )}
            {$polyGeoJSON ? (
                <p className="text-xs text-green-400">
                    A drawn area is in use: tapping or searching replaces it.
                </p>
            ) : (
                // Folded on a phone, so the map keeps most of the screen.
                <details
                    className="rounded-md border border-slate-700"
                    open={!isMobile}
                >
                    <summary className="cursor-pointer px-2 py-1 text-xs font-semibold">
                        Chosen areas ({places.length})
                    </summary>
                    <ul
                        className="flex max-h-40 flex-col overflow-y-auto"
                        data-testid="play-area-list"
                    >
                        {places.map(({ location, added }) => {
                            const id = location.properties.osm_id;
                            return (
                                <li
                                    key={id}
                                    className="flex items-center gap-2 px-2 py-1 text-xs odd:bg-slate-800/50"
                                >
                                    <span
                                        className={cn(
                                            "w-4 shrink-0 text-center font-bold",
                                            added
                                                ? "text-green-400"
                                                : "text-red-400",
                                        )}
                                        aria-hidden="true"
                                    >
                                        {added ? "+" : "−"}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">
                                        {location.properties.name}
                                        {location.properties.type && (
                                            <span className="text-slate-400">
                                                {" "}
                                                ({location.properties.type})
                                            </span>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5"
                                        onClick={() =>
                                            change(
                                                flipPlace(currentPlaces(), id),
                                            )
                                        }
                                    >
                                        {added ? "Cut out" : "Put back"}
                                    </button>
                                    <button
                                        type="button"
                                        className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5"
                                        aria-label={`Remove ${location.properties.name}`}
                                        onClick={() =>
                                            change(
                                                removePlace(
                                                    currentPlaces(),
                                                    id,
                                                ),
                                            )
                                        }
                                    >
                                        ×
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </details>
            )}
            <details
                className="rounded-md border border-slate-700"
                open={$level === null || $drawing}
            >
                <summary className="cursor-pointer px-2 py-1 text-xs font-semibold">
                    Search or draw instead
                </summary>
                <div className="flex flex-col gap-2 p-2">
                    <PlacePicker className="w-full" />
                    <ToggleCard
                        title="Draw the area on the map"
                        description={
                            $drawing
                                ? "Polygon tool at the bottom left: tap the corners, then the first corner again to close the shape. Shapes add up; the edit and bin tools change or remove them."
                                : "For any shape the areas can't give you."
                        }
                        checked={$drawing}
                        onCheckedChange={playAreaDrawing.set}
                    />
                </div>
            </details>
            <Button onClick={done}>Done</Button>
        </section>
    );
};
