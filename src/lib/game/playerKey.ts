// This phone's private key in shared games: a random id made once and kept,
// sent with every request (X-Player-Key). The server knows the player by a
// public id made from it; the key itself never leaves this phone otherwise.
// One per browser: two tabs are the same player.
import { persistentAtom } from "@/lib/persist";

const stored = persistentAtom<string>("playerKey", "");
// Read once per tab, like the hider's token: an unused store re-reads
// storage on every get.
stored.listen(() => {});

const newKey = () => {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
};

/** This phone's key, made on first use. */
export const playerKey = () => {
    let key = stored.get();
    if (!key) {
        key = newKey();
        stored.set(key);
    }
    return key;
};
