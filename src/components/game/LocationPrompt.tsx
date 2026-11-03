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
            className="mx-2 mt-2 flex flex-col gap-1 rounded-md border border-sky-500/60 bg-sky-950/40 p-2 text-xs"
            data-testid="location-prompt"
        >
            <p>
                <strong>Turn on your location.</strong> The rules have the
                seekers keep a tracker on: the hider sees where you are on their
                map, and your questions are asked from there. It works while
                this app is open.
            </p>
            <Button
                size="sm"
                className="self-start"
                onClick={() => followMe.set(true)}
            >
                Turn on location
            </Button>
        </div>
    );
};
