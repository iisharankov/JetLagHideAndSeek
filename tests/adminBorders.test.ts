import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import {
    adminBorderRegion,
    adminLevelLabel,
    boundaryLines,
} from "@/maps/adminBorders";

describe("boundaryLines", () => {
    it("turns a zone made of several pieces into plain line features", () => {
        const zone = turf.multiPolygon([
            [
                [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0],
                ],
            ],
            [
                [
                    [2, 0],
                    [3, 0],
                    [3, 1],
                    [2, 1],
                    [2, 0],
                ],
            ],
        ]);

        const lines = boundaryLines(zone);

        expect(lines).toHaveLength(2);
        for (const line of lines) {
            expect(["LineString", "MultiLineString"]).toContain(
                line.geometry.type,
            );
        }
    });
});

describe("adminBorderRegion", () => {
    // Two "cantons" side by side at the equator (1° is about 111 km).
    const a = turf.polygon([
        [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
        ],
    ]);
    const b = turf.polygon([
        [
            [1, 0],
            [2, 0],
            [2, 1],
            [1, 1],
            [1, 0],
        ],
    ]);
    const borders = [...boundaryLines(a), ...boundaryLines(b)];
    // The seeker is in A, 0.2° (about 22 km) from the A-B border.
    const seeker = { lat: 0.5, lng: 0.8 };

    it("covers places near any border of the level, not just the seeker's zone", () => {
        const region = adminBorderRegion(
            borders,
            seeker,
            [-0.5, -0.5, 2.5, 1.5],
        );

        // In B, 0.1° from B's far border: closer to a border than the seeker.
        expect(turf.booleanPointInPolygon(turf.point([1.9, 0.5]), region)).toBe(
            true,
        );
        // In the middle of B, 0.5° from every border: further.
        expect(turf.booleanPointInPolygon(turf.point([1.5, 0.5]), region)).toBe(
            false,
        );
    });
});

describe("adminLevelLabel", () => {
    it("uses Swiss names in Switzerland", () => {
        expect(adminLevelLabel(4, "CH")).toBe("canton");
        expect(adminLevelLabel(6, "CH")).toBe("district");
        expect(adminLevelLabel(8, "CH")).toBe("municipality");
    });

    it("falls back to the OSM level elsewhere", () => {
        expect(adminLevelLabel(4, "US")).toBe("level-4 region");
        expect(adminLevelLabel(2, "US")).toBe("country");
    });
});
