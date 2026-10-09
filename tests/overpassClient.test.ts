import { describe, expect, it, vi } from "vitest";

import {
    createOverpassClient,
    memoryCache,
    OverpassError,
} from "@/maps/api/overpassClient";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

const OK = { elements: [{ type: "node", id: 1 }] };

describe("createOverpassClient", () => {
    it("POSTs the query to the first endpoint", async () => {
        const fetch = vi.fn(async () => json(OK));
        const query = createOverpassClient({
            endpoints: () => ["https://own/api/interpreter"],
            fetch,
        });

        await expect(query("node(1);out;")).resolves.toEqual(OK);

        const [url, init] = fetch.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ];
        expect(url).toBe("https://own/api/interpreter");
        expect(init.method).toBe("POST");
        expect(String(init.body)).toBe("data=node%281%29%3Bout%3B");
    });

    it("falls back to the next endpoint on an HTTP error", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(new Response("busy", { status: 504 }))
            .mockResolvedValueOnce(json(OK));
        const query = createOverpassClient({
            endpoints: () => ["https://a/i", "https://b/i"],
            fetch,
        });

        await expect(query("q")).resolves.toEqual(OK);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("falls back when a request throws (network or CORS error)", async () => {
        const fetch = vi
            .fn()
            .mockRejectedValueOnce(new TypeError("NetworkError"))
            .mockResolvedValueOnce(json(OK));
        const query = createOverpassClient({
            endpoints: () => ["https://a/i", "https://b/i"],
            fetch,
        });

        await expect(query("q")).resolves.toEqual(OK);
    });

    it("treats a 200 response with a runtime-error remark as a failure and never caches it", async () => {
        const cache = memoryCache();
        const timedOut = {
            elements: [],
            remark: 'runtime error: Query timed out in "query" at line 3 after 26 seconds.',
        };
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(json(timedOut))
            .mockResolvedValueOnce(json(OK));
        const query = createOverpassClient({
            endpoints: () => ["https://a/i", "https://b/i"],
            fetch,
            cache,
        });

        await expect(query("q")).resolves.toEqual(OK);
        await expect(cache.get("q")).resolves.toEqual(OK);
    });

    it("serves repeated queries from the cache", async () => {
        const fetch = vi.fn(async () => json(OK));
        const query = createOverpassClient({
            endpoints: () => ["https://a/i"],
            fetch,
            cache: memoryCache(),
        });

        await query("q");
        await query("q");
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("shares one request between identical queries in flight", async () => {
        let resolve!: (r: Response) => void;
        const fetch = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
        const query = createOverpassClient({
            endpoints: () => ["https://a/i"],
            fetch,
        });

        const first = query("q");
        const second = query("q");
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        resolve(json(OK));

        await expect(first).resolves.toEqual(OK);
        await expect(second).resolves.toEqual(OK);
    });

    it("throws an OverpassError naming every failed attempt", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(new Response("", { status: 504 }))
            .mockRejectedValueOnce(new TypeError("NetworkError"));
        const query = createOverpassClient({
            endpoints: () => ["https://a/i", "https://b/i"],
            fetch,
        });

        const error = await query("q").catch((e) => e);
        expect(error).toBeInstanceOf(OverpassError);
        expect(error.attempts).toEqual(["a: HTTP 504", "b: NetworkError"]);
    });

    it("gives up on an endpoint that doesn't answer in time", async () => {
        const fetch = vi.fn(
            (_url: string, init: RequestInit) =>
                new Promise<Response>((_, reject) =>
                    init.signal!.addEventListener("abort", () =>
                        reject(new DOMException("aborted", "AbortError")),
                    ),
                ),
        );
        const query = createOverpassClient({
            endpoints: () => ["https://slow/i"],
            fetch: fetch as unknown as typeof globalThis.fetch,
            timeoutMs: 10,
        });

        const error = await query("q").catch((e) => e);
        expect(error.attempts).toEqual(["slow: timed out"]);
    });
});
