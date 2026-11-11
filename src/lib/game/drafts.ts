// What the map shows of the questions (Questions → ⚙, and Settings):
// seekers' drafts shaded all (each in its own colour), or only the active
// card's, the others just outlined; and every question's pin, or only the
// active question's (round 48).
export type DraftsMode = "all" | "active";

export const draftsToApply = <T extends { key: number }>(
    drafts: T[],
    mode: DraftsMode,
    activeKey: number | null,
) => (mode === "active" ? drafts.filter((d) => d.key === activeKey) : drafts);

/**
 * What the map redraws on: the mode, and the active card only when only
 * its draft is shaded (round 48: the map didn't follow either before).
 */
export const draftsKey = (mode: DraftsMode, activeKey: number | null) =>
    mode === "active" ? `active:${activeKey}` : "all";

/** A question's pin: every one, or only the active question's. */
export const pinShown = (
    key: number,
    mode: DraftsMode,
    activeKey: number | null,
) => mode === "all" || key === activeKey;
