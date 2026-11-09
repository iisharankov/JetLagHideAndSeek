// Passwords as the server keeps them: salted scrypt, compared in constant
// time. Team passwords and the hider password from before teams.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const hashPassword = (password: string, salt = randomBytes(16)) =>
    `${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;

export const passwordMatches = (password: string, stored: string) => {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, Buffer.from(salt, "hex"), 32);
    const expected = Buffer.from(hash, "hex");
    return (
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected)
    );
};
