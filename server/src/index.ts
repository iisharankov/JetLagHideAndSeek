import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { createGameStore } from "./games";
import { createShareStore } from "./shareStore";

const port = Number(process.env.PORT ?? 8787);
const dataDir = process.env.DATA_DIR ?? "./data";

let db: DatabaseSync;
try {
    mkdirSync(dataDir, { recursive: true });
    db = new DatabaseSync(join(dataDir, "jetlag.db"));
} catch (error) {
    console.error(
        `Can't open the database in ${dataDir}: ${error}\n` +
            `Is that folder writable by this user (uid ${process.getuid?.()})?`,
    );
    process.exit(1);
}

const games = createGameStore(db, join(dataDir, "photos"));
const app = createApp({ shares: createShareStore(db), games });

// Games untouched for a year are deleted, photos included.
const cleanup = () => {
    const removed = games.cleanup();
    if (removed > 0) console.log(`Deleted ${removed} old game(s).`);
};
cleanup();
setInterval(cleanup, 24 * 3600 * 1000).unref();

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () =>
    console.log(`Jet Lag API listening on port ${port}, data in ${dataDir}`),
);
