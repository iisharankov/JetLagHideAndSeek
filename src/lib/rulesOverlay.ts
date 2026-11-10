// The rules over the app (round 42): opened from Help, a question's "i"
// and the Reference link, instead of a new tab that loses the game.
import { atom } from "nanostores";

export interface RulesView {
    /** A rules page ("seeking/radar-questions"), or "reference". */
    page: string;
    /** A heading on it to show. */
    heading?: string;
}

export const rulesOverlay = atom<RulesView | null>(null);

export const openRules = (page = "", heading?: string) =>
    rulesOverlay.set({ page, heading });

export const closeRules = () => rulesOverlay.set(null);

/** "rules/seeking/radar-questions/#within-1-mile" → the page and heading. */
export const rulesViewFromHref = (href: string): RulesView | null => {
    const match = href.match(/rules\/([^#?]*?)\/?(?:#(.*))?$/);
    if (!match) return null;
    return { page: match[1], heading: match[2] || undefined };
};
