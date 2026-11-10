import { describe, expect, it } from "vitest";

import { frame, panBy, START, toggleZoom, zoomAt } from "@/lib/photoView";

// The photo viewer's zoom (round 44): pinch, double tap or the wheel zoom
// in on a spot, a finger moves the photo, and it never leaves the screen.

const screen = { width: 400, height: 800 };
const landscape = { width: 4000, height: 3000 };

describe("frame", () => {
    it("fits the photo to the screen", () => {
        const upright = frame(landscape, screen, 0);
        expect(upright.seen).toEqual({ width: 400, height: 300 });
        // Up to two screen pixels for each of the photo's.
        expect(upright.max).toBe(20);
    });

    it("fits a turned photo the other way", () => {
        const turned = frame(landscape, screen, 90);
        expect(turned.seen.width).toBeCloseTo(400);
        expect(turned.seen.height).toBeCloseTo(533.33, 1);
        expect(turned.max).toBeCloseTo(15);
        expect(frame(landscape, screen, 270).seen).toEqual(turned.seen);
    });

    it("lets a small photo zoom at least 4×", () => {
        expect(frame({ width: 100, height: 100 }, screen, 0).max).toBe(4);
    });
});

describe("zoomAt", () => {
    const upright = frame(landscape, screen, 0);

    it("keeps the spot under the fingers where it is", () => {
        const view = zoomAt(START, 2, { x: 100, y: 0 }, upright);
        expect(view.scale).toBe(2);
        expect(view.x).toBe(-100);
        // The photo's point under the fingers: the same before and after.
        expect((100 - view.x) / view.scale).toBe(100);
    });

    it("stays between the whole photo and its most zoom", () => {
        expect(zoomAt(START, 0.5, { x: 50, y: 50 }, upright)).toEqual(START);
        expect(zoomAt(START, 100, { x: 0, y: 0 }, upright).scale).toBe(20);
    });

    it("comes back to the middle when zoomed out", () => {
        const zoomed = zoomAt(START, 3, { x: 150, y: 100 }, upright);
        expect(zoomAt(zoomed, 1 / 3, { x: 0, y: 0 }, upright)).toEqual(START);
    });
});

describe("panBy", () => {
    const upright = frame(landscape, screen, 0);

    it("doesn't move the whole photo", () => {
        expect(panBy(START, 50, 50, upright)).toEqual(START);
    });

    it("moves a zoomed photo up to its edges", () => {
        const zoomed = { scale: 2, x: 0, y: 0 };
        // 800 wide on a 400 screen: 200 each side. 600 high on 800: none.
        expect(panBy(zoomed, 150, 40, upright)).toEqual({
            scale: 2,
            x: 150,
            y: 0,
        });
        expect(panBy(zoomed, 900, 0, upright).x).toBe(200);
        expect(panBy(zoomed, -900, 0, upright).x).toBe(-200);
        const deeper = { scale: 4, x: 0, y: 0 };
        expect(panBy(deeper, 0, -900, upright).y).toBe(-200);
    });
});

describe("toggleZoom", () => {
    const upright = frame(landscape, screen, 0);

    it("zooms in on a double tap, and back out on the next", () => {
        const zoomed = toggleZoom(START, { x: 40, y: 20 }, upright);
        expect(zoomed.scale).toBe(2.5);
        expect(toggleZoom(zoomed, { x: 0, y: 0 }, upright)).toEqual(START);
    });
});
