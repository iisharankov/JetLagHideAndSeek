// Local adaptations of the standard (US-centred) Jet Lag question set.

export type RegionChoice = "auto" | "standard" | "switzerland";

export interface RegionRules {
    region: "standard" | "switzerland";
    /** Question types that can't apply in the region; hidden from the menus. */
    hiddenQuestionTypes: string[];
}

const STANDARD: RegionRules = {
    region: "standard",
    // Lake shores are a Swiss stand-in for the coastline, from the Swiss data.
    hiddenQuestionTypes: ["lake"],
};

const SWITZERLAND: RegionRules = {
    region: "switzerland",
    // Landlocked, and there are no 7-Elevens.
    hiddenQuestionTypes: ["coastline", "seven11"],
};

/** "auto" picks Swiss rules when the play area is in Switzerland. */
export const regionRulesFor = (
    choice: RegionChoice,
    countryCode?: string,
): RegionRules =>
    choice === "switzerland" ||
    (choice === "auto" && countryCode?.toUpperCase() === "CH")
        ? SWITZERLAND
        : STANDARD;

/** No Swiss city has a million people; Switzerland has six above 100,000. */
export const majorCityPopulation = (rules: RegionRules) =>
    rules.region === "switzerland" ? 100_000 : 1_000_000;

/**
 * A regex matching OSM population values of at least `minimum`, which must
 * be a power of ten. (Regexes are faster than numeric filters in Overpass.)
 */
export const populationAtLeastRegex = (minimum: number) =>
    `^[1-9][0-9]{${String(minimum).length - 1},}$`;

/**
 * Adapts a question-type menu to the region: hides types that can't apply
 * (unless the question already uses one) and relabels the city threshold.
 */
export const adaptTypeOptions = (
    options: Record<string, string>,
    rules: RegionRules,
    currentType: string,
): Record<string, string> =>
    Object.fromEntries(
        Object.entries(options)
            .filter(
                ([type]) =>
                    type === currentType ||
                    !rules.hiddenQuestionTypes.includes(type),
            )
            .map(([type, label]) => [
                type,
                label.replace(
                    "1,000,000+",
                    `${majorCityPopulation(rules).toLocaleString("en-US")}+`,
                ),
            ]),
    );
