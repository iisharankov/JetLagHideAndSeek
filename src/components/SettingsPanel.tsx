// Menu → Settings.
import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import {
    alertsEnabled,
    allowPublicOverpass,
    animateMapMovements,
    autoZoom,
    baseTileLayer,
    customInitPreference,
    defaultCustomQuestions,
    defaultUnit,
    draftsOnMap,
    followMe,
    leafletMapContext,
    overpassCustomHost,
    planningModeEnabled,
    questions,
    referencePlacesMode,
    regionChoice,
} from "@/lib/context";
import {
    askNotifications,
    notificationsState,
    type NotificationState,
} from "@/lib/game/alerts";
import type { RegionChoice } from "@/maps/regionRules";

import { PushCard } from "./game/PushCard";
import { MenuGroup } from "./MenuGroup";
import { PlacesSettings } from "./PlacesSettings";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";
import { UnitSelect } from "./UnitSelect";

/** Menu → Settings: how this phone shows the game. */
export const SettingsPanel = () => {
    const $defaultCustomQuestions = useStore(defaultCustomQuestions);
    const $defaultUnit = useStore(defaultUnit);
    const $regionChoice = useStore(regionChoice);
    const $animateMapMovements = useStore(animateMapMovements);
    const $autoZoom = useStore(autoZoom);
    const $planningMode = useStore(planningModeEnabled);
    const $baseTileLayer = useStore(baseTileLayer);
    const $followMe = useStore(followMe);
    const $referencePlaces = useStore(referencePlacesMode);
    const $customInitPref = useStore(customInitPreference);
    const $allowPublicOverpass = useStore(allowPublicOverpass);
    const $draftsOnMap = useStore(draftsOnMap);
    const $alerts = useStore(alertsEnabled);
    const [notifications, setNotifications] =
        useState<NotificationState>("default");
    useEffect(() => setNotifications(notificationsState()), []);
    const $overpassCustomHost = useStore(overpassCustomHost);

    const setPlanningMode = (on: boolean) => {
        if (!on) {
            leafletMapContext.get()?.eachLayer((layer: any) => {
                if (layer.questionKey || layer.questionKey === 0) {
                    leafletMapContext.get()?.removeLayer(layer);
                }
            });
        } else {
            questions.set([...questions.get()]);
        }
        planningModeEnabled.set(on);
    };

    return (
        <>
            <>
                <MenuGroup title="Game rules">
                    <Label>Local rules</Label>
                    <Select
                        trigger="Local rules"
                        options={{
                            auto: "Automatic (by play area)",
                            standard: "Standard Jet Lag rules",
                            switzerland: "Switzerland",
                            germany: "Germany",
                        }}
                        value={$regionChoice}
                        onValueChange={(v) =>
                            regionChoice.set(v as RegionChoice)
                        }
                    />
                    <p className="text-xs text-slate-400">
                        Swiss rules: &quot;major city&quot; means 100,000+
                        people, coastline and 7-Eleven questions are hidden and
                        the lake shore question is added. German rules: the same
                        with cities of a million.
                    </p>
                    <Label>Default unit</Label>
                    <UnitSelect
                        unit={$defaultUnit}
                        onChange={defaultUnit.set}
                    />
                </MenuGroup>
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
                        description="Show your own position on the map."
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
                </MenuGroup>
                <MenuGroup title="Places">
                    <PlacesSettings />
                </MenuGroup>
                <MenuGroup title="Questions">
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
                    <ToggleCard
                        title="Planning mode"
                        description="Unlocked questions only draw where they would split the map, without applying an answer."
                        checked={$planningMode}
                        onCheckedChange={setPlanningMode}
                    />
                    <ToggleCard
                        title="Default to custom questions"
                        checked={$defaultCustomQuestions}
                        onCheckedChange={defaultCustomQuestions.set}
                    />
                    <Label>New custom questions</Label>
                    <Select
                        trigger="New custom default"
                        options={{
                            ask: "Ask each time",
                            blank: "Start blank",
                            prefill: "Copy from current",
                        }}
                        value={$customInitPref}
                        onValueChange={(v) =>
                            customInitPreference.set(v as any)
                        }
                    />
                </MenuGroup>
                <MenuGroup title="Alerts">
                    <ToggleCard
                        title="Buzz and beep"
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
                <MenuGroup title="Map data">
                    <p className="text-xs text-slate-400">
                        Questions are answered from this app&apos;s own server.
                    </p>
                    <Input
                        type="text"
                        value={$overpassCustomHost}
                        onChange={(e) => overpassCustomHost.set(e.target.value)}
                        placeholder="Extra Overpass server (optional)"
                    />
                    <ToggleCard
                        title="Fall back to public Overpass servers"
                        description="Public servers are often overloaded, and they see the play area and question locations."
                        checked={$allowPublicOverpass}
                        onCheckedChange={allowPublicOverpass.set}
                    />
                </MenuGroup>
            </>
        </>
    );
};
