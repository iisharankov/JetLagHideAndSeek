import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { createShareStore } from "./shareStore";

const port = Number(process.env.PORT ?? 8787);
const dataDir = process.env.DATA_DIR ?? "./data";

mkdirSync(dataDir, { recursive: true });
const app = createApp({
    shares: createShareStore(join(dataDir, "jetlag.db")),
});

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () =>
    console.log(`Jet Lag API listening on port ${port}`),
);
