import { useStore } from "@nanostores/react";

import { showTutorial, tutorialStep } from "@/lib/context";
import { TUTORIAL_STEP_IDS, type TutorialStepId } from "@/lib/tutorial";

/**
 * While the tutorial is open, returns `trueReplacement` on the given steps
 * and `falseReplacement` on all others; otherwise returns `defaultValue`.
 */
export function useTutorialStep<T>(
    defaultValue: T,
    steps: TutorialStepId[],
    trueReplacement: T = true as T,
    falseReplacement: T = false as T,
): T {
    const $showTutorial = useStore(showTutorial);
    const $tutorialStep = useStore(tutorialStep);

    if ($showTutorial) {
        return steps.includes(TUTORIAL_STEP_IDS[$tutorialStep])
            ? trueReplacement
            : falseReplacement;
    }
    return defaultValue;
}
