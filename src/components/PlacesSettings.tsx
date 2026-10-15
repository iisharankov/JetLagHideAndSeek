import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import { mapGeoJSON, placeReview } from "@/lib/context";
import {
    localRejections,
    rejectedPlacesByArea,
    setLocalRejections,
} from "@/lib/placeRules";
import {
    placesInPlayArea,
    REVIEW_KINDS,
    reviewKindLabel,
} from "@/maps/questions/places";

import { Button } from "./ui/button";

/**
 * Menu → Settings → Places: what the place questions count in this play
 * area, after the built-in rules and this phone's rejections, and the way
 * to the review on the map.
 */
export const PlacesSettings = () => {
    const $area = useStore(mapGeoJSON);
    const $local = useStore(rejectedPlacesByArea);
    const [counts, setCounts] = useState<Record<string, number> | null>(null);
    const rejected = localRejections();

    useEffect(() => {
        let cancelled = false;
        setCounts(null);
        if (!$area) return;
        const list = localRejections();
        Promise.all(
            REVIEW_KINDS.map(
                async (kind) =>
                    [
                        kind,
                        (await placesInPlayArea(kind, list)).length,
                    ] as const,
            ),
        )
            .then((entries) => {
                if (!cancelled) setCounts(Object.fromEntries(entries));
            })
            .catch(() => {
                if (!cancelled) setCounts({});
            });
        return () => {
            cancelled = true;
        };
    }, [$area, $local]);

    return (
        <div className="flex flex-col gap-2" data-testid="places-settings">
            <p className="text-xs text-slate-400">
                What the place questions count in this play area. Places outside
                it don&apos;t exist (a question with none inside has the null
                answer). Built-in rules leave out unnamed and mis-tagged places
                (a pet corner as a zoo, an indoor golf lounge, a toy library),
                and the same place listed several times counts once.
            </p>
            {counts === null ? (
                <p className="text-xs">Counting…</p>
            ) : (
                <ul
                    className="grid grid-cols-2 gap-x-4 text-xs"
                    data-testid="places-counts"
                >
                    {REVIEW_KINDS.map((kind) => (
                        <li key={kind} className="flex justify-between gap-2">
                            <span>{reviewKindLabel(kind)}</span>
                            <span className="tabular-nums">
                                {counts[kind] ?? "–"}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-xs" data-testid="places-rejected">
                {rejected.length} rejected by you here
                {rejected.length > 0
                    ? "; they go into the next game started from this phone"
                    : ""}
                .
            </p>
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        placeReview.set({ back: "settings", kind: "zoo" })
                    }
                >
                    Review on the map…
                </Button>
                {rejected.length > 0 && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocalRejections([])}
                    >
                        Reset rejections
                    </Button>
                )}
            </div>
        </div>
    );
};
