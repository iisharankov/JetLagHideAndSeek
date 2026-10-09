import { withErrorBoundary } from "@/components/ErrorBoundary";
import { PlayAreaBar as Panel } from "@/components/PlayAreaBar";

export const PlayAreaBar = withErrorBoundary(Panel, "play area bar");
