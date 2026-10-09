import { withErrorBoundary } from "@/components/ErrorBoundary";
import { ZoneSidebar as Panel } from "@/components/ZoneSidebar";

export const ZoneSidebar = withErrorBoundary(Panel, "hiding zone sidebar", [
    "displayHidingZones",
    "displayHidingZonesStyle",
    "displayHidingZonesOptions",
    "disabledStations",
    "showRemainingStations",
    "removeDuplicates",
    "useCustomStations",
    "includeDefaultStations",
]);
