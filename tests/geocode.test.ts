import { afterEach, describe, expect, it, vi } from "vitest";

import { geocode } from "@/maps/api/geocode";

const photonResult = {
    features: [
        {
            type: "Feature",
            geometry: { type: "Point", coordinates: [8.5403, 47.3779] },
            properties: {
                osm_type: "N",
                osm_id: 1,
                name: "Zürich HB",
                extent: [8.53, 47.38, 8.55, 47.37],
            },
        },
    ],
};

afterEach(() => vi.unstubAllGlobals());

describe("geocode", () => {
    it("encodes the search text", async () => {
        const fetch = vi.fn(async () => Response.json(photonResult));
        vi.stubGlobal("fetch", fetch);

        await geocode("Bahnhof & Co #1", "en", false);

        const url = new URL(
            (fetch.mock.calls[0] as unknown as [string])[0],
            "http://localhost",
        );
        expect(url.searchParams.get("q")).toBe("Bahnhof & Co #1");
        expect(url.searchParams.get("lang")).toBe("en");
    });

    it("returns places with [lat, lng] coordinates", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json(photonResult)),
        );

        const [place] = await geocode("Zürich HB", "en", false);
        expect(place.geometry.coordinates).toEqual([47.3779, 8.5403]);
    });

    it("reports a failing search server instead of 'no results'", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("down", { status: 502 })),
        );

        await expect(geocode("Zürich", "en")).rejects.toThrow(/502/);
    });
});
