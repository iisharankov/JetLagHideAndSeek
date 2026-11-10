import { describe, expect, it } from "vitest";

import { ICON_COLORS } from "@/maps/api";
import { questionColor, RULED_OUT_COLOR } from "@/maps/questionColors";

// Round 42, the owner: radars blue, thermometers purple, what's ruled out
// grey; the other kinds keep their pin's colour.
describe("a question's colour on the map", () => {
    it("is blue for a radar and purple for a thermometer, whatever its pin", () => {
        expect(
            questionColor({ id: "radius", data: { color: "red" } } as never),
        ).toBe(ICON_COLORS.blue);
        expect(
            questionColor({
                id: "thermometer",
                data: { color: "green" },
            } as never),
        ).toBe(ICON_COLORS.violet);
    });

    it("is the pin's for the other kinds, and the ruled-out is grey", () => {
        expect(
            questionColor({
                id: "matching",
                data: { color: "orange" },
            } as never),
        ).toBe(ICON_COLORS.orange);
        expect(RULED_OUT_COLOR).toMatch(/^#/);
    });
});
