import { useStore } from "@nanostores/react";

import { Button } from "@/components/ui/button";
import { ToggleCard } from "@/components/ui/toggle-card";
import {
    playAreaDrawing,
    playAreaEditing,
    polyGeoJSON,
    setupDialog,
} from "@/lib/context";
import { cn } from "@/lib/utils";

import { PlacePicker } from "./PlacePicker";

/**
 * Choosing the play area, over the map: search for a place, or draw the
 * area with the polygon tools. Opened from game setup, and goes back to it.
 */
export const PlayAreaBar = ({ className }: { className?: string }) => {
    const $editing = useStore(playAreaEditing);
    const $drawing = useStore(playAreaDrawing);
    const $polyGeoJSON = useStore(polyGeoJSON);
    if (!$editing) return null;

    const done = () => {
        playAreaDrawing.set(false);
        playAreaEditing.set(false);
        setupDialog.set($editing);
    };

    return (
        <section
            className={cn(
                "flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border border-slate-700 bg-[hsl(var(--sidebar-background))] p-3 text-white shadow-lg",
                className,
            )}
            data-testid="play-area-bar"
        >
            <h2 className="text-sm font-semibold font-poppins">Play area</h2>
            <p className="text-xs text-slate-400">
                Search for a city, a canton or a country. <strong>+</strong>{" "}
                adds an area, <strong>−</strong> cuts one out (a lake, a
                neighbouring canton), <strong>×</strong> drops it from the list.
            </p>
            <PlacePicker className="w-full" />
            <ToggleCard
                title="Draw the area on the map"
                description={
                    $drawing
                        ? "Polygon tool at the bottom left: tap the corners, then the first corner again to close the shape. Shapes add up; the edit and bin tools change or remove them."
                        : "For any shape the search can't give you."
                }
                checked={$drawing}
                onCheckedChange={playAreaDrawing.set}
            />
            {$polyGeoJSON && (
                <p className="text-xs text-green-400">
                    A drawn area is in use.
                </p>
            )}
            <Button onClick={done}>Done</Button>
        </section>
    );
};
