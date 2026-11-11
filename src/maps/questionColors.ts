// What colour a question draws in on the map (round 42, the owner): radars
// blue, thermometers purple, the other kinds their pin's colour; what the
// answers ruled out, and the outside of the play area, grey.
import { ICON_COLORS } from "@/maps/api";

/** The kinds with a colour of their own (their pins take it too). */
export const KIND_COLORS: Partial<Record<string, keyof typeof ICON_COLORS>> = {
    radius: "blue",
    thermometer: "violet",
};

/** The pin colour a new question of this kind gets, if its kind has one. */
export const kindColorName = (kind: string) => KIND_COLORS[kind];

export const questionColor = (question: {
    id: string;
    data: unknown;
}): string => {
    const name =
        KIND_COLORS[question.id] ??
        ((question.data as { color?: string }).color as
            | keyof typeof ICON_COLORS
            | undefined);
    return (name && ICON_COLORS[name]) ?? "#f59e0b";
};

/**
 * A thermometer's pins (round 48): both purple, the start darker; a faint
 * dashed line joins them.
 */
export const THERMOMETER_PINS = {
    start: "#5B1478",
    end: ICON_COLORS.violet,
} as const;

/** Ruled out (by answers, and outside the play area). */
export const RULED_OUT_COLOR = "#475569";
