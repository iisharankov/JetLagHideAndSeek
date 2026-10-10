// The rulebook's photo questions, with the game sizes each is for: the
// rulebook lists the small-game ones first, then adds more for medium and
// large games. Shared with the server (Randomize Question picks one at
// random), so nothing browser-only is imported here.
import photo from "@/content/rules/seeking/photo-questions.md?raw";
import type { GameSize } from "@/lib/game/types";

import { parseRulesPage } from "./sections";

export const PHOTO_PAGE = parseRulesPage(photo);

export interface PhotoQuestion {
    name: string;
    rules: string;
    sizes: GameSize[];
}

export const photoQuestions = (): PhotoQuestion[] => {
    const groups: GameSize[][] = [
        ["small", "medium", "large"],
        ["medium", "large"],
        ["large"],
    ];
    let group = 0;
    const questions: PhotoQuestion[] = [];
    for (const section of PHOTO_PAGE.sections) {
        if (section.level <= 3) {
            group = Math.min(group + 1, groups.length - 1);
        } else {
            questions.push({
                name: section.title,
                rules: section.body,
                sizes: groups[group],
            });
        }
    }
    return questions;
};

/** The photo questions a game of this size can ask. */
export const photoNamesFor = (size: GameSize) =>
    photoQuestions()
        .filter((question) => question.sizes.includes(size))
        .map((question) => question.name);
