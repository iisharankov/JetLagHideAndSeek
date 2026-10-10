// The server's clock, so every phone shows the same times. Each answer of
// the API carries the server's "now"; the difference to this phone's clock
// corrects the clocks and timers shown.
import { atom } from "nanostores";

/**
 * The server's clock minus this phone's, from the server's answers. Clock
 * times are the server's, so a phone minutes off still shows them right.
 */
export const serverOffset = atom<number>(0);
export const noteServerTime = (now: unknown) => {
    if (typeof now === "number" && Number.isFinite(now)) {
        serverOffset.set(now - Date.now());
    }
};
/** Now, by the server's clock. */
export const serverNow = () => Date.now() + serverOffset.get();
