// Who may make games (the owner's Q49 and Q56 answers): the admin code from
// the server's .env, and creator codes the admin hands out to friends and
// revokes. Each starts a few games a day; everyone else joins by link.
import {
    createHash,
    randomBytes,
    randomInt,
    timingSafeEqual,
} from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { CODE_ALPHABET } from "@/lib/game/players";

/** Games a day per creator code (the owner's "5 games/day"). */
export const CREATOR_GAMES_PER_DAY = 5;
/** Games a day with the admin code. */
export const ADMIN_GAMES_PER_DAY = 20;
/** Twelve letters from 32: about 60 bits, not guessable at 5 tries a minute. */
const CODE_LENGTH = 12;

const sha256 = (text: string) =>
    createHash("sha256").update(text).digest("hex");

/** A code as typed ("abcd efgh-jklm") → "ABCDEFGHJKLM". */
const normalize = (typed: string) => typed.toUpperCase().replace(/[\s-]/g, "");

/** "ABCDEFGHJKLM" → "ABCD-EFGH-JKLM", easier to read out. */
export const formatCreatorCode = (code: string) =>
    (code.match(/.{1,4}/g) ?? []).join("-");

/** The same secret, compared in constant time (for the admin code). */
export const sameSecret = (typed: string, secret: string) =>
    timingSafeEqual(
        Buffer.from(sha256(typed), "hex"),
        Buffer.from(sha256(secret), "hex"),
    );

/** The day in Zürich ("2026-11-09"), for "five games a day". */
export const zurichDay = (at: number) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(at);

export interface CreatorCode {
    id: string;
    name: string;
    createdAt: number;
    revokedAt: number | null;
    gamesToday: number;
}

export type CodeStore = ReturnType<typeof createCodeStore>;

/**
 * Creator codes in SQLite, by a hash of the code (they are random, so a
 * plain hash is enough and allows a lookup); the plain code is shown once,
 * when it's made. Games made per code (or "admin") per day.
 */
export const createCodeStore = (db: DatabaseSync) => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS creator_codes (
            id TEXT PRIMARY KEY,
            code_hash TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            revoked_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS games_made (
            who TEXT NOT NULL,
            day TEXT NOT NULL,
            count INTEGER NOT NULL,
            PRIMARY KEY (who, day)
        )
    `);
    const insert = db.prepare(
        "INSERT INTO creator_codes (id, code_hash, name, created_at) VALUES (?, ?, ?, ?)",
    );
    const byHash = db.prepare(
        "SELECT id, name, revoked_at FROM creator_codes WHERE code_hash = ?",
    );
    const all = db.prepare(
        `SELECT c.id, c.name, c.created_at, c.revoked_at, COALESCE(m.count, 0) AS today
         FROM creator_codes c LEFT JOIN games_made m ON m.who = c.id AND m.day = ?
         ORDER BY c.created_at DESC`,
    );
    const revoke = db.prepare(
        "UPDATE creator_codes SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
    );
    const made = db.prepare(
        "SELECT count FROM games_made WHERE who = ? AND day = ?",
    );
    const count = db.prepare(
        `INSERT INTO games_made (who, day, count) VALUES (?, ?, 1)
         ON CONFLICT(who, day) DO UPDATE SET count = count + 1`,
    );
    const forget = db.prepare("DELETE FROM games_made WHERE day < ?");

    return {
        /** A new code, named for whom it's for; the plain code only here. */
        create(name: string, now = Date.now()) {
            const code = Array.from(
                { length: CODE_LENGTH },
                () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
            ).join("");
            const id = randomBytes(6).toString("base64url");
            insert.run(id, sha256(code), name, now);
            return { id, code: formatCreatorCode(code), name, createdAt: now };
        },
        list(now = Date.now()): CreatorCode[] {
            const rows = all.all(zurichDay(now)) as {
                id: string;
                name: string;
                created_at: number;
                revoked_at: number | null;
                today: number;
            }[];
            return rows.map((row) => ({
                id: row.id,
                name: row.name,
                createdAt: row.created_at,
                revokedAt: row.revoked_at,
                gamesToday: row.today,
            }));
        },
        /** Stops a code making games; the games it made stay. */
        revoke(id: string, now = Date.now()) {
            return Number(revoke.run(now, id).changes) > 0;
        },
        find(typed: string) {
            const row = byHash.get(sha256(normalize(typed))) as
                | { id: string; name: string; revoked_at: number | null }
                | undefined;
            return row
                ? { id: row.id, name: row.name, revokedAt: row.revoked_at }
                : undefined;
        },
        gamesToday(who: string, now = Date.now()) {
            const row = made.get(who, zurichDay(now)) as
                | { count: number }
                | undefined;
            return row?.count ?? 0;
        },
        countGame(who: string, now = Date.now()) {
            const day = zurichDay(now);
            count.run(who, day);
            forget.run(zurichDay(now - 7 * 24 * 3600_000));
        },
    };
};
