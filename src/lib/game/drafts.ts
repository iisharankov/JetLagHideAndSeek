// Seekers' drafts on the map: all of them (each in its own colour), or only
// the active card's, the others just outlined.
export type DraftsMode = "all" | "active";

export const draftsToApply = <T extends { key: number }>(
    drafts: T[],
    mode: DraftsMode,
    activeKey: number | null,
) => (mode === "active" ? drafts.filter((d) => d.key === activeKey) : drafts);
