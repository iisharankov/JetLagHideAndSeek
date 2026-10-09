// The question pages of the rulebook, for the ⓘ popovers and the reference
// page. The full rulebook is rendered at /rules/ (src/pages/rules/).
import curses from "@/content/rules/hiding/the-hider-deck/curses.md?raw";
import matching from "@/content/rules/seeking/matching-questions.md?raw";
import measuring from "@/content/rules/seeking/measuring-questions.md?raw";
import photo from "@/content/rules/seeking/photo-questions.md?raw";
import radar from "@/content/rules/seeking/radar-questions.md?raw";
import tentacle from "@/content/rules/seeking/tentacle-questions.md?raw";
import thermometer from "@/content/rules/seeking/thermometer-questions.md?raw";
import { withBase } from "@/lib/config";

import { headingSlug, parseRulesPage } from "./sections";

/** Rulebook pages by their path under /rules/. */
export const RULES_PAGES = {
    "seeking/matching-questions": parseRulesPage(matching),
    "seeking/measuring-questions": parseRulesPage(measuring),
    "seeking/radar-questions": parseRulesPage(radar),
    "seeking/thermometer-questions": parseRulesPage(thermometer),
    "seeking/tentacle-questions": parseRulesPage(tentacle),
    "seeking/photo-questions": parseRulesPage(photo),
    "hiding/the-hider-deck/curses": parseRulesPage(curses),
};

export type RulesPageId = keyof typeof RULES_PAGES;

/** A place in the rulebook: a page, optionally one of its headings. */
export interface RuleRef {
    page: RulesPageId;
    heading?: string;
}

/** Link to a page (and heading) of the in-app rulebook. */
export const rulesUrl = ({ page, heading }: RuleRef) =>
    withBase(`rules/${page}/`) + (heading ? `#${headingSlug(heading)}` : "");

/** The rules text for a heading, or the page's introduction. */
export const rulesText = ({ page, heading }: RuleRef) => {
    const parsed = RULES_PAGES[page];
    return heading ? parsed.section(heading)?.body : parsed.intro;
};

/**
 * A question page's introduction without the diagrams: the question's
 * format, valid answers, time to answer and the hider's reward.
 */
export const categoryIntro = (page: RulesPageId) =>
    RULES_PAGES[page].intro
        .split(/\n{2,}/)
        .filter(
            (block) =>
                !block.startsWith("![") &&
                !/^Here('s| are) (a|two) little diagram/.test(block),
        )
        .join("\n\n");
