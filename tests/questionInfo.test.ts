import { describe, expect, it } from "vitest";

import { CATEGORIES, questionInfo, TYPES } from "@/lib/questionInfo";
import { rulesText, rulesUrl } from "@/lib/rules/content";
import {
    determineUnionizedStrings,
    matchingQuestionSchema,
    measuringQuestionSchema,
    tentacleQuestionSchema,
} from "@/maps/schema";

const typesOf = (schema: any, field = "type") =>
    schema.options.flatMap((option: any) =>
        determineUnionizedStrings(option.shape[field]).map(
            (literal) => (literal._def as any).value as string,
        ),
    );

describe("question descriptions", () => {
    it("describe every matching, measuring and tentacles type", () => {
        for (const type of typesOf(matchingQuestionSchema)) {
            expect(TYPES.matching[type], type).toBeDefined();
        }
        for (const type of typesOf(measuringQuestionSchema)) {
            expect(TYPES.measuring[type], type).toBeDefined();
        }
        for (const type of typesOf(tentacleQuestionSchema, "locationType")) {
            expect(TYPES.tentacles[type], type).toBeDefined();
        }
    });

    it("point at rules that exist in the rulebook", () => {
        const refs = [
            ...Object.values(CATEGORIES).map((c) => c.rules),
            ...Object.values(TYPES).flatMap((types) =>
                Object.values(types).flatMap((t) => (t.rules ? [t.rules] : [])),
            ),
        ];
        for (const ref of refs) {
            expect(rulesText(ref), JSON.stringify(ref)).toBeTruthy();
        }
    });

    it("link inside the app, never to another site", () => {
        const info = questionInfo("measuring", "lake");
        expect(info.category.name).toBe("Measuring");
        expect(rulesUrl(info.type!.rules!)).toBe(
            "/rules/seeking/measuring-questions/#body-of-water",
        );
        expect(rulesText(info.type!.rules!)).toContain(
            "Any named body of water",
        );
    });
});
