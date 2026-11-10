// A question's card opened over the map on a phone (round 46): the map
// frames the question (its circle, or its place) in the gap the card
// leaves between its header and its controls.
import { questionBounds } from "@/lib/cardText";
import { animateMapMovements, leafletMapContext } from "@/lib/context";
import type { Question } from "@/maps/schema";

/** Fits the question into `gap` (the card's window, in screen pixels). */
export const frameQuestion = (question: Question, gap: DOMRect) => {
    const map = leafletMapContext.get();
    const bounds = questionBounds(question);
    // Too small a window to frame anything in: leave the map be.
    if (!map || !bounds || gap.height < 80) return;
    const box = map.getContainer().getBoundingClientRect();
    map.fitBounds(bounds, {
        paddingTopLeft: [16, Math.max(0, gap.top - box.top) + 16],
        paddingBottomRight: [16, Math.max(0, box.bottom - gap.bottom) + 16],
        animate: animateMapMovements.get(),
    });
};
