import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultGameSettings } from "@/lib/game/settings";
import type { GameState } from "@/lib/game/types";

import { applyOp, newGameState } from "./gameOps";
import {
    createPushService,
    loadOrCreateKeys,
    parseSubscription,
    type PushMessage,
} from "./push";

const subscription = (n: number) => ({
    endpoint: `https://push.example/${n}`,
    keys: { p256dh: "p", auth: "a" },
});

let dir: string;
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "jetlag-push-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const fresh = () =>
    newGameState(
        "g1",
        { playArea: {}, zone: {}, settings: defaultGameSettings() },
        1000,
    );

describe("push keys", () => {
    it("are made once and read back from the data folder", () => {
        const first = loadOrCreateKeys(dir);
        expect(first.publicKey.length).toBeGreaterThan(40);
        expect(readFileSync(join(dir, "vapid.json"), "utf8")).toContain(
            first.publicKey,
        );
        expect(loadOrCreateKeys(dir)).toEqual(first);
    });
});

describe("push service", () => {
    const service = () => {
        const sent: { to: string; message: PushMessage }[] = [];
        const dead = new Set<string>();
        const push = createPushService(
            new DatabaseSync(":memory:"),
            { publicKey: "pub", privateKey: "priv" },
            {
                appUrl: (id) => `/?game=${id}`,
                send: async (to, message) => {
                    if (dead.has(to.endpoint)) {
                        throw Object.assign(new Error("gone"), {
                            statusCode: 410,
                        });
                    }
                    sent.push({ to: to.endpoint, message });
                },
            },
        );
        return { push, sent, dead };
    };

    it("tells each phone what its role must hear about", async () => {
        const { push, sent } = service();
        push.subscribe("g1", "hider", subscription(1));
        push.subscribe("g1", "seeker", subscription(2));
        expect(push.count("g1")).toBe(2);

        const before = fresh();
        const asked = applyOp(
            before,
            {
                type: "putQuestion",
                question: {
                    id: "radius",
                    key: 1,
                    data: { radius: 5, unit: "kilometers" },
                },
                state: "asked",
            },
            { name: "Ana", role: "seeker" },
            2000,
        );
        expect(await push.notify(before, asked)).toBe(1);
        expect(sent).toEqual([
            {
                to: "https://push.example/1",
                message: {
                    title: "New question",
                    body: "Radar 5 km, from Ana",
                    url: "/?game=g1",
                    tag: "jetlag-g1",
                },
            },
        ]);
    });

    it("bundles several events into one message", async () => {
        const { push, sent } = service();
        push.subscribe("g1", "seeker", subscription(1));
        const before = fresh();
        let after = applyOp(
            before,
            { type: "castCurse", name: "Curse of the Cairn" },
            { name: "Ben", role: "hider" },
            2000,
        );
        after = applyOp(
            after,
            { type: "castCurse", name: "Curse of the Zoologist" },
            { name: "Ben", role: "hider" },
            2001,
        );
        await push.notify(before, after);
        expect(sent[0].message.title).toBe("2 things happened in the game");
        expect(sent[0].message.body).toContain("Cairn");
    });

    it("forgets a phone the push service says is gone, and only that one", async () => {
        const { push, sent, dead } = service();
        push.subscribe("g1", "seeker", subscription(1));
        push.subscribe("g1", "seeker", subscription(2));
        push.subscribe("g2", "seeker", subscription(1));
        dead.add("https://push.example/1");
        const before = fresh();
        const after = applyOp(
            before,
            { type: "castCurse", name: "Curse of the Cairn" },
            { name: "Ben", role: "hider" },
            2000,
        );
        expect(await push.notify(before, after)).toBe(1);
        expect(sent.map((s) => s.to)).toEqual(["https://push.example/2"]);
        expect(push.count("g1")).toBe(1);
        expect(push.count("g2")).toBe(0);
    });

    it("unsubscribes one game without touching the others", () => {
        const { push } = service();
        push.subscribe("g1", "seeker", subscription(1));
        push.subscribe("g2", "seeker", subscription(1));
        push.unsubscribe("g1", "https://push.example/1");
        expect(push.count("g1")).toBe(0);
        expect(push.count("g2")).toBe(1);
    });

    it("sends nothing when nothing happened for that role", async () => {
        const { push, sent } = service();
        push.subscribe("g1", "hider", subscription(1));
        const before = fresh();
        const after = applyOp(
            before,
            { type: "castCurse", name: "Curse of the Cairn" },
            { name: "Ben", role: "hider" },
            2000,
        );
        expect(await push.notify(before, after)).toBe(0);
        expect(sent).toEqual([]);
    });
});

describe("parseSubscription", () => {
    it("accepts a browser's subscription and nothing else", () => {
        expect(parseSubscription(subscription(1))).toEqual(subscription(1));
        expect(
            parseSubscription({
                endpoint: "http://x",
                keys: { p256dh: "p", auth: "a" },
            }),
        ).toBeNull();
        expect(parseSubscription({ endpoint: "https://x" })).toBeNull();
        expect(parseSubscription(null)).toBeNull();
        expect(parseSubscription("nope" as unknown as GameState)).toBeNull();
    });
});
