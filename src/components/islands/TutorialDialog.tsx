import { withErrorBoundary } from "@/components/ErrorBoundary";
import { TutorialDialog as Panel } from "@/components/TutorialDialog";

export const TutorialDialog = withErrorBoundary(Panel, "tutorial");
