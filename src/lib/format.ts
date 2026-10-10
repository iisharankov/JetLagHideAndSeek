// Small formatters shared by the game panels.

/** "just now", "3 min ago", "2 h ago". */
export const ago = (time: number, now = Date.now()) => {
    const minutes = Math.round((now - time) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
};

/** "14:05": the time of day, in the phone's own format. */
export const clockTime = (at: number) =>
    new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
