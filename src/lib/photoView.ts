// The photo viewer's zoom (round 44), as plain sums: the photo fits the
// screen at scale 1, zooms up to two screen pixels per photo pixel, and is
// moved by `x`, `y` (screen pixels from the middle), never off the screen.

export type Box = { width: number; height: number };
export type Point = { x: number; y: number };
/** How the photo is shown: its zoom and how far it is moved from the middle. */
export type View = { scale: number; x: number; y: number };
/** The screen, the photo as it fits on it (turned), and the most zoom. */
export type Frame = { screen: Box; seen: Box; max: number };

export const START: View = { scale: 1, x: 0, y: 0 };
/** A double tap zooms this far. */
const TAP_ZOOM = 2.5;

/** The photo fitted to the screen, turned by `turn` degrees. */
export const frame = (natural: Box, screen: Box, turn: number): Frame => {
    const sideways = turn % 180 !== 0;
    const width = sideways ? natural.height : natural.width;
    const height = sideways ? natural.width : natural.height;
    const fit = Math.min(screen.width / width, screen.height / height);
    return {
        screen,
        seen: { width: width * fit, height: height * fit },
        // Two screen pixels per photo pixel, and at least 4×.
        max: Math.max(4, 2 / fit),
    };
};

/** Keeps the zoom between 1 and the most, and the photo over the screen. */
const clamp = (view: View, { screen, seen, max }: Frame): View => {
    const scale = Math.min(max, Math.max(1, view.scale));
    const room = (size: number, space: number) =>
        Math.max(0, (size * scale - space) / 2);
    const within = (value: number, limit: number) =>
        Math.max(-limit, Math.min(limit, value)) || 0;
    return {
        scale,
        x: within(view.x, room(seen.width, screen.width)),
        y: within(view.y, room(seen.height, screen.height)),
    };
};

/**
 * Zooms by `factor`, keeping the photo's spot under `focus` (screen pixels
 * from the middle) where it is: under the fingers, or the mouse.
 */
export const zoomAt = (
    view: View,
    factor: number,
    focus: Point,
    frame: Frame,
): View => {
    const scale = Math.min(frame.max, Math.max(1, view.scale * factor));
    const k = scale / view.scale;
    return clamp(
        {
            scale,
            x: focus.x - k * (focus.x - view.x),
            y: focus.y - k * (focus.y - view.y),
        },
        frame,
    );
};

/** Moves the photo with a finger (only a zoomed one moves). */
export const panBy = (view: View, dx: number, dy: number, frame: Frame) =>
    clamp({ ...view, x: view.x + dx, y: view.y + dy }, frame);

/** A double tap: in on the spot, or back to the whole photo. */
export const toggleZoom = (view: View, focus: Point, frame: Frame) =>
    view.scale > 1 ? START : zoomAt(view, TAP_ZOOM, focus, frame);
