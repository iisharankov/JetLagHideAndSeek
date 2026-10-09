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
import { createLatestRunner } from "@/lib/jobs";
import {
    applyQuestionsToMapGeoData,
    hiderifyQuestion,
    holedMask,
    type QuestionStatus,
} from "@/maps";
import { clearCache, determineMapBoundaries } from "@/maps/api";
import { errorMessage } from "@/maps/errors";

/** Layers this module owns are tagged so they can be found again. */
type TaggedLayer = L.Layer & {
    questionKey?: number;
    eliminationGeoJSON?: boolean;
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

    const hiderModeErrors: Record<number, QuestionStatus> = {};
    if (hiderMode.get() !== false) {
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
    const { mapGeoData, statuses } = await applyQuestionsToMapGeoData(
        $questions,
        playArea,
        planningModeEnabled.get(),
        (outline, question) => {
            const layer = L.geoJSON(outline) as L.GeoJSON & TaggedLayer;
            layer.questionKey = question.key;
            layer.addTo(map);
        },
    );
    questionStatuses.set({
        ...Object.fromEntries(statuses),
        ...hiderModeErrors,
    });

    const eliminated = turf.featureCollection([holedMask(mapGeoData)!]);
    removeLayers(map, (layer) => layer.eliminationGeoJSON === true);
    const shading = L.geoJSON(eliminated) as L.GeoJSON & TaggedLayer;
    shading.eliminationGeoJSON = true;
    shading.addTo(map);
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
