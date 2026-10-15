/** Raised when no configured Overpass server could answer a query. */
export class OverpassError extends Error {
    constructor(
        message: string,
        /** One entry per server tried, e.g. "overpass-api.de: HTTP 504". */
        readonly attempts: string[],
    ) {
        super(message);
        this.name = "OverpassError";
    }
}

export interface ResponseCache {
    get(query: string): Promise<unknown | undefined>;
    put(query: string, data: unknown): Promise<void>;
}

export interface OverpassClientOptions {
    /** Servers to try, in order. Read on every query so settings apply live. */
    endpoints: () => string[];
    cache?: ResponseCache;
    fetch?: typeof fetch;
    timeoutMs?: number;
}

/**
 * Overpass reports timeouts and memory exhaustion as HTTP 200 with a
 * `remark`, often alongside an empty or partial `elements` list. That must
 * count as a failure, never as "nothing found".
 */
export const overpassFailureRemark = (data: unknown): string | null => {
    const remark = (data as { remark?: unknown } | null)?.remark;
    return typeof remark === "string" &&
        /runtime error|timed out|out of memory/i.test(remark)
        ? remark
        : null;
};

const hostOf = (endpoint: string) => {
    try {
        return new URL(endpoint).host;
    } catch {
        return endpoint;
    }
};

export const createOverpassClient = ({
    endpoints,
    cache,
    fetch: fetchImpl = (...args) => fetch(...args),
    timeoutMs = 120_000,
}: OverpassClientOptions) => {
    const inFlight = new Map<string, Promise<any>>();

    const run = async (query: string, cacheOverride?: ResponseCache) => {
        const store = cacheOverride ?? cache;
        const cached = await store?.get(query);
        if (cached !== undefined) return cached;

        const attempts: string[] = [];
        for (const endpoint of endpoints()) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetchImpl(endpoint, {
                    method: "POST",
                    body: new URLSearchParams({ data: query }),
                    signal: controller.signal,
                });
                if (!response.ok) {
                    attempts.push(
                        `${hostOf(endpoint)}: HTTP ${response.status}`,
                    );
                    continue;
                }
                const data = await response.json();
                const remark = overpassFailureRemark(data);
                if (remark) {
                    attempts.push(`${hostOf(endpoint)}: ${remark}`);
                    continue;
                }
                await store?.put(query, data);
                return data;
            } catch (error) {
                attempts.push(
                    `${hostOf(endpoint)}: ${
                        controller.signal.aborted
                            ? "timed out"
                            : (error as Error).message
                    }`,
                );
            } finally {
                clearTimeout(timer);
            }
        }

        // The usual reason: a play area outside the map data on the server.
        throw new OverpassError(
            attempts.length > 0
                ? `No map data for this area on the server: pick a play area inside the downloaded map data (${attempts.join("; ")})`
                : "No map server configured: pick a play area inside the downloaded map data",
            attempts,
        );
    };

    return (query: string, options: { cache?: ResponseCache } = {}) => {
        let pending = inFlight.get(query);
        if (!pending) {
            pending = run(query, options.cache).finally(() =>
                inFlight.delete(query),
            );
            inFlight.set(query, pending);
        }
        return pending;
    };
};

/** In-memory cache, for tests and for environments without Cache Storage. */
export const memoryCache = (): ResponseCache => {
    const entries = new Map<string, unknown>();
    return {
        get: async (query) => entries.get(query),
        put: async (query, data) => {
            entries.set(query, data);
        },
    };
};

/** Persistent cache backed by the browser's Cache Storage. */
export const cacheStorageCache = (cacheName: string): ResponseCache => {
    const keyFor = async (query: string) => {
        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(query),
        );
        const hex = Array.from(new Uint8Array(digest), (b) =>
            b.toString(16).padStart(2, "0"),
        ).join("");
        return `https://overpass.cache/${hex}`;
    };
    const open = () =>
        typeof caches === "undefined" ? null : caches.open(cacheName);

    return {
        get: async (query) => {
            const cache = await open();
            const hit = await cache?.match(await keyFor(query));
            return hit ? hit.json() : undefined;
        },
        put: async (query, data) => {
            const cache = await open();
            await cache?.put(
                await keyFor(query),
                new Response(JSON.stringify(data), {
                    headers: { "Content-Type": "application/json" },
                }),
            );
        },
    };
};
