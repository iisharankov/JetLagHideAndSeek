import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "./app";
import { createShareStore } from "./shareStore";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
    app = createApp({ shares: createShareStore(":memory:") });
});

const share = (body: string) =>
    app.request("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });

describe("share links", () => {
    it("stores a game and hands it back by id", async () => {
        const game = JSON.stringify({
            type: "FeatureCollection",
            features: [],
        });

        const created = await share(game);
        expect(created.status).toBe(201);
        const { id } = await created.json();
        expect(id).toMatch(/^[A-Za-z0-9]{10}$/);

        const fetched = await app.request(`/api/share/${id}`);
        expect(fetched.status).toBe(200);
        expect(fetched.headers.get("content-type")).toContain(
            "application/json",
        );
        expect(await fetched.text()).toBe(game);
    });

    it("gives every game its own id", async () => {
        const a = await (await share("{}")).json();
        const b = await (await share("{}")).json();
        expect(a.id).not.toBe(b.id);
    });

    it("rejects anything that isn't a JSON object", async () => {
        expect((await share("not json")).status).toBe(400);
        expect((await share("[1,2]")).status).toBe(400);
        expect((await share("42")).status).toBe(400);
    });

    it("rejects games over 2 MB", async () => {
        const huge = JSON.stringify({ padding: "x".repeat(2 * 1024 * 1024) });
        expect((await share(huge)).status).toBe(413);
    });

    it("answers 404 for unknown ids", async () => {
        expect((await app.request("/api/share/doesNotExist")).status).toBe(404);
    });
});

describe("health", () => {
    it("reports ok", async () => {
        const response = await app.request("/api/health");
        expect(await response.json()).toEqual({ ok: true });
    });
});
