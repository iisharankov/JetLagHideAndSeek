import { withErrorBoundary } from "@/components/ErrorBoundary";
import { PlacePicker as Panel } from "@/components/PlacePicker";

export const PlacePicker = withErrorBoundary(Panel, "place picker");
