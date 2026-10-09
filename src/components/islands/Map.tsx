import { withErrorBoundary } from "@/components/ErrorBoundary";
import { Map as Panel } from "@/components/Map";

export const Map = withErrorBoundary(Panel, "map");
