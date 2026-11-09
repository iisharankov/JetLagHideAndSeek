import { useStore } from "@nanostores/react";
import { useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
    armThermometer,
    askThermometer,
    cancelThermometer,
    gameRole,
} from "@/lib/game/session";
import { canAsk, coveredKm, kmText, remainingKm } from "@/lib/game/thermometer";
import { currentPosition, recentPosition } from "@/lib/geolocation";
import type { ThermometerQuestion } from "@/maps/schema";

/**
 * The game bar of a thermometer before it's asked: start it where you are,
 * then (travelling) how far you've come, Ask once the distance is covered,
 * or call it off. The hider sees that it's under way, with nothing to
 * answer.
 */
export const ThermometerBar = ({
    data,
    questionKey,
    armed,
    refused,
}: {
    data: ThermometerQuestion;
    questionKey: number;
    armed: boolean;
    /** A curse or a rest stops the seekers from asking now. */
    refused: boolean;
}) => {
    const $role = useStore(gameRole);
    const $here = useStore(currentPosition);
    const [busy, setBusy] = useState(false);
    const here = recentPosition();
    void $here;

    const run = async (what: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await what();
        } finally {
            setBusy(false);
        }
    };

    if ($role === "hider") {
        return armed ? (
            <p className="mt-1" data-testid="thermometer-hider">
                Started from the Start pin, {kmText(data.distanceKm)} km.
                Nothing to answer until the seekers have travelled it and ask.
            </p>
        ) : null;
    }

    if (!armed) {
        const start = here
            ? { lat: here.latitude, lng: here.longitude }
            : { lat: data.latA, lng: data.lngA };
        return (
            <Button
                size="sm"
                className="mt-1 h-auto min-h-11 w-full whitespace-normal bg-violet-600 py-2 text-white hover:bg-violet-500"
                disabled={busy || refused}
                data-testid="thermometer-start-button"
                onClick={() =>
                    void run(() =>
                        armThermometer(questionKey, data.distanceKm, start),
                    )
                }
            >
                Start the thermometer ({kmText(data.distanceKm)} km)
            </Button>
        );
    }

    const covered = here
        ? coveredKm({ lat: data.latA, lng: data.lngA }, here)
        : null;
    const ready = canAsk(data, here);
    const share = covered === null ? 0 : Math.min(1, covered / data.distanceKm);
    return (
        <div
            className="mt-1 flex flex-col gap-1"
            data-testid="thermometer-travel"
        >
            <p className="flex justify-between gap-2">
                <span>Covered, as the crow flies</span>
                <strong data-testid="thermometer-covered">
                    {covered === null
                        ? "?"
                        : `${kmText(Math.min(covered, data.distanceKm))} of ${kmText(data.distanceKm)} km`}
                </strong>
            </p>
            <div
                className="h-2 overflow-hidden rounded-full bg-slate-700"
                role="progressbar"
                aria-label="Distance covered"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(share * 100)}
            >
                <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${share * 100}%` }}
                />
            </div>
            <p className="opacity-80">
                {here
                    ? "Leave the dashed circle, then ask. Other questions can be asked meanwhile."
                    : "Turn location on to see how far you've come."}
            </p>
            <Button
                size="sm"
                className="h-auto min-h-11 w-full whitespace-normal bg-violet-600 py-2 text-white hover:bg-violet-500"
                disabled={busy || !ready || refused}
                data-testid="thermometer-ask"
                onClick={() =>
                    void run(async () => {
                        const now = recentPosition();
                        if (!now) {
                            toast.error("No position: turn location on.");
                            return;
                        }
                        await askThermometer(questionKey, {
                            lat: now.latitude,
                            lng: now.longitude,
                        });
                    })
                }
            >
                {ready
                    ? "Ask: hotter or colder?"
                    : `Ask: hotter or colder? · ${kmText(remainingKm(data, here))} km to go`}
            </Button>
            <Button
                size="sm"
                variant="outline"
                className="h-auto min-h-11 w-full whitespace-normal py-2"
                disabled={busy}
                onClick={() => void run(() => cancelThermometer(questionKey))}
            >
                Cancel the thermometer (no cost)
            </Button>
        </div>
    );
};
