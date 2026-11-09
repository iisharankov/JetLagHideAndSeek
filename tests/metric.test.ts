import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { RADAR_KM, THERMOMETER_KM } from "@/lib/game/settings";
import { TYPES } from "@/lib/questionInfo";
import { decodeStoredQuestions } from "@/lib/storage";
import { questionSchema } from "@/maps/schema";

// Metric only (decided 2026-11-09, history/plans/nov-game-fixes/03): the rules
// pages say the distances the game is played with, and nothing in the app
// offers miles or feet.

const RULES = fileURLToPath(new URL("../src/content/rules/", import.meta.url));

const pages = (dir: string): { path: string; text: string }[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return pages(path);
        return entry.name.endsWith(".md")
            ? [{ path, text: readFileSync(path, "utf8") }]
            : [];
    });

const page = (name: string) =>
    readFileSync(join(RULES, "seeking", `${name}.md`), "utf8");

/** "500 m", "2 km": as the pages and the chips write a distance. */
const distance = (km: number) => (km < 1 ? `${km * 1000} m` : `${km} km`);

/** The page's list items ("- 5 km"), in order. */
const items = (markdown: string) =>
    [...markdown.matchAll(/^- (.+)$/gm)].map((m) => m[1].trim());

describe("the rules pages, in metric", () => {
    it("never say miles or feet (only the card Curse of the Gambler's Feet keeps its name, and walking is still on feet)", () => {
        const all = pages(RULES);
        expect(all.length).toBeGreaterThan(20);
        for (const { path, text } of all) {
            const rest = text
                .replace(/Gambler['’]s Feet/g, "")
                .replace(/with cars and feet/g, "");
            expect(rest, path).not.toMatch(/\b(miles?|feet|ft|sq\.? ?mi)\b/i);
        }
    });

    it("list the radar's distances as the game offers them", () => {
        const radar = items(page("radar-questions"));
        expect(radar.slice(0, RADAR_KM.length)).toEqual(RADAR_KM.map(distance));
    });

    it("list the thermometer's distances as the game offers them (75 km for large games)", () => {
        expect(items(page("thermometer-questions"))).toEqual(
            THERMOMETER_KM.map(distance),
        );
    });

    it("name the tentacle questions by their metric distance, as the app points at them", () => {
        const headings = [
            ...page("tentacle-questions").matchAll(/^#### (.+)$/gm),
        ].map((m) => m[1]);
        expect(headings).toEqual([
            "Museums within 2 km",
            "Libraries within 2 km",
            "Movie Theaters within 2 km",
            "Hospitals within 2 km",
            "Metro Lines within 25 km",
            "Zoos within 25 km",
            "Aquariums within 25 km",
            "Amusement Parks within 25 km",
        ]);
        for (const type of Object.values(TYPES.tentacles)) {
            if (type.rules?.heading) {
                expect(headings).toContain(type.rules.heading);
            }
        }
    });
});

describe("questions, in metric", () => {
    it("don't take miles", () => {
        const radar = {
            id: "radius",
            key: 1,
            data: { lat: 47.37, lng: 8.54, radius: 5, unit: "miles" },
        };
        expect(questionSchema.safeParse(radar).success).toBe(false);
        expect(
            questionSchema.safeParse({
                ...radar,
                data: { ...radar.data, unit: "kilometers" },
            }).success,
        ).toBe(true);
    });

    it("saved in miles before, load in km", () => {
        const [radar, tentacles] = decodeStoredQuestions(
            JSON.stringify([
                {
                    id: "radius",
                    key: 1,
                    data: { lat: 47.37, lng: 8.54, radius: 5, unit: "miles" },
                },
                {
                    id: "tentacles",
                    key: 2,
                    data: {
                        lat: 47.37,
                        lng: 8.54,
                        radius: 1,
                        unit: "miles",
                        locationType: "museum",
                    },
                },
            ]),
            () => {
                throw new Error("nothing should be set aside");
            },
        );
        expect(radar.data).toMatchObject({ radius: 8.047, unit: "kilometers" });
        expect(tentacles.data).toMatchObject({
            radius: 1.609,
            unit: "kilometers",
        });
    });
});
