// The phone's position, followed while something needs it: Follow me (the
// blue dot; new questions start there; a seeker's position for the hider)
// or the hider's pin following them. One watch for all of it, started once
// by the map.
import { toast } from "react-toastify";

import { followMe } from "@/lib/context";
import { hiderPhone } from "@/lib/game/session";
import {
    currentPosition,
    describeGeoError,
    watchPosition,
} from "@/lib/geolocation";
import { followPin, pinFollowsGps } from "@/lib/hiderSpot";

let started = false;
/**
 * The last fix is offered to the pin again this often: one held back (the
 * pin follows at most every 15 s) still arrives when the phone stands still
 * and sends no more.
 */
const AGAIN_MS = 5_000;

export const startTracking = () => {
    if (started) return;
    started = true;
    let stop: (() => void) | null = null;
    let again: ReturnType<typeof setInterval> | undefined;
    const update = () => {
        const wanted =
            followMe.get() || (pinFollowsGps.get() && hiderPhone.get());
        if (wanted && !stop) {
            stop = watchPosition(
                ({ coords }) => {
                    const here = {
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        accuracy: coords.accuracy,
                        at: Date.now(),
                    };
                    currentPosition.set(here);
                    followPin(here);
                },
                (error) => {
                    toast.error(describeGeoError(error), {
                        autoClose: 12000,
                        toastId: "gps-error",
                    });
                    followMe.set(false);
                    pinFollowsGps.set(false);
                },
            );
            again = setInterval(() => {
                const here = currentPosition.get();
                if (here) followPin({ ...here, at: Date.now() });
            }, AGAIN_MS);
        } else if (!wanted && stop) {
            stop();
            stop = null;
            clearInterval(again);
            currentPosition.set(null);
        }
    };
    followMe.listen(update);
    pinFollowsGps.listen(update);
    hiderPhone.listen(update);
    update();
};
