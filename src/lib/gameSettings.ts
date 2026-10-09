// The game's settings on this phone: one object (lib/game/settings.ts) that
// drives the stores the engine and the sidebar read. Set before a game
// starts (Menu → Game); in a shared game the server's copy wins.
import {
    displayHidingZonesOptions,
    gameSettings,
    hidingRadius,
    hidingRadiusUnits,
    regionChoice,
} from "@/lib/context";
import {
    normalizeGameSettings,
    questionKey,
    radarDefaultKm,
    stationFilters,
} from "@/lib/game/settings";
import type { GameSettings } from "@/lib/game/types";

/** Makes `settings` the game's settings and updates everything they drive. */
export const applyGameSettings = (settings: GameSettings) => {
    const next = normalizeGameSettings(settings);
    if (JSON.stringify(next) !== JSON.stringify(gameSettings.get())) {
        gameSettings.set(next);
    }
    if (hidingRadius.get() !== next.hidingRadiusKm) {
        hidingRadius.set(next.hidingRadiusKm);
    }
    if (hidingRadiusUnits.get() !== "kilometers") {
        hidingRadiusUnits.set("kilometers");
    }
    const filters = stationFilters(next.stationKinds);
    if (
        JSON.stringify(filters) !==
        JSON.stringify(displayHidingZonesOptions.get())
    ) {
        displayHidingZonesOptions.set(filters);
    }
    if (regionChoice.get() !== next.region) regionChoice.set(next.region);
};

export const updateGameSettings = (changes: Partial<GameSettings>) =>
    applyGameSettings({ ...gameSettings.get(), ...changes });

/** Question types of a category that this game leaves out. */
export const hiddenTypesFor = (
    category: string,
    settings: GameSettings = gameSettings.get(),
) =>
    settings.disabledQuestions
        .filter((key) => key.startsWith(`${category}:`))
        .map((key) => key.slice(category.length + 1));

export const isQuestionEnabled = (category: string, type: string) =>
    !gameSettings.get().disabledQuestions.includes(questionKey(category, type));

/** A new radar question at a point, with the radius for the game size. */
export const newRadiusQuestion = (lat: number, lng: number) => ({
    id: "radius" as const,
    data: {
        lat,
        lng,
        radius: radarDefaultKm(gameSettings.get().size),
        unit: "kilometers" as const,
    },
});
