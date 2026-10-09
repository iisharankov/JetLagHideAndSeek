import * as turf from "@turf/turf";
import * as L from "leaflet";
import { toast } from "react-toastify";

import {
    animateMapMovements,
    autoZoom,
    busy,
    hiderMode,
    leafletMapContext,
    mapGeoJSON,
    planningModeEnabled,
    polyGeoJSON,
    questionFinishedMapData,
    questions,
    questionStatuses,
    triggerLocalRefresh,
} from "@/lib/context";
import { answerOf, describeAnswer } from "@/lib/game/answers";
import { gameRole, gameState, suggestedAnswers } from "@/lib/game/session";
import { roleOnMap } from "@/lib/game/sync";
import { createLatestRunner } from "@/lib/jobs";
import {
    applyQuestionsToMapGeoData,
    hiderifyQuestion,
    holedMask,
    questionOutline,
    type QuestionStatus,
    safeUnion,
} from "@/maps";
import { clearCache, determineMapBoundaries } from "@/maps/api";
import { errorMessage } from "@/maps/errors";

/** Layers this module owns are tagged so they can be found again. */
type TaggedLayer = L.Layer & {
    questionKey?: number;
    eliminationGeoJSON?: boolean;
};

/** A question waiting for the hider's answer: its shape, nothing ruled out. */
const WAITING_STYLE: L.PathOptions = {
    color: "#60a5fa",
    weight: 3,
    dashArray: "8 6",
    fill: false,
};

/** Areas ruled out only by seekers' draft questions (speculation). */
const SPECULATIVE_STYLE: L.PathOptions = {
    color: "#f59e0b",
    fillColor: "#f59e0b",
    fillOpacity: 0.3,
    weight: 2,
    dashArray: "6 4",
};

/**
 * Hider in a shared game: hider mode suggests an answer for each question
 * waiting for one, worked out on a copy (nothing is sent until the hider
 * confirms it).
 */
const suggestAnswers = async (
    questionsToAnswer: ReturnType<typeof questions.get>,
    errors: Record<number, QuestionStatus>,
) => {
    const game = gameState.get();
    if (!game) return;
    const suggestions: ReturnType<typeof suggestedAnswers.get> = {};
    for (const question of questionsToAnswer) {
        try {
            const copy = structuredClone(question);
            copy.data.drag = true;
            await hiderifyQuestion(copy);
            suggestions[question.key] = {
                answer: answerOf(copy),
                label: describeAnswer(copy),
                basedOn: game.questions[String(question.key)].updatedAt,
            };
        } catch (error) {
            errors[question.key] = {
                state: "error",
                message: `Couldn't work out an answer: ${errorMessage(error)}`,
            };
        }
    }
    suggestedAnswers.set(suggestions);
};

const removeLayers = (map: L.Map, matches: (layer: TaggedLayer) => boolean) => {
    map.eachLayer((layer) => {
        if (matches(layer as TaggedLayer)) map.removeLayer(layer);
    });
};

const loadPlayArea = async () => {
    const loaded = mapGeoJSON.get();
    if (loaded) return loaded;

    const drawn = polyGeoJSON.get();
    if (drawn) {
        mapGeoJSON.set(drawn);
        return drawn;
    }

    const boundaries = await toast.promise(determineMapBoundaries(), {
        pending: "Loading the play area...",
    });
    mapGeoJSON.set(boundaries);
    return boundaries;
};

let focusNextRun = false;

const refresh = async () => {
    const map = leafletMapContext.get();
    if (!map) return;

    const focus = focusNextRun;
    focusNextRun = false;
    const $questions = questions.get();

    if ($questions.length === 0) await clearCache();

    let playArea;
    try {
        playArea = await loadPlayArea();
    } catch (error) {
        toast.error(`Couldn't load the play area: ${errorMessage(error)}`, {
            toastId: "play-area-error",
        });
        return;
    }

    const game = gameState.get();
    const confirmed = $questions.filter(
        (q) => roleOnMap(q, game) === "confirmed",
    );
    const speculative = $questions.filter(
        (q) => roleOnMap(q, game) === "speculative",
    );
    const waiting = $questions.filter((q) => roleOnMap(q, game) === "waiting");

    const hiderModeErrors: Record<number, QuestionStatus> = {};
    if (hiderMode.get() !== false && game && gameRole.get() === "hider") {
        await suggestAnswers(waiting, hiderModeErrors);
    } else if (hiderMode.get() !== false && !game) {
        for (const question of $questions) {
            try {
                await hiderifyQuestion(question);
            } catch (error) {
                hiderModeErrors[question.key] = {
                    state: "error",
                    message: `Couldn't answer automatically: ${errorMessage(error)}`,
                };
            }
        }
        // Show the new answers in the sidebar without re-running this refresh.
        triggerLocalRefresh.set(Math.random());
    }

    removeLayers(map, (layer) => layer.questionKey !== undefined);
    const drawOutline = (
        outline: Parameters<typeof L.geoJSON>[0],
        question: { key: number },
    ) => {
        const layer = L.geoJSON(outline) as L.GeoJSON & TaggedLayer;
        layer.questionKey = question.key;
        layer.addTo(map);
    };
    // Confirmed answers first, then the seekers' speculation on top.
    const known = await applyQuestionsToMapGeoData(
        confirmed,
        playArea,
        planningModeEnabled.get(),
        drawOutline,
    );
    const guessed = await applyQuestionsToMapGeoData(
        speculative,
        known.mapGeoData,
        planningModeEnabled.get(),
        drawOutline,
    );
    const mapGeoData = guessed.mapGeoData;
    // Questions waiting for the hider are drawn, not applied, so the hider
    // (and everyone) sees what's being asked.
    for (const question of waiting) {
        try {
            const outline = await questionOutline(question);
            if (outline) {
                const layer = L.geoJSON(outline, {
                    style: WAITING_STYLE,
                    interactive: false,
                }) as L.GeoJSON & TaggedLayer;
                layer.questionKey = question.key;
                layer.addTo(map);
            }
        } catch {
            // Nothing to draw for this one (e.g. no data for its place).
        }
    }
    questionStatuses.set({
        ...Object.fromEntries(known.statuses),
        ...Object.fromEntries(guessed.statuses),
        ...Object.fromEntries(
            waiting.map((q) => [
                q.key,
                { state: "skipped", reason: "waiting" } as QuestionStatus,
            ]),
        ),
        ...hiderModeErrors,
    });

    removeLayers(map, (layer) => layer.eliminationGeoJSON === true);
    const shading = L.geoJSON(
        turf.featureCollection([holedMask(known.mapGeoData)!]),
    ) as L.GeoJSON & TaggedLayer;
    shading.eliminationGeoJSON = true;
    shading.addTo(map);
    if (speculative.length > 0) {
        const ruledOutByGuesses = turf.difference(
            turf.featureCollection([
                safeUnion(known.mapGeoData),
                safeUnion(mapGeoData),
            ]),
        );
        if (ruledOutByGuesses) {
            const layer = L.geoJSON(ruledOutByGuesses, {
                style: SPECULATIVE_STYLE,
                interactive: false,
            }) as L.GeoJSON & TaggedLayer;
            layer.eliminationGeoJSON = true;
            layer.addTo(map);
        }
    }
    const eliminated = turf.featureCollection([holedMask(mapGeoData)!]);
    questionFinishedMapData.set(eliminated);

    if (focus && autoZoom.get()) {
        const [minLng, minLat, maxLng, maxLat] = turf.bbox(mapGeoData);
        const bounds: L.LatLngBoundsExpression = [
            [minLat, minLng],
            [maxLat, maxLng],
        ];
        if (animateMapMovements.get()) {
            map.flyToBounds(bounds);
        } else {
            map.fitBounds(bounds);
        }
    }
};

const runRefresh = createLatestRunner(() => busy.track(refresh));

/**
 * Re-applies every question to the map. Safe to call as often as you like:
 * runs never overlap, and a call made mid-run gets a fresh run afterwards.
 */
export const requestMapRefresh = (focus = false) => {
    focusNextRun ||= focus;
    return runRefresh().catch((error) => {
        console.error(error);
        toast.error(`Couldn't update the map: ${errorMessage(error)}`, {
            toastId: "refresh-error",
        });
    });
};
