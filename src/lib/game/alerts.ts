// A buzz, a beep and (with the app in the background) a system notification
// for what a player must not miss. Browsers unlock sound on the first tap,
// so the beep works from the first interaction on. Push notifications reach
// the phone even with the app closed (see the end of this file).
import { alertsEnabled } from "@/lib/context";
import { persistentAtom } from "@/lib/persist";

import {
    deletePushSubscription,
    fetchPushKey,
    postPushSubscription,
} from "./api";

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

/** Two beeps within this time would be one: a burst of news sounds once. */
const QUIET_MS = 3000;
let lastSoundAt = 0;

/**
 * Buzzes, beeps and notifies (if allowed) about something that happened;
 * with `sound` off, only the notification for a hidden tab.
 */
export const notify = (title: string, body?: string, sound = true) => {
    if (!alertsEnabled.get()) return;
    const now = Date.now();
    if (sound && now - lastSoundAt >= QUIET_MS) {
        lastSoundAt = now;
        try {
            navigator.vibrate?.([200, 100, 200]);
        } catch {
            // No vibration here.
        }
        beep();
    }
    void systemNotification(title, body);
};

// Push notifications ----------------------------------------------------

/** Games this phone asked to be notified about, even with the app closed. */
export const pushGames = persistentAtom<Record<string, true>>(
    "pushGames",
    {},
    { encode: JSON.stringify, decode: JSON.parse },
);

export const pushSupported = () =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined";

/** The server's key, as the browser wants it. */
const keyBytes = (base64Url: string) => {
    const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
};

/**
 * Subscribes this phone to the server's push notifications for a game (the
 * browser asks for permission the first time; call it from a tap).
 */
export const enablePush = async (
    gameId: string,
    token?: string,
): Promise<"on" | "unsupported" | "denied" | "unavailable"> => {
    if (!pushSupported()) return "unsupported";
    if ((await askNotifications()) !== "granted") return "denied";
    const { key } = await fetchPushKey();
    if (!key) return "unavailable";
    const registration = await navigator.serviceWorker.ready;
    const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(key),
        }));
    await postPushSubscription(gameId, subscription.toJSON(), token);
    pushGames.set({ ...pushGames.get(), [gameId]: true });
    return "on";
};

/** Stops the notifications for one game (other games keep theirs). */
export const disablePush = async (gameId: string, token?: string) => {
    const { [gameId]: removed, ...rest } = pushGames.get();
    void removed;
    pushGames.set(rest);
    if (!pushSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
        await deletePushSubscription(gameId, subscription.endpoint, token);
    }
};

/** Rejoining a game: the server gets this phone's subscription again. */
export const refreshPush = async (gameId: string, token?: string) => {
    if (!pushGames.get()[gameId] || !pushSupported()) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await postPushSubscription(gameId, subscription.toJSON(), token);
        }
    } catch {
        // No connection or no permission: the next join tries again.
    }
};
