// A buzz, a beep and (with the app in the background) a system notification
// for what a player must not miss. Browsers unlock sound on the first tap,
// so the beep works from the first interaction on.
import { alertsEnabled } from "@/lib/context";

let audio: AudioContext | null = null;

const unlock = () => {
    try {
        audio ??= new AudioContext();
        void audio.resume();
    } catch {
        // No audio on this browser.
    }
};

if (typeof window !== "undefined") {
    for (const type of ["pointerdown", "keydown", "touchend"]) {
        window.addEventListener(type, unlock, { once: true, passive: true });
    }
}

/** Two short notes. */
const beep = () => {
    if (!audio || audio.state !== "running") return;
    const now = audio.currentTime;
    for (const [start, frequency] of [
        [0, 880],
        [0.18, 1175],
    ]) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.15);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(now + start);
        oscillator.stop(now + start + 0.16);
    }
};

export type NotificationState =
    | "unsupported"
    | "default"
    | "granted"
    | "denied";

export const notificationsState = (): NotificationState =>
    typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission;

/** Asks the browser for permission to notify (needs a tap to ask). */
export const askNotifications = async (): Promise<NotificationState> => {
    if (typeof Notification === "undefined") return "unsupported";
    try {
        return await Notification.requestPermission();
    } catch {
        return "denied";
    }
};

/** A system notification, when the app is in the background and allowed. */
const systemNotification = async (title: string, body?: string) => {
    if (notificationsState() !== "granted" || !document.hidden) return;
    try {
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration?.showNotification) {
            await registration.showNotification(title, { body, tag: "jetlag" });
        } else {
            new Notification(title, { body, tag: "jetlag" });
        }
    } catch {
        // Notifications blocked or unavailable: the toast is still there.
    }
};

/** Buzzes, beeps and notifies (if allowed) about something that happened. */
export const notify = (title: string, body?: string) => {
    if (!alertsEnabled.get()) return;
    try {
        navigator.vibrate?.([200, 100, 200]);
    } catch {
        // No vibration here.
    }
    beep();
    void systemNotification(title, body);
};
