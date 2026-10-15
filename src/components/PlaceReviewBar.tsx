import { useStore } from "@nanostores/react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { menuOpen, placeReview, setupDialog } from "@/lib/context";
import {
    localRejections,
    rejectedPlacesByArea,
    reviewCounts,
    setLocalRejections,
} from "@/lib/placeRules";
import { cn } from "@/lib/utils";
import {
    type PlaceKind,
    REVIEW_KINDS,
    reviewKindLabel,
} from "@/maps/questions/places";

/**
 * Reviewing the map's places before a game, over the map: every zoo, park,
 * museum… the questions use, to reject the wrong ones. Opened from game
 * setup or from Settings → Places, and goes back there.
 */
export const PlaceReviewBar = ({ className }: { className?: string }) => {
    const $review = useStore(placeReview);
    const $counts = useStore(reviewCounts);
    useStore(rejectedPlacesByArea);
    if (!$review) return null;
    const kind = $review.kind;
    const rejectedOfKind = localRejections().filter(
        (entry) => entry.kind === kind,
    ).length;

    const done = () => {
        placeReview.set(null);
        if ($review.back === "settings") menuOpen.set(true);
        else setupDialog.set($review.back);
    };

    return (
        <section
            className={cn(
                "flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border border-slate-700 bg-[hsl(var(--sidebar-background))] p-3 text-white shadow-lg",
                className,
            )}
            data-testid="place-review-bar"
        >
            <h2 className="text-sm font-semibold font-poppins">
                Places on the map
            </h2>
            <p className="text-xs text-slate-400">
                Every place of a kind the questions use. Tap a pin for its name,
                and reject what&apos;s wrong (a &quot;zoo&quot; that&apos;s a
                pet shop). The same place listed several times is shown once.
                Rejections are kept for this play area and go into the game.
                Built-in rules already leave out unnamed places and the
                mis-tagged (pet corners as zoos, indoor golf, toy libraries);
                those aren&apos;t shown.
            </p>
            <Select
                trigger="Kind of place"
                options={Object.fromEntries(
                    REVIEW_KINDS.map((k) => [k, reviewKindLabel(k)]),
                )}
                value={kind}
                onValueChange={(next) =>
                    placeReview.set({ ...$review, kind: next })
                }
            />
            <p className="text-xs" data-testid="place-review-count">
                {$counts.loading
                    ? "Loading the places…"
                    : `${$counts.total} place${$counts.total === 1 ? "" : "s"}, ${$counts.rejected} rejected${
                          $counts.merged
                              ? `, ${$counts.merged} duplicate${$counts.merged === 1 ? "" : "s"} merged`
                              : ""
                      }.`}
            </p>
            {rejectedOfKind > 0 && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        setLocalRejections(
                            localRejections().filter(
                                (entry) => entry.kind !== kind,
                            ),
                        )
                    }
                >
                    Restore all{" "}
                    {reviewKindLabel(kind as PlaceKind).toLowerCase()}
                </Button>
            )}
            <Button onClick={done}>Done</Button>
        </section>
    );
};
