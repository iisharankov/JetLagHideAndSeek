// The phone's position, with errors people can act on. Browsers only give
// a position over https, with the site allowed to use location, and with
// location turned on for the phone and the browser app itself.
import { atom } from "nanostores";

/** Where the phone is, while "Follow me" is on (and when it last knew). */
export const currentPosition = atom<{
    latitude: number;
    longitude: number;
    at: number;
} | null>(null);

/** The position, if it's recent enough to start a question from. */
export const recentPosition = (now = Date.now(), maxAgeMs = 2 * 60_000) => {
    const here = currentPosition.get();
    return here && now - here.at <= maxAgeMs ? here : null;
};

const HIGH: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15_000,
    maximumAge: 0,
};
const LOW: PositionOptions = {
    enableHighAccuracy: false,
    timeout: 30_000,
    maximumAge: 60_000,
};

export const describeGeoError = (error: unknown) => {
    const geo = error as Partial<GeolocationPositionError> | undefined;
    if (typeof window !== "undefined" && !window.isSecureContext) {
        return "Location only works over https.";
    }
    switch (geo?.code) {
        case 1:
            return "Location is blocked for this site. Allow it: tap the padlock (or ⓘ) in the address bar → Site settings → Location. Also check the phone lets the browser use location.";
        case 2:
            return "No position fix: turn on location on the phone (GPS / high accuracy) and try again, preferably outdoors.";
        case 3:
            return "No position fix in time. Try again, preferably outdoors or near a window.";
        default:
            return geo?.message || "Couldn't get your location.";
    }
};

/** One position: a precise fix, or a rough one when that takes too long. */
export const locate = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("This browser has no location support."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            resolve,
            (error) => {
                if (error.code === error.TIMEOUT) {
                    navigator.geolocation.getCurrentPosition(
                        resolve,
                        reject,
                        LOW,
                    );
                } else {
                    reject(error);
                }
            },
            HIGH,
        );
    });

/**
 * Follows the phone's position until the returned function is called. A
 * precise watch that times out is restarted as a rough one.
 */
export const watchPosition = (
    onPosition: (position: GeolocationPosition) => void,
    onError: (error: GeolocationPositionError) => void,
) => {
    let id: number | null = null;
    let precise = true;
    const start = (options: PositionOptions) => {
        id = navigator.geolocation.watchPosition(
            onPosition,
            (error) => {
                if (error.code === error.TIMEOUT && precise) {
                    precise = false;
                    stop();
                    start(LOW);
                } else {
                    onError(error);
                }
            },
            options,
        );
    };
    const stop = () => {
        if (id !== null) navigator.geolocation.clearWatch(id);
        id = null;
    };
    if (!navigator.geolocation) {
        onError({
            code: 2,
            message: "This browser has no location support.",
        } as GeolocationPositionError);
        return stop;
    }
    start(HIGH);
    return stop;
};
