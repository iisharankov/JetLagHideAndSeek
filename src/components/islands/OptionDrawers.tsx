import { withErrorBoundary } from "@/components/ErrorBoundary";
import { OptionDrawers as Panel } from "@/components/OptionDrawers";

export const OptionDrawers = withErrorBoundary(Panel, "options bar");
