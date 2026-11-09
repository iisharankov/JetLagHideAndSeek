import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it } from "vitest";

import { coachMark } from "@/lib/coachMark";
import type { GameEvent } from "@/lib/game/events";
import {
    hidingRadiusDefaultKm,
    RADAR_KM,
    radarDefaultKm,
} from "@/lib/game/settings";
import {
    backStep,
    endTour,
    nextStep,
    offerTour,
    showTip,
    showTutorial,
    skipMissingStep,
    startTour,
    tour,
    tutorialsSeen,
} from "@/lib/tour";
import {
    DEMO_RADAR_KM,
    DEMO_ZONE_KM,
    DEMOS,
    demoScene,
    STATIONS,
} from "@/lib/tourDemo";
import { OFFERS, tipForEvent, TIPS, TOURS } from "@/lib/tourSteps";

/** Words a reader reads: "→" and "**" don't count. */
const words = (text: string) =>
    text
        .replace(/\*\*/g, "")
        .split(/\s+/)
        .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

/** Every text, with the most words it may have (a tour step explains; a tip or an offer is a glance). */
const everyText = () => [
    ...Object.entries(TOURS).flatMap(([tourId, steps]) =>
        steps.map((step) => ({
            where: `${tourId}/${step.id}`,
            most: 45,
            ...step,
        })),
    ),
    ...Object.entries(TIPS).map(([id, tip]) => ({
        where: `tip/${id}`,
        most: 25,
        ...tip,
    })),
    ...Object.entries(OFFERS).map(([id, offer]) => ({
        where: `offer/${id}`,
        most: 25,
        ...offer,
    })),
];

describe("the tutorial's text", () => {
    it("keeps every title to 5 words, a step to 45 and a tip to 25", () => {
        for (const { where, title, text, most } of everyText()) {
            expect(words(title), `${where}: "${title}"`).toBeLessThanOrEqual(5);
            expect(words(text), `${where}: "${text}"`).toBeLessThanOrEqual(
                most,
            );
        }
    });

    it("has no paragraphs or lists, and balanced bold", () => {
        for (const { where, text } of everyText()) {
            expect(text, where).not.toMatch(/\n/);
            expect(text.split("**").length % 2, where).toBe(1);
        }
    });

    it("names each step once per tour", () => {
        for (const [id, steps] of Object.entries(TOURS)) {
            const ids = steps.map((step) => step.id);
            expect(new Set(ids).size, id).toBe(ids.length);
        }
    });

    it("teaches the game before the app, station first and then the pin", () => {
        for (const id of ["seeker", "hider"] as const) {
            const ids = TOURS[id].map((step) => step.id);
            expect(ids[0]).toBe("how-to-play");
            const station = ids.indexOf("station-decides");
            const endgame = ids.indexOf("endgame");
            const pin = ids.indexOf("pin");
            expect(station).toBeGreaterThan(0);
            expect(endgame).toBeGreaterThan(station);
            expect(pin).toBeGreaterThan(endgame);
            // The app's own steps come after the game's.
            expect(ids.indexOf("menu")).toBe(ids.length - 1);
        }
    });

    it("gives the hider a tour of their own", () => {
        const seeker = new Set(TOURS.seeker.map((step) => step.text));
        const shared = TOURS.hider.filter((step) => seeker.has(step.text));
        // Only the Menu step is the same.
        expect(shared.map((step) => step.id)).toEqual(["menu"]);
        const ids = TOURS.hider.map((step) => step.id);
        expect(ids).toContain("start-endgame");
        expect(ids).not.toContain("radar");
        expect(TOURS.hider.find((step) => step.id === "zone")?.demo).toBe(
            "hider-zone",
        );
    });

    it("sets the scene: a medium game in Zürich, the seekers at Zürich HB", () => {
        expect(TOURS.seeker[1].text).toMatch(/medium game in Zürich canton/);
        expect(TOURS.seeker[1].text).toMatch(/start at Zürich HB/);
    });

    it("only shows examples that exist", () => {
        for (const steps of Object.values(TOURS)) {
            for (const step of steps) {
                if (step.demo) expect(DEMOS).toContain(step.demo);
            }
        }
    });
});

describe("what the tutorial opens", () => {
    const everyStep = () =>
        Object.entries(TOURS).flatMap(([tourId, steps]) =>
            steps.map((step) => ({ where: `${tourId}/${step.id}`, step })),
        );

    it("opens the Menu or the setup to show what's in them, not just their button", () => {
        for (const { where, step } of everyStep()) {
            // The closed Menu's button shows nothing of what's inside.
            expect(step.target ?? [], where).not.toContain(
                '[data-tutorial-id="menu-button"]',
            );
            if (step.menu || step.setup !== undefined) {
                expect(step.target?.length, where).toBeGreaterThan(0);
            }
            // Whatever names the Menu opens it.
            if (/\*\*Menu\*\*|Menu →/.test(step.text)) {
                expect(step.menu, where).toBeDefined();
            }
        }
    });

    it("explains Ask a question in at most four notes, starting at the kinds, opening nothing", () => {
        expect(TOURS.ask.length).toBeLessThanOrEqual(4);
        expect(TOURS.ask[0].target).toEqual(['[data-tutorial-id="ask-kinds"]']);
        for (const step of TOURS.ask) {
            expect(step.sidebar, step.id).toBeUndefined();
            expect(step.menu, step.id).toBeUndefined();
            expect(step.screen, step.id).toBeUndefined();
        }
    });

    it("walks the organiser through the setup's three screens", () => {
        const screens = TOURS.organiser
            .map((step) => step.setup)
            .filter((screen) => screen !== undefined);
        expect(new Set(screens)).toEqual(new Set([0, 1, 2]));
        // In order: the setup isn't paged back and forth.
        expect(screens).toEqual([...screens].sort());
    });

    it("ends every tour in the Menu's help (not the ? on Ask a question)", () => {
        for (const id of ["seeker", "hider", "organiser"] as const) {
            const last = TOURS[id].at(-1)!;
            expect(last.menu).toBe("help");
            expect(last.target).toContain('[data-tutorial-id="menu-help"]');
        }
    });

    it("shows the seekers Follow me, and the hider the alerts, in Settings", () => {
        const settings = (id: "seeker" | "hider") =>
            TOURS[id].filter((step) => step.menu === "settings");
        expect(settings("seeker").map((step) => step.target)).toEqual([
            ['[data-tutorial-id="follow-me"]'],
        ]);
        expect(settings("hider").map((step) => step.target)).toEqual([
            ['[data-tutorial-id="alerts"]'],
        ]);
    });
});

describe("the examples in Zürich canton", () => {
    const point = (name: string) => {
        const station = STATIONS.find((s) => s.name === name)!;
        return turf.point([station.lng, station.lat]);
    };
    const km = (a: string, b: string) =>
        turf.distance(point(a), point(b), { units: "kilometers" });

    it("use a canton-sized (medium) game's own numbers", () => {
        expect(DEMO_RADAR_KM).toBe(radarDefaultKm("medium"));
        expect(RADAR_KM).toContain(DEMO_RADAR_KM);
        expect(DEMO_ZONE_KM).toBe(hidingRadiusDefaultKm("medium"));
    });

    it("stay inside the canton", () => {
        for (const station of STATIONS) {
            expect(station.lat, station.name).toBeGreaterThan(47.15);
            expect(station.lat, station.name).toBeLessThan(47.7);
            expect(station.lng, station.name).toBeGreaterThan(8.35);
            expect(station.lng, station.name).toBeLessThan(9.0);
        }
    });

    it("radar: the city's stations are inside 10 km of Zürich HB, the towns outside", () => {
        expect(km("Zürich HB", "Oerlikon")).toBeLessThan(DEMO_RADAR_KM);
        expect(km("Zürich HB", "Wipkingen")).toBeLessThan(DEMO_RADAR_KM);
        expect(km("Zürich HB", "Winterthur")).toBeGreaterThan(DEMO_RADAR_KM);
        expect(km("Zürich HB", "Uster")).toBeGreaterThan(DEMO_RADAR_KM);
        const radar = demoScene("radar");
        const open = radar.open!;
        expect(turf.booleanPointInPolygon(point("Oerlikon"), open)).toBe(true);
        expect(turf.booleanPointInPolygon(point("Winterthur"), open)).toBe(
            false,
        );
    });

    it("thermometer: colder from HB to Oerlikon keeps the half nearer HB", () => {
        const open = demoScene("thermometer").open!;
        expect(turf.booleanPointInPolygon(point("Zürich HB"), open)).toBe(true);
        expect(turf.booleanPointInPolygon(point("Oerlikon"), open)).toBe(false);
    });

    it("the station decides: Wipkingen is on the open side though its zone crosses the line", () => {
        // Nearer HB than Oerlikon: on the side the answer keeps…
        expect(km("Wipkingen", "Zürich HB")).toBeLessThan(
            km("Wipkingen", "Oerlikon"),
        );
        const open = demoScene("station").open!;
        expect(turf.booleanPointInPolygon(point("Wipkingen"), open)).toBe(true);
        // …while part of its circle lies in the shaded half.
        const zone = turf.circle(point("Wipkingen"), DEMO_ZONE_KM, {
            units: "kilometers",
        });
        expect(turf.booleanWithin(zone, open)).toBe(false);
        expect(demoScene("station").zones.some((z) => z.style === "kept")).toBe(
            true,
        );
    });

    it("the end game: only Wipkingen's zone is open, with the hider's pin inside", () => {
        const scene = demoScene("endgame");
        const pin = scene.points.find((p) => p.kind === "pin")!;
        expect(
            turf.booleanPointInPolygon(
                turf.point([pin.lng, pin.lat]),
                scene.open!,
            ),
        ).toBe(true);
        expect(
            turf.booleanPointInPolygon(point("Zürich HB"), scene.open!),
        ).toBe(false);
    });
});

describe("tours and tips", () => {
    beforeEach(() => {
        tour.set(null);
        coachMark.set(null);
        tutorialsSeen.set({});
        showTutorial.set(true);
    });

    it("are offered once per phone, and not at all with the switch off", () => {
        expect(offerTour("seeker")).toBe(true);
        expect(tour.get()).toMatchObject({ id: "seeker", step: "offer" });
        endTour();
        expect(tutorialsSeen.get().seeker).toBe(true);
        expect(offerTour("seeker")).toBe(false);
        // Each role is a first time of its own.
        expect(offerTour("hider")).toBe(true);
        endTour();

        tutorialsSeen.set({});
        showTutorial.set(false);
        expect(offerTour("seeker")).toBe(false);
        expect(tour.get()).toBeNull();
    });

    it("an unanswered offer gives way to a newer one", () => {
        // Offered on the first visit, ignored; then the player joins a game.
        expect(offerTour("organiser")).toBe(true);
        expect(offerTour("seeker")).toBe(true);
        expect(tour.get()).toMatchObject({ id: "seeker", step: "offer" });
        // The ignored one wasn't declined: it may come again.
        expect(tutorialsSeen.get().organiser).toBeUndefined();
    });

    it("don't replace a tour that is running", () => {
        startTour("hider");
        expect(offerTour("seeker")).toBe(false);
        expect(tour.get()).toMatchObject({ id: "hider", step: 0 });
    });

    it("go forward and back, and finish after the last step", () => {
        let after = 0;
        startTour("organiser", () => after++);
        backStep();
        expect(tour.get()?.step).toBe(0);
        nextStep();
        nextStep();
        expect(tour.get()?.step).toBe(2);
        backStep();
        expect(tour.get()).toMatchObject({ step: 1, direction: -1 });
        for (let i = 0; i < TOURS.organiser.length; i++) nextStep();
        expect(tour.get()).toBeNull();
        expect(tutorialsSeen.get().organiser).toBe(true);
        expect(after).toBe(1);
    });

    it("skip a missing step in the direction of travel", () => {
        startTour("seeker");
        nextStep();
        nextStep();
        skipMissingStep();
        expect(tour.get()?.step).toBe(3);
        backStep();
        skipMissingStep();
        expect(tour.get()?.step).toBe(1);
        // Never before the first step.
        tour.set({ id: "seeker", step: 0, direction: -1 });
        skipMissingStep();
        expect(tour.get()).toMatchObject({ step: 1, direction: 1 });
    });

    it("can be started from the Menu even when seen or switched off", () => {
        showTutorial.set(false);
        tutorialsSeen.set({ hider: true });
        startTour("hider");
        expect(tour.get()).toMatchObject({ id: "hider", step: 0 });
    });

    it("tips show once, never during a tour, never with the switch off", () => {
        expect(showTip("seeker-curse")).toBe(true);
        expect(coachMark.get()?.title).toBe(TIPS["seeker-curse"].title);
        coachMark.set(null);
        expect(showTip("seeker-curse")).toBe(false);

        startTour("seeker");
        expect(showTip("seeker-answer")).toBe(false);
        tour.set(null);
        showTutorial.set(false);
        expect(showTip("seeker-answer")).toBe(false);
        expect(coachMark.get()).toBeNull();
    });

    it("tips follow the game's news, for the role it concerns", () => {
        const news = (kind: GameEvent["kind"], title = "") => ({ kind, title });
        expect(tipForEvent(news("question"), "hider")).toBe("hider-question");
        expect(tipForEvent(news("question"), "seeker")).toBeNull();
        expect(tipForEvent(news("answer", "Answered"), "seeker")).toBe(
            "seeker-answer",
        );
        // A veto shades nothing new.
        expect(tipForEvent(news("answer", "Vetoed"), "seeker")).toBeNull();
        expect(tipForEvent(news("curse"), "seeker")).toBe("seeker-curse");
        expect(tipForEvent(news("endgame"), "hider")).toBe("hider-endgame");
        expect(tipForEvent(news("hider"), "seeker")).toBe("seeker-hider-ready");
        expect(tipForEvent(news("move"), "seeker")).toBe("seeker-move");
        expect(tipForEvent(news("rest"), "seeker")).toBeNull();
        // The hider started the end game.
        expect(tipForEvent(news("endgame"), "seeker")).toBe("seeker-endgame");
    });

    it("a tip that comes during a tour shows when the tour ends", () => {
        startTour("seeker");
        expect(showTip("seeker-hider-ready")).toBe(false);
        expect(coachMark.get()).toBeNull();
        endTour();
        expect(coachMark.get()?.title).toBe(TIPS["seeker-hider-ready"].title);
        expect(tutorialsSeen.get()["tip:seeker-hider-ready"]).toBe(true);
        // Only the latest waits; none is left over for the next tour.
        coachMark.set(null);
        startTour("seeker");
        endTour();
        expect(coachMark.get()).toBeNull();
    });

    it("a tip never covers a pointer to something to do, but replaces an older tip", () => {
        const pointer = {
            target: "#x",
            title: "Pick your hiding spot",
            text: "Tap your station.",
        };
        coachMark.set(pointer);
        expect(showTip("hider-question")).toBe(false);
        expect(coachMark.get()).toBe(pointer);
        // Not shown, so not seen: it comes the next time.
        expect(tutorialsSeen.get()["tip:hider-question"]).toBeUndefined();

        coachMark.set(null);
        expect(showTip("hider-question")).toBe(true);
        expect(showTip("hider-draw")).toBe(true);
        expect(coachMark.get()?.title).toBe(TIPS["hider-draw"].title);
    });
});

describe("the labels the tutorial names", () => {
    /** Every component's and page's source, as one text. */
    const source = (() => {
        const root = fileURLToPath(new URL("../src/", import.meta.url));
        const read = (dir: string): string[] =>
            readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
                const path = join(dir, entry.name);
                if (entry.isDirectory()) return read(path);
                return /\.(tsx|astro)$/.test(entry.name)
                    ? [readFileSync(path, "utf8")]
                    : [];
            });
        return [
            ...read(join(root, "components")),
            ...read(join(root, "pages")),
        ].join("\n");
    })();
    const escape = (text: string) =>
        text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    it("point at things the app has", () => {
        const targets = new Set(
            Object.values(TOURS).flatMap((steps) =>
                steps.flatMap((step) => step.target ?? []),
            ),
        );
        for (const target of targets) {
            for (const [, attribute, name] of target.matchAll(
                /\[data-(tutorial-id|testid)="([^"]+)"\]/g,
            )) {
                const named =
                    attribute === "testid"
                        ? [`data-testid="${name}"`]
                        : [
                              `data-tutorial-id="${name}"`,
                              `tutorialId="${name}"`,
                          ];
                expect(
                    named.some((text) => source.includes(text)),
                    target,
                ).toBe(true);
            }
        }
    });

    it("are spelled as the app shows them", () => {
        const labels = new Set(
            everyText().flatMap(({ text }) =>
                [...text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]),
            ),
        );
        expect(labels.size).toBeGreaterThan(10);
        for (const label of labels) {
            // As JSX text (on its own line or between tags) or a string.
            const shown = new RegExp(
                `(^\\s*|[>"'\`])${escape(label)}(?=\\s*$|[<"'\`…{])`,
                "m",
            );
            expect(source, `**${label}**`).toMatch(shown);
        }
    });
});
