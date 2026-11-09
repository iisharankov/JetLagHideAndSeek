// The code that lets this phone start shared games (the owner's Q49 and
// Q56 answers): a creator code from the admin, or the admin code itself,
// which also opens Menu → Admin. Typed once, kept on this phone.
import { persistentAtom } from "@/lib/persist";

import { checkCode } from "./api";

export interface MyCode {
    code: string;
    kind: "admin" | "creator";
    /** The creator code's name ("Ana's code"), or "Admin". */
    name: string;
}

export const myCode = persistentAtom<MyCode | null>("gameCode", null, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
// Read once per tab, like the player key.
myCode.listen(() => {});

/** Checks a typed code with the server and keeps it; throws with the reason. */
export const enterCode = async (typed: string) => {
    const code = typed.trim();
    const { kind, name } = await checkCode(code);
    myCode.set({ code, kind, name });
    return { kind, name };
};

export const forgetCode = () => myCode.set(null);
