import { useStore } from "@nanostores/react";

import { Button } from "@/components/ui/button";
import { followMe } from "@/lib/context";

/**
 * A seeker without their location on: the rulebook has the seekers keep a
 * tracker on so the hider can follow them, and questions are asked from
 * where they are. Until it's on.
 */
export const LocationPrompt = () => {
    const $followMe = useStore(followMe);
    if ($followMe) return null;
    return (
        <div
            className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-sky-500/60 bg-sky-950/40 px-2 py-1.5 text-xs"
            data-testid="location-prompt"
        >
            <p className="min-w-0 flex-1">
                <strong>Location off.</strong> The rules have seekers keep a
                tracker on: the hider follows you on their map.
            </p>
            <Button
                size="sm"
                className="shrink-0"
                onClick={() => followMe.set(true)}
                aria-label="Turn on location"
            >
                Turn on
            </Button>
        </div>
    );
};
