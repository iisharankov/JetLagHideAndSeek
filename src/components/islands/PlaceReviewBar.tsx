import { withErrorBoundary } from "@/components/ErrorBoundary";
import { PlaceReviewBar as Panel } from "@/components/PlaceReviewBar";

export const PlaceReviewBar = withErrorBoundary(Panel, "place review bar");
