// Stable names for the tutorial steps, in order. Components that react to a
// step (opening the place picker, expanding the sidebar) refer to these
// names, so adding or removing steps can't silently shift which step they
// react to.
export const TUTORIAL_STEP_IDS = [
    "welcome",
    "place-picker",
    "open-sidebar",
    "question-types",
    "radius",
    "thermometer",
    "tentacles",
    "matching",
    "measuring",
    "menu",
    "hider-mode",
    "done",
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];
