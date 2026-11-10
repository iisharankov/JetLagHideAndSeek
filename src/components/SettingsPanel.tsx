// Menu → Settings.
import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import {
    alertsEnabled,
    animateMapMovements,
    autoZoom,
    baseTileLayer,
    cardLayout,
    draftsOnMap,
    followMe,
    referencePlacesMode,
} from "@/lib/context";
import {
    askNotifications,
    notificationsState,
    type NotificationState,
} from "@/lib/game/alerts";

import { PushCard } from "./game/PushCard";
import { MenuGroup } from "./MenuGroup";
import { PlacesSettings } from "./PlacesSettings";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";

/** Menu → Settings: how this phone shows the game. */
export const SettingsPanel = () => {
    const $animateMapMovements = useStore(animateMapMovements);
    const $autoZoom = useStore(autoZoom);
    const $baseTileLayer = useStore(baseTileLayer);
    const $followMe = useStore(followMe);
    const $referencePlaces = useStore(referencePlacesMode);
    const $draftsOnMap = useStore(draftsOnMap);
    const $cardLayout = useStore(cardLayout);
    const $alerts = useStore(alertsEnabled);
    const [notifications, setNotifications] =
        useState<NotificationState>("default");
    useEffect(() => setNotifications(notificationsState()), []);

    return (
        <>
            <>
                <MenuGroup title="Map">
                    <Label>Reference places</Label>
                    <SegmentedControl
                        label="Reference places"
                        options={[
                            {
                                value: "active",
                                label: "Active question",
                            },
                            {
                                value: "all",
                                label: "All questions",
                            },
                            { value: "off", label: "Off" },
                        ]}
                        value={$referencePlaces}
                        onValueChange={referencePlacesMode.set}
                    />
                    <p className="text-xs text-slate-400">
                        A star on the place a question measures from, dots on
                        the other candidates and the seeker&apos;s zone outline.
                        The active question is the card you last opened, tapped
                        or added.
                    </p>
                    <ToggleCard
                        title="Follow me (GPS)"
                        description="Your position on the map, while this app is open; new questions start there. A seeker's also shows on the hider's map, as the rules ask."
                        tutorialId="follow-me"
                        checked={$followMe}
                        onCheckedChange={followMe.set}
                    />
                    <ToggleCard
                        title="Auto zoom"
                        description="Zoom to what's left after each answer."
                        checked={$autoZoom}
                        onCheckedChange={autoZoom.set}
                    />
                    <ToggleCard
                        title="Animate map movements"
                        description="The map glides to a question or a station instead of jumping there. Off is quicker on a slow phone."
                        checked={$animateMapMovements}
                        onCheckedChange={animateMapMovements.set}
                    />
                    <Label>Base map</Label>
                    <Select
                        trigger="Base map style"
                        options={{
                            selfhosted: "Own server (light)",
                            "selfhosted-dark": "Own server (dark)",
                            osmcarto: "OpenStreetMap Carto (external)",
                        }}
                        value={$baseTileLayer}
                        onValueChange={(v) => baseTileLayer.set(v as any)}
                    />
                    <p className="text-xs text-slate-400">
                        Map data © OpenStreetMap contributors; basemap by
                        Protomaps.
                    </p>
                </MenuGroup>
                <MenuGroup title="Places">
                    <PlacesSettings />
                </MenuGroup>
                <MenuGroup title="Questions">
                    <Label>Question card</Label>
                    <SegmentedControl
                        label="Question card"
                        options={[
                            { value: "sections", label: "Sections" },
                            { value: "sentence", label: "Sentence" },
                        ]}
                        value={$cardLayout}
                        onValueChange={cardLayout.set}
                    />
                    <p className="text-xs text-slate-400">
                        How an open question looks, to try them out: labelled
                        rows, or the question as a sentence with words to tap.
                    </p>
                    <Label>Seekers&apos; drafts on the map</Label>
                    <SegmentedControl
                        label="Drafts on the map"
                        options={[
                            {
                                value: "all",
                                label: "All, each in its colour",
                            },
                            {
                                value: "active",
                                label: "Only the open card",
                            },
                        ]}
                        value={$draftsOnMap}
                        onValueChange={draftsOnMap.set}
                    />
                    <p className="text-xs text-slate-400">
                        Drafts are questions not sent to the hider yet.
                        &quot;Only the open card&quot;: tapping a draft shows
                        just that one; the others are outlined.
                    </p>
                </MenuGroup>
                <MenuGroup title="Alerts">
                    <ToggleCard
                        title="Buzz and beep"
                        tutorialId="alerts"
                        description="New questions (hider), answers and cards played (seekers). The beep works after your first tap on the page."
                        checked={$alerts}
                        onCheckedChange={alertsEnabled.set}
                    />
                    <Button
                        variant="outline"
                        disabled={
                            notifications === "granted" ||
                            notifications === "unsupported"
                        }
                        onClick={async () =>
                            setNotifications(await askNotifications())
                        }
                    >
                        {notifications === "granted"
                            ? "Notifications allowed ✓"
                            : notifications === "denied"
                              ? "Notifications blocked in the browser's site settings"
                              : notifications === "unsupported"
                                ? "No notifications on this browser"
                                : "Allow notifications in the background"}
                    </Button>
                    <p className="text-xs text-slate-400">
                        Notifications reach you while the app is open in the
                        background. On an iPhone, install the app first (Share →
                        Add to Home Screen; iOS 16.4 or later).
                    </p>
                    <PushCard />
                </MenuGroup>
            </>
        </>
    );
};
