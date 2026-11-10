import { withErrorBoundary } from "@/components/ErrorBoundary";
import { TabBar as Panel } from "@/components/TabBar";

export const TabBar = withErrorBoundary(Panel, "tab bar");
