const ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

/** Makes text safe to put inside HTML (e.g. Leaflet popups, which use innerHTML). */
export const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (char) => ENTITIES[char]);
