import { withErrorBoundary } from "@/components/ErrorBoundary";
import { AskButton as AskPanel, TabBar as Panel } from "@/components/TabBar";

export const TabBar = withErrorBoundary(Panel, "tab bar");
export const AskButton = withErrorBoundary(AskPanel, "ask button");
