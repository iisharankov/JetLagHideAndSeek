import { namedFlavor } from "@protomaps/basemaps";
import { type Feature, type PaintRule, paintRules } from "protomaps-leaflet";
import { describe, expect, it } from "vitest";

import { basemapPaintRules } from "@/maps/basemapStyle";

const light = namedFlavor("light");

/**
 * A canvas as browsers have it: a line width of 0 (or less) doesn't take,
 * the last one stays. Records what gets stroked and filled.
 */
class Canvas {
    strokes: number[] = [];
    fills: string[] = [];
    private state = {
        lineWidth: 1,
        fillStyle: "#000000",
        strokeStyle: "#000000",
        globalAlpha: 1,
    };
    private saved: (typeof this.state)[] = [];
    get lineWidth() {
        return this.state.lineWidth;
    }
    set lineWidth(width: number) {
        if (width > 0 && Number.isFinite(width)) this.state.lineWidth = width;
    }
    get fillStyle() {
        return this.state.fillStyle;
    }
    set fillStyle(style: string) {
        this.state.fillStyle = style;
    }
    set strokeStyle(style: string) {
        this.state.strokeStyle = style;
    }
    set globalAlpha(alpha: number) {
        this.state.globalAlpha = alpha;
    }
    lineCap = "butt";
    lineJoin = "miter";
    save() {
        this.saved.push({ ...this.state });
    }
    restore() {
        this.state = this.saved.pop() ?? this.state;
    }
    beginPath() {}
    moveTo() {}
    lineTo() {}
    setLineDash() {}
    stroke() {
        this.strokes.push(this.state.lineWidth);
    }
    fill() {
        if (this.state.globalAlpha > 0) this.fills.push(this.state.fillStyle);
    }
}

const SQUARE = [
    [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 0 },
    ],
];

/** What the map draws for one feature at a zoom, as protomaps-leaflet's paint() does it. */
const draw = (
    rules: PaintRule[],
    dataLayer: string,
    props: Record<string, string>,
    zoom: number,
) => {
    const canvas = new Canvas();
    const ctx = canvas as unknown as CanvasRenderingContext2D;
    const feature = {
        props,
        geomType: dataLayer === "roads" ? 2 : 3,
        numVertices: 4,
        geom: SQUARE,
        bbox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    } as unknown as Feature;
    for (const rule of rules) {
        if (rule.dataLayer !== dataLayer) continue;
        if (rule.minzoom && zoom < rule.minzoom) continue;
        if (rule.maxzoom && zoom > rule.maxzoom) continue;
        rule.symbolizer.before?.(ctx, zoom);
        if (rule.filter && !rule.filter(zoom, feature)) continue;
        rule.symbolizer.draw(ctx, SQUARE as never, zoom, feature);
    }
    return canvas;
};

const TRACK = { kind: "path", kind_detail: "track" };
const FOOTWAY = { kind: "path", kind_detail: "footway" };
const MINOR = { kind: "minor_road", kind_detail: "residential" };
const MAJOR = { kind: "major_road", kind_detail: "secondary" };

describe("the basemap", () => {
    const rules = basemapPaintRules(light);

    it("leaves footpaths and farm tracks off a zoomed-out map", () => {
        for (const zoom of [11, 12, 13, 14]) {
            expect(draw(rules, "roads", TRACK, zoom).strokes).toEqual([]);
            expect(draw(rules, "roads", FOOTWAY, zoom).strokes).toEqual([]);
        }
    });

    it("shows them, still thin, once zoomed in to walk", () => {
        expect(draw(rules, "roads", FOOTWAY, 15).strokes[0]).toBeLessThan(0.5);
        expect(draw(rules, "roads", FOOTWAY, 17).strokes[0]).toBeGreaterThan(1);
    });

    it("leaves village streets off until zoom 14, keeps the main roads", () => {
        expect(draw(rules, "roads", MINOR, 13).strokes).toEqual([]);
        expect(draw(rules, "roads", MINOR, 15).strokes[0]).toBeGreaterThan(1);
        expect(draw(rules, "roads", MAJOR, 13).strokes[0]).toBeGreaterThan(1);
    });

    it("colours forests and woods the theme's green", () => {
        for (const kind of ["forest", "wood"]) {
            for (const zoom of [10, 13, 16]) {
                expect(
                    draw(rules, "landuse", { kind }, zoom).fills.at(-1),
                ).toBe(light.wood_b);
            }
        }
        // Fields stay the plain ground: the forests stand out on it.
        expect(draw(rules, "landuse", { kind: "farmland" }, 13).fills).toEqual(
            [],
        );
    });

    it("changes nothing else the library draws", () => {
        const upstream = paintRules(light);
        expect(rules).toHaveLength(upstream.length);
        expect(rules.map((rule) => rule.dataLayer)).toEqual(
            upstream.map((rule) => rule.dataLayer),
        );
        expect(draw(rules, "roads", MAJOR, 13).strokes).toEqual(
            draw(upstream, "roads", MAJOR, 13).strokes,
        );
        expect(draw(rules, "water", { kind: "lake" }, 13).fills).toEqual(
            draw(upstream, "water", { kind: "lake" }, 13).fills,
        );
    });

    // The two slips worked around in maps/basemapStyle.ts. When these
    // fail, protomaps-leaflet has fixed them and the workaround can go.
    it("works around protomaps-leaflet drawing 0-wide lines at 1 px and pale forests", () => {
        const upstream = paintRules(light);
        expect(draw(upstream, "roads", TRACK, 13).strokes).toEqual([1]);
        // The pale end of the forest colours, as "rgba(r, g, b, 1)".
        const [r, g, b] = [1, 3, 5].map((at) =>
            parseInt(light.wood_a.slice(at, at + 2), 16),
        );
        expect(
            draw(upstream, "landuse", { kind: "forest" }, 13).fills.at(-1),
        ).toBe(`rgba(${r}, ${g}, ${b}, 1)`);
    });
});
