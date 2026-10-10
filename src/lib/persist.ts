// Saved settings, one tab at a time. @nanostores/persistent also syncs atoms
// between tabs through storage events, and that bit us: another tab's write
// resets every atom this tab never saved (to undefined, so a name came back
// as "undefined.trim()"), and it handed the hider's token to a seeker's tab.
// So: no cross-tab listening. A tab reads storage when it loads.
import {
    persistentAtom as syncedPersistentAtom,
    type PersistentEncoder,
    type PersistentOptions,
} from "@nanostores/persistent";

interface Options<Value> {
    encode?: (value: Value) => string;
    decode?: (encoded: string) => Value;
}

export const persistentAtom = <Value>(
    name: string,
    initial: Value,
    opts: Options<Value> = {},
) =>
    syncedPersistentAtom<Value>(name, initial, {
        ...opts,
        listen: false,
    } as PersistentOptions & PersistentEncoder<Value>);
