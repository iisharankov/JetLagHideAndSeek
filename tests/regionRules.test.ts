import { describe, expect, it } from "vitest";

import {
    adaptTypeOptions,
    majorCityPopulation,
    populationAtLeastRegex,
    regionRulesFor,
} from "@/maps/regionRules";

describe("populationAtLeastRegex", () => {
    const matches = (pattern: string, value: string) =>
        new RegExp(pattern).test(value);

    it("matches populations of at least a million", () => {
        const pattern = populationAtLeastRegex(1_000_000);
        expect(matches(pattern, "1000000")).toBe(true);
        expect(matches(pattern, "10123456")).toBe(true); // was missed before
        expect(matches(pattern, "999999")).toBe(false);
    });

    it("matches populations of at least 100 000", () => {
        const pattern = populationAtLeastRegex(100_000);
        expect(matches(pattern, "421878")).toBe(true); // Zürich
        expect(matches(pattern, "99999")).toBe(false);
    });
});

describe("regionRulesFor", () => {
    it("uses Swiss rules for a Swiss play area", () => {
        const rules = regionRulesFor("auto", "CH");
        expect(rules.region).toBe("switzerland");
        expect(majorCityPopulation(rules)).toBe(100_000);
        expect(rules.hiddenQuestionTypes).toContain("coastline");
        expect(rules.hiddenQuestionTypes).toContain("seven11");
        // Lakes stand in for the sea.
        expect(rules.hiddenQuestionTypes).not.toContain("lake");
    });

    it("keeps the standard rules elsewhere", () => {
        const rules = regionRulesFor("auto", "US");
        expect(majorCityPopulation(rules)).toBe(1_000_000);
        // Lake shores need the Swiss reference data.
        expect(rules.hiddenQuestionTypes).toEqual(["lake"]);
    });

    it("gives a German play area the Swiss rules with cities of a million", () => {
        const rules = regionRulesFor("auto", "DE");
        expect(rules.region).toBe("germany");
        expect(majorCityPopulation(rules)).toBe(1_000_000);
        expect(rules.hiddenQuestionTypes).toEqual(["coastline", "seven11"]);
    });

    it("lets the players override the automatic choice", () => {
        expect(regionRulesFor("standard", "CH").region).toBe("standard");
        expect(regionRulesFor("switzerland", "US").region).toBe("switzerland");
        expect(regionRulesFor("germany", "CH").region).toBe("germany");
    });
});

describe("adaptTypeOptions", () => {
    const options = {
        coastline: "Coastline Question",
        city: "Major City (1,000,000+ people) Question",
        seven11: "7-Eleven Question",
    };

    it("hides types that can't apply and relabels the city threshold", () => {
        expect(
            adaptTypeOptions(options, regionRulesFor("auto", "CH"), "city"),
        ).toEqual({ city: "Major City (100,000+ people) Question" });
    });

    it("keeps a hidden type that the question already uses", () => {
        expect(
            Object.keys(
                adaptTypeOptions(
                    options,
                    regionRulesFor("auto", "CH"),
                    "coastline",
                ),
            ),
        ).toEqual(["coastline", "city"]);
    });

    it("changes nothing under the standard rules", () => {
        expect(
            adaptTypeOptions(options, regionRulesFor("auto", "US"), "city"),
        ).toEqual(options);
    });
});
