import { useStore } from "@nanostores/react";
import { useState } from "react";
import { toast } from "react-toastify";

import { ToggleCard } from "@/components/ui/toggle-card";
import {
    disablePush,
    enablePush,
    pushGames,
    pushSupported,
} from "@/lib/game/alerts";
import { activeGameId, hiderToken } from "@/lib/game/session";
import { errorMessage } from "@/maps/errors";

/**
 * Settings → Alerts, in a shared game: push notifications for this game,
 * which reach the phone even with the app closed.
 */
export const PushCard = () => {
    const $gameId = useStore(activeGameId);
    const $push = useStore(pushGames);
    const [busy, setBusy] = useState(false);
    if (!$gameId) return null;
    const supported = pushSupported();
    const on = !!$push[$gameId];

    const change = async (checked: boolean) => {
        setBusy(true);
        try {
            if (checked) {
                const result = await enablePush($gameId, hiderToken());
                if (result === "denied") {
                    toast.error(
                        "Notifications are blocked for this site. Allow them in the browser's site settings, then try again.",
                    );
                } else if (result === "unavailable") {
                    toast.error("This server doesn't send push notifications.");
                }
            } else {
                await disablePush($gameId, hiderToken());
            }
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ToggleCard
            title="Notify this phone about the game, even with the app closed"
            description={
                supported
                    ? "New questions for the hider; answers, photos and cards for the seekers. The server sends them through the browser's push service, which only sees that something arrived."
                    : "This browser can't receive push notifications. On an iPhone, install the app first (Share → Add to Home Screen; iOS 16.4 or later)."
            }
            checked={on}
            disabled={busy || !supported}
            onCheckedChange={(checked) => void change(checked)}
        />
    );
};
