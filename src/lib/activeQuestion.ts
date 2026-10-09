import type { Question } from "@/maps/schema";

/** Which questions draw their reference places (star, dots, zone outline). */
export type ReferenceMode = "active" | "all" | "off";

/**
 * The questions whose reference places are drawn: by default only the
 * active one (the card last opened, tapped or added), so the map stays
 * readable with many questions. Hidden questions never draw anything.
 */
export const questionsToReference = (
    questions: Question[],
    mode: ReferenceMode,
    activeKey: number | null,
) =>
    questions.filter(
        (question) =>
            !question.data.hidden &&
            (mode === "all" ||
                (mode === "active" && question.key === activeKey)),
    );
