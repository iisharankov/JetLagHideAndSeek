import { withErrorBoundary } from "@/components/ErrorBoundary";
import { GameDialogs as Panel } from "@/components/GameDialogs";

export const GameDialogs = withErrorBoundary(Panel, "game dialogs", [
    "currentGame",
    "hiderTokens",
    "gameSettings",
    "playerName",
]);
