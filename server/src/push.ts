// Push notifications: a phone that asked for them hears about the game
// even with the app closed. The server keeps each phone's subscription per
// game and role, signs its messages with its own VAPID keys (made on the
// first start, kept in the data folder), and sends what gameEvents() says
// that role must hear about. The browser's push service only ever sees
// the encrypted message.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import webPush, { type PushSubscription } from "web-push";

import { gameEvents } from "@/lib/game/events";
import type { GameState, Role } from "@/lib/game/types";

export interface PushKeys {
    publicKey: string;
    privateKey: string;
}

/** The server's key pair, made once and kept in `dataDir/vapid.json`. */
export const loadOrCreateKeys = (dataDir: string): PushKeys => {
    const file = join(dataDir, "vapid.json");
    if (existsSync(file)) {
        return JSON.parse(readFileSync(file, "utf8")) as PushKeys;
    }
    const keys = webPush.generateVAPIDKeys();
    writeFileSync(file, JSON.stringify(keys, null, 2), { mode: 0o600 });
    return keys;
};

export interface PushMessage {
    title: string;
    body?: string;
    /** Where a tap on the notification opens the app. */
    url: string;
    tag: string;
}

/** Sends one message; a failure's `statusCode` says whether the phone is gone. */
export type Sender = (
    subscription: PushSubscription,
    message: PushMessage,
) => Promise<void>;

export interface PushService {
    publicKey: string;
    subscribe(gameId: string, role: Role, subscription: PushSubscription): void;
    /** Only this game's subscription for the endpoint (another game keeps its own). */
    unsubscribe(gameId: string, endpoint: string): void;
    count(gameId: string): number;
    /** Tells the phones in the game what changed; forgets dead subscriptions. */
    notify(before: GameState, after: GameState): Promise<number>;
}

/** Shapes a browser's subscription, or null if it isn't one. */
export const parseSubscription = (raw: unknown): PushSubscription | null => {
    const value = raw as {
        endpoint?: unknown;
        keys?: { p256dh?: unknown; auth?: unknown };
    } | null;
    if (
        !value ||
        typeof value.endpoint !== "string" ||
        !value.endpoint.startsWith("https://") ||
        value.endpoint.length > 2000 ||
        typeof value.keys?.p256dh !== "string" ||
        typeof value.keys?.auth !== "string"
    ) {
        return null;
    }
    return {
        endpoint: value.endpoint,
        keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
    };
};

export const createPushService = (
    db: DatabaseSync,
    keys: PushKeys,
    {
        send,
        subject = "mailto:admin@example.org",
        appUrl,
    }: {
        send?: Sender;
        /** Who to contact about this server, as the push services want it. */
        subject?: string;
        appUrl: (gameId: string) => string;
    },
): PushService => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            game_id TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            role TEXT NOT NULL,
            subscription TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (game_id, endpoint)
        )
    `);
    const upsert = db.prepare(
        `INSERT INTO push_subscriptions (game_id, endpoint, role, subscription, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(game_id, endpoint) DO UPDATE SET role = excluded.role,
             subscription = excluded.subscription`,
    );
    const remove = db.prepare(
        "DELETE FROM push_subscriptions WHERE game_id = ? AND endpoint = ?",
    );
    const removeEverywhere = db.prepare(
        "DELETE FROM push_subscriptions WHERE endpoint = ?",
    );
    const list = db.prepare(
        "SELECT role, subscription FROM push_subscriptions WHERE game_id = ?",
    );
    const countFor = db.prepare(
        "SELECT COUNT(*) AS n FROM push_subscriptions WHERE game_id = ?",
    );

    const sender: Sender =
        send ??
        (async (subscription, message) => {
            await webPush.sendNotification(
                subscription,
                JSON.stringify(message),
                {
                    TTL: 600,
                    urgency: "high",
                    vapidDetails: {
                        subject,
                        publicKey: keys.publicKey,
                        privateKey: keys.privateKey,
                    },
                },
            );
        });

    return {
        publicKey: keys.publicKey,

        subscribe(gameId, role, subscription) {
            upsert.run(
                gameId,
                subscription.endpoint,
                role,
                JSON.stringify(subscription),
                Date.now(),
            );
        },

        unsubscribe(gameId, endpoint) {
            remove.run(gameId, endpoint);
        },

        count(gameId) {
            return Number((countFor.get(gameId) as { n: number }).n);
        },

        async notify(before, after) {
            const rows = list.all(after.id) as {
                role: Role;
                subscription: string;
            }[];
            if (rows.length === 0) return 0;
            const byRole = new Map<Role, ReturnType<typeof gameEvents>>();
            let sent = 0;
            for (const row of rows) {
                if (!byRole.has(row.role)) {
                    byRole.set(row.role, gameEvents(before, after, row.role));
                }
                const events = byRole.get(row.role)!;
                if (events.length === 0) continue;
                const message: PushMessage =
                    events.length === 1
                        ? {
                              title: events[0].title,
                              body: events[0].body,
                              url: appUrl(after.id),
                              tag: `jetlag-${after.id}`,
                          }
                        : {
                              title: `${events.length} things happened in the game`,
                              body: events
                                  .map((event) => event.title)
                                  .join(" · "),
                              url: appUrl(after.id),
                              tag: `jetlag-${after.id}`,
                          };
                const subscription = JSON.parse(
                    row.subscription,
                ) as PushSubscription;
                try {
                    await sender(subscription, message);
                    sent += 1;
                } catch (error) {
                    const status = (error as { statusCode?: number })
                        .statusCode;
                    // Gone or expired: the phone unsubscribed or was wiped.
                    if (status === 404 || status === 410) {
                        removeEverywhere.run(subscription.endpoint);
                    } else {
                        console.warn(
                            `Push to ${subscription.endpoint.slice(0, 40)}… failed: ${
                                (error as Error).message ?? error
                            }`,
                        );
                    }
                }
            }
            return sent;
        },
    };
};
