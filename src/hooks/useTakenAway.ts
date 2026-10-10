import { useStore } from "@nanostores/react";

import { blockedKinds, kindCategory } from "@/lib/game/curseRules";
import { serverNow } from "@/lib/game/serverTime";
import { gameState } from "@/lib/game/session";

/**
 * The types of one category a Curse of the Drained Brain took away, for the
 * question cards' lists: "zone" for "matching:zone", "5" for "radius:5".
 */
export const useTakenAway = (category: string): string[] => {
    const $game = useStore(gameState);
    if (!$game) return [];
    return blockedKinds($game, serverNow())
        .filter((kind) => kindCategory(kind) === category)
        .map((kind) => kind.slice(category.length + 1));
};
