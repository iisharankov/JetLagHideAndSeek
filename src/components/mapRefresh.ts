import * as turf from "@turf/turf";
import type { Feature, FeatureCollection } from "geojson";
import * as L from "leaflet";
import { toast } from "react-toastify";

import {
    activeQuestionKey,
    animateMapMovements,
    autoZoom,
    busy,
    draftsOnMap,
    endgame,
    hidingRadius,
    hidingRadiusUnits,
    leafletMapContext,
    mapBottomInset,
    mapGeoJSON,
    planningModeEnabled,
    polyGeoJSON,
    questionFinishedMapData,
    questions,
    questionStatuses,
} from "@/lib/context";
import { answerOf, describeAnswer } from "@/lib/game/answers";
import { draftsToApply } from "@/lib/game/drafts";
import { gameState, hiderPhone, suggestedAnswers } from "@/lib/game/session";
import { roleOnMap } from "@/lib/game/sync";
import type { Endgame } from "@/lib/game/types";
import { createLatestRunner } from "@/lib/jobs";
import {
    applyQuestionsToMapGeoData,
    hiderifyQuestion,
    holedMask,
    questionOutline,
    type QuestionStatus,
    safeUnion,
} from "@/maps";
import { clearCache, determineMapBoundaries, ICON_COLORS } from "@/maps/api";
import { errorMessage } from "@/maps/errors";
import type { Question } from "@/maps/schema";

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

/** Areas ruled out only by a seekers' draft question (speculation), in its colour. */
const speculativeStyle = (color: string): L.PathOptions => ({
    color,
    fillColor: color,
    fillOpacity: 0.3,
    weight: 2,
    dashArray: "6 4",
});

/** A draft's colour: its pin's, amber without one. */
const draftColor = (question: Question) =>
    ICON_COLORS[
        (question.data as { color?: string }).color as keyof typeof ICON_COLORS
    ] ?? "#f59e0b";

// What was worked out last time is kept, so a refresh only recomputes what
// changed: each area object gets an id, the engine remembers each
// question's result by the chain of questions before it (see
// applyQuestionsToMapGeoData), and the masks and draft patches are kept by
// the same keys.

const areaIds = new WeakMap<object, number>();
let nextAreaId = 1;
/** Identifies an area object (the play area, clipped or not). */
const areaKey = (area: object) => {
    let id = areaIds.get(area);
    if (id === undefined) {
        id = nextAreaId++;
        areaIds.set(area, id);
    }
    return `area:${id}`;
};

/** The newest few results by key. */
const keepLatest = <T>(size: number) => {
    const entries = new Map<string, T>();
    return (key: string, compute: () => T): T => {
        if (entries.has(key)) return entries.get(key)!;
        const value = compute();
        entries.set(key, value);
        if (entries.size > size) entries.delete(entries.keys().next().value!);
        return value;
    };
};
const masks = keepLatest<Feature | null>(8);
const patches = keepLatest<Feature | null>(16);
const clippedAreas = keepLatest<FeatureCollection>(2);

/**
 * The end game: the seekers picked the hider's station, so only its zone is
 * left (and the questions from before no longer apply).
 */
const endgameArea = (
    playArea: FeatureCollection,
    $endgame: Endgame,
): FeatureCollection => {
    const radius = hidingRadius.get();
    const units = hidingRadiusUnits.get();
    const key = `${areaKey(playArea)}|${$endgame.station.lat},${$endgame.station.lng}|${radius} ${units}`;
    return clippedAreas(key, () => {
        const circle = turf.circle(
            [$endgame.station.lng, $endgame.station.lat],
            turf.convertLength(radius, units, "kilometers"),
            { steps: 64, units: "kilometers" },
        );
        const inside = turf.intersect(
            turf.featureCollection([
                safeUnion(playArea as FeatureCollection<any>),
                circle,
            ]),
        );
        return turf.featureCollection([inside ?? circle]);
    });
};

/**
 * Hider in a shared game: hider mode suggests an answer for each question
 * waiting for one, worked out on a copy (nothing is sent until the hider
 * confirms it).
 */
const suggestAnswers = async (
    questionsToAnswer: Question[],
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

/**
 * Playing alone in hider mode: the answers follow the hider pin. They are
 * worked out on copies, and the questions whose answer changed are written
 * back (which brings the refresh round once more, cheaply, as the rest is
 * remembered). A question the player changed meanwhile is left alone.
 */
const answerFromPin = async (
    inPlay: Question[],
    errors: Record<number, QuestionStatus>,
) => {
    const answered: Question[] = [];
    for (const question of inPlay) {
        if (!question.data.drag) {
            answered.push(question);
            continue;
        }
        try {
            const copy = await hiderifyQuestion(structuredClone(question));
            answered.push(
                JSON.stringify(copy.data) === JSON.stringify(question.data)
                    ? question
                    : copy,
            );
        } catch (error) {
            errors[question.key] = {
                state: "error",
                message: `Couldn't answer automatically: ${errorMessage(error)}`,
            };
            answered.push(question);
        }
    }
    const changed = new Map(
        answered.filter((q, i) => q !== inPlay[i]).map((q) => [q.key, q]),
    );
    if (changed.size > 0) {
        const seen = new Map(inPlay.map((q) => [q.key, q]));
        questions.set(
            questions
                .get()
                .map((q) =>
                    changed.has(q.key) && seen.get(q.key) === q
                        ? changed.get(q.key)!
                        : q,
                ),
        );
    }
    return answered;
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
/** The key of the area last handed to the hiding zones. */
let eliminatedKey = "";
/** The area of the last refresh: a new one is worth zooming to. */
let lastBaseKey = "";

const refresh = async () => {
    const map = leafletMapContext.get();
    if (!map) return;

    const focus = focusNextRun;
    focusNextRun = false;
    const $questions = questions.get();

    if ($questions.length === 0) await clearCache();

    let playArea: FeatureCollection;
    try {
        playArea = await loadPlayArea();
    } catch (error) {
        toast.error(`Couldn't load the play area: ${errorMessage(error)}`, {
            toastId: "play-area-error",
        });
        return;
    }

    const $endgame = endgame.get();
    const before = new Set($endgame?.before ?? []);
    let inPlay = $endgame
        ? $questions.filter((q) => !before.has(q.key))
        : $questions;
    if ($endgame) playArea = endgameArea(playArea, $endgame);
    const baseKey = areaKey(playArea);
    const areaChanged = baseKey !== lastBaseKey;
    lastBaseKey = baseKey;

    const game = gameState.get();
    const hider = hiderPhone.get();
    const hiderModeErrors: Record<number, QuestionStatus> = {};
    if (hider && !game) inPlay = await answerFromPin(inPlay, hiderModeErrors);

    const confirmed = inPlay.filter((q) => roleOnMap(q, game) === "confirmed");
    const drafts = inPlay.filter((q) => roleOnMap(q, game) === "speculative");
    // All drafts, or only the active card's (the others just outlined).
    const speculative = game
        ? draftsToApply(drafts, draftsOnMap.get(), activeQuestionKey.get())
        : drafts;
    const outlinedDrafts = drafts.filter((q) => !speculative.includes(q));
    const waiting = inPlay.filter((q) => roleOnMap(q, game) === "waiting");
    const vetoed = inPlay.filter((q) => roleOnMap(q, game) === "vetoed");
    if (hider && game) await suggestAnswers(waiting, hiderModeErrors);

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
        baseKey,
    );
    // Each draft on its own, so its ruled-out area can be drawn in its colour.
    const guessedStatuses = new Map<number, QuestionStatus>();
    const patched: { question: Question; area: Feature }[] = [];
    let current = known.mapGeoData;
    let currentKey = known.key;
    for (const draft of speculative) {
        const step = await applyQuestionsToMapGeoData(
            [draft],
            current,
            planningModeEnabled.get(),
            drawOutline,
            currentKey,
        );
        for (const [key, status] of step.statuses)
            guessedStatuses.set(key, status);
        if (step.mapGeoData !== current) {
            const from = current;
            const area = patches(step.key, () => {
                try {
                    return turf.difference(
                        turf.featureCollection([
                            safeUnion(from),
                            safeUnion(step.mapGeoData),
                        ]),
                    );
                } catch {
                    // Nothing drawable for this draft.
                    return null;
                }
            });
            if (area) patched.push({ question: draft, area });
        }
        current = step.mapGeoData;
        currentKey = step.key;
    }
    const mapGeoData = current;
    for (const question of outlinedDrafts) {
        try {
            const outline = await questionOutline(question);
            if (outline) {
                const layer = L.geoJSON(outline, {
                    style: {
                        color: draftColor(question),
                        weight: 2,
                        dashArray: "4 4",
                        fill: false,
                    },
                    interactive: false,
                }) as L.GeoJSON & TaggedLayer;
                layer.questionKey = question.key;
                layer.addTo(map);
            }
        } catch {
            // Nothing to draw for this one.
        }
    }
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
        ...Object.fromEntries(guessedStatuses),
        ...Object.fromEntries(
            outlinedDrafts.map((q) => [
                q.key,
                {
                    state: "skipped",
                    reason: "inactive-draft",
                } as QuestionStatus,
            ]),
        ),
        ...Object.fromEntries(
            waiting.map((q) => [
                q.key,
                { state: "skipped", reason: "waiting" } as QuestionStatus,
            ]),
        ),
        ...Object.fromEntries(
            vetoed.map((q) => [
                q.key,
                { state: "skipped", reason: "vetoed" } as QuestionStatus,
            ]),
        ),
        ...Object.fromEntries(
            $questions
                .filter((q) => before.has(q.key))
                .map((q) => [
                    q.key,
                    {
                        state: "skipped",
                        reason: "before-endgame",
                    } as QuestionStatus,
                ]),
        ),
        ...hiderModeErrors,
    });

    removeLayers(map, (layer) => layer.eliminationGeoJSON === true);
    const knownMask = masks(known.key, () => holedMask(known.mapGeoData));
    const shading = L.geoJSON(
        turf.featureCollection([knownMask!]),
    ) as L.GeoJSON & TaggedLayer;
    shading.eliminationGeoJSON = true;
    shading.addTo(map);
    for (const patch of patched) {
        const layer = L.geoJSON(patch.area, {
            style: speculativeStyle(draftColor(patch.question)),
            interactive: false,
        }) as L.GeoJSON & TaggedLayer;
        layer.eliminationGeoJSON = true;
        layer.addTo(map);
    }
    // The hiding zones follow what's left; they only recompute when it changed.
    if (
        currentKey !== eliminatedKey ||
        questionFinishedMapData.get() === null
    ) {
        eliminatedKey = currentKey;
        const mask = masks(currentKey, () => holedMask(mapGeoData));
        questionFinishedMapData.set(turf.featureCollection([mask!]));
    }

    // Auto-zoom follows every change; otherwise only a new play area (or the
    // end game's zone) moves the map.
    if (focus && (autoZoom.get() || areaChanged)) {
        const [minLng, minLat, maxLng, maxLat] = turf.bbox(mapGeoData);
        const bounds: L.LatLngBoundsExpression = [
            [minLat, minLng],
            [maxLat, maxLng],
        ];
        const options: L.FitBoundsOptions = {
            paddingBottomRight: [0, mapBottomInset.get()],
        };
        if (animateMapMovements.get()) {
            map.flyToBounds(bounds, options);
        } else {
            map.fitBounds(bounds, options);
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
