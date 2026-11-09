// Metric only (agentic_docs/history/plans/nov-game-fixes/03, round 38). A question saved before
// that, on this phone or in an old shared game, may still say miles: it
// loads as the same distance in km.

const KM_PER_MILE = 1.609344;

/** The question with a distance in miles turned into km (3 decimals); anything else as it was. */
export const metricQuestion = <T>(question: T): T => {
    const data = (question as { data?: Record<string, unknown> } | null)?.data;
    if (!data || data.unit !== "miles") return question;
    const radius = Number(data.radius);
    return {
        ...question,
        data: {
            ...data,
            unit: "kilometers",
            ...(Number.isFinite(radius)
                ? { radius: Math.round(radius * KM_PER_MILE * 1000) / 1000 }
                : {}),
        },
    };
};
