import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const ID_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** 10 random characters: about 59 bits, plenty for a private site. */
const newId = () =>
    Array.from(randomBytes(10), (byte) => ID_ALPHABET[byte % 62]).join("");

export interface ShareStore {
    save(game: string, createdBy?: string | null): string;
    load(id: string): string | undefined;
}

/** Shared games in SQLite (`:memory:` for tests). */
export const createShareStore = (path: string): ShareStore => {
    const db = new DatabaseSync(path);
    db.exec(`
        CREATE TABLE IF NOT EXISTS shares (
            id TEXT PRIMARY KEY,
            game TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            created_by TEXT
        )
    `);
    const insert = db.prepare(
        "INSERT INTO shares (id, game, created_at, created_by) VALUES (?, ?, ?, ?)",
    );
    const select = db.prepare("SELECT game FROM shares WHERE id = ?");

    return {
        save(game, createdBy = null) {
            const id = newId();
            insert.run(id, game, Date.now(), createdBy);
            return id;
        },
        load(id) {
            const row = select.get(id) as { game: string } | undefined;
            return row?.game;
        },
    };
};
