import { persistentAtom } from "@nanostores/persistent";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Map } from "leaflet";
import { atom, computed, onSet } from "nanostores";

import type { ReferenceMode } from "@/lib/activeQuestion";
import { createBusyTracker } from "@/lib/jobs";
import { decodeStoredQuestions } from "@/lib/storage";
import type {
    AdditionalMapGeoLocations,
    CustomStation,
    OpenStreetMap,
    StationCircle,
} from "@/maps/api";
import { extractStationLabel } from "@/maps/geo-utils";
import { DEFAULT_STATION_FILTERS } from "@/maps/hidingZones";
import type { QuestionStatus } from "@/maps/index";
import { type RegionChoice, regionRulesFor } from "@/maps/regionRules";
import {
    type DeepPartial,
    type Question,
    type Questions,
    questionSchema,
    type Units,
} from "@/maps/schema";

export const mapGeoLocation = persistentAtom<OpenStreetMap>(
    "mapGeoLocation",
    {
        type: "Feature",
        properties: {
            osm_type: "R",
            osm_id: 51701,
            osm_key: "place",
            osm_value: "country",
            type: "country",
            name: "Switzerland",
            country: "Switzerland",
            countrycode: "CH",
            extent: [47.8084546, 5.9559113, 45.817995, 10.4922941],
        },
        geometry: {
            type: "Point",
            coordinates: [46.7985624, 8.2319736],
        },
    },
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

/** Which local rule adaptations to use ("auto": by the play area's country). */
export const regionChoice = persistentAtom<RegionChoice>(
    "regionChoice",
    "auto",
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const regionRules = computed(
    [regionChoice, mapGeoLocation],
    (choice, location) =>
        regionRulesFor(choice, location.properties.countrycode),
);

export const additionalMapGeoLocations = persistentAtom<
    AdditionalMapGeoLocations[]
>("additionalMapGeoLocations", [], {
    encode: JSON.stringify,
    decode: JSON.parse,
});

/** Identifies the current play area, for caching results that depend on it. */
export const playAreaKey = () =>
    JSON.stringify({
        polygon: polyGeoJSON.get(),
        base: mapGeoLocation.get().properties.osm_id,
        extra: additionalMapGeoLocations
            .get()
            .map((entry) => [entry.location.properties.osm_id, entry.added]),
    });

export const mapGeoJSON = atom<FeatureCollection<
    Polygon | MultiPolygon
> | null>(null);
export const polyGeoJSON = persistentAtom<FeatureCollection<
    Polygon | MultiPolygon
> | null>("polyGeoJSON", null, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

export const questions = persistentAtom<Questions>("questions", [], {
    encode: JSON.stringify,
    decode: decodeStoredQuestions,
});
export const addQuestion = (question: DeepPartial<Question>) => {
    const parsed = questionSchema.parse(question);
    activeQuestionKey.set(parsed.key);
    questionModified(questions.get().push(parsed));
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const questionModified = (..._: any[]) => {
    if (autoSave.get()) {
        questions.set([...questions.get()]);
    } else {
        triggerLocalRefresh.set(Math.random());
    }
};

/** Removes a question. Returns an undo function (safe to call twice). */
export const deleteQuestion = (key: number) => {
    const before = questions.get();
    const index = before.findIndex((q) => q.key === key);
    if (index === -1) return () => {};

    const removed = before[index];
    questions.set(before.filter((q) => q.key !== key));

    return () => {
        const now = questions.get();
        if (now.some((q) => q.key === key)) return;
        questions.set([...now.slice(0, index), removed, ...now.slice(index)]);
    };
};

/** Removes every question. Returns an undo function. */
export const clearQuestions = () => {
    const before = questions.get();
    questions.set([]);
    return () => {
        if (questions.get().length === 0) questions.set(before);
    };
};

export const leafletMapContext = atom<Map | null>(null);

export const defaultUnit = persistentAtom<Units>("defaultUnit", "kilometers");
export const hiderMode = persistentAtom<
    | false
    | {
          latitude: number;
          longitude: number;
      }
>("isHiderMode", false, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const triggerLocalRefresh = atom<number>(0);
export const displayHidingZones = persistentAtom<boolean>(
    "displayHidingZones",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const displayHidingZonesOptions = persistentAtom<string[]>(
    "displayHidingZonesOptions",
    DEFAULT_STATION_FILTERS,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const displayHidingZonesStyle = persistentAtom<
    "zones" | "stations" | "no-overlap" | "no-display"
>("displayHidingZonesStyle", "zones");
export const questionFinishedMapData = atom<any>(null);

export const trainStations = atom<StationCircle[]>([]);
onSet(trainStations, ({ newValue }) => {
    newValue.sort((a, b) => {
        const aName = (extractStationLabel(a.properties) || "") as string;
        const bName = (extractStationLabel(b.properties) || "") as string;
        return aName.localeCompare(bName);
    });
});

export const useCustomStations = persistentAtom<boolean>(
    "useCustomStations",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const customStations = persistentAtom<CustomStation[]>(
    "customStations",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const mergeDuplicates = persistentAtom<boolean>(
    "removeDuplicates",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
/** Draw the remaining stations as markers on top of the hiding zones. */
export const showRemainingStations = persistentAtom<boolean>(
    "showRemainingStations",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const includeDefaultStations = persistentAtom<boolean>(
    "includeDefaultStations",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const animateMapMovements = persistentAtom<boolean>(
    "animateMapMovements",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const hidingRadius = persistentAtom<number>("hidingRadius", 0.5, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const hidingRadiusUnits = persistentAtom<Units>(
    "hidingRadiusUnits",
    "kilometers",
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const disabledStations = persistentAtom<string[]>(
    "disabledStations",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
export const autoSave = persistentAtom<boolean>("autoSave", true, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const save = () => {
    questions.set([...questions.get()]);
    const $hiderMode = hiderMode.get();

    if ($hiderMode !== false) {
        hiderMode.set({ ...$hiderMode });
    }
};

/* Presets for custom questions (savable / sharable / editable) */
export type CustomPreset = {
    id: string;
    name: string;
    type: string;
    data: any;
    createdAt: string;
};

export const customPresets = persistentAtom<CustomPreset[]>(
    "customPresets",
    [],
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
onSet(customPresets, ({ newValue }) => {
    newValue.sort((a, b) => a.name.localeCompare(b.name));
});

export const saveCustomPreset = (
    preset: Omit<CustomPreset, "id" | "createdAt">,
) => {
    const id =
        typeof crypto !== "undefined" &&
        typeof (crypto as any).randomUUID === "function"
            ? (crypto as any).randomUUID()
            : String(Date.now());
    const p: CustomPreset = {
        ...preset,
        id,
        createdAt: new Date().toISOString(),
    };
    customPresets.set([...customPresets.get(), p]);
    return p;
};

export const updateCustomPreset = (
    id: string,
    updates: Partial<CustomPreset>,
) => {
    customPresets.set(
        customPresets
            .get()
            .map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
};

export const deleteCustomPreset = (id: string) => {
    customPresets.set(customPresets.get().filter((p) => p.id !== id));
};

export const hidingZone = computed(
    [
        questions,
        polyGeoJSON,
        mapGeoLocation,
        additionalMapGeoLocations,
        disabledStations,
        hidingRadius,
        hidingRadiusUnits,
        displayHidingZonesOptions,
        useCustomStations,
        customStations,
        includeDefaultStations,
        customPresets,
    ],
    (
        q,
        geo,
        loc,
        altLoc,
        disabledStations,
        radius,
        hidingRadiusUnits,
        zoneOptions,
        useCustom,
        $customStations,
        includeDefault,
        presets,
    ) => {
        if (geo !== null) {
            return {
                ...geo,
                questions: q,
                disabledStations: disabledStations,
                hidingRadius: radius,
                hidingRadiusUnits,
                zoneOptions: zoneOptions,
                useCustomStations: useCustom,
                customStations: $customStations,
                includeDefaultStations: includeDefault,
                presets: structuredClone(presets),
            };
        } else {
            const $loc = structuredClone(loc);
            $loc.properties.isHidingZone = true;
            $loc.properties.questions = q;
            return {
                ...$loc,
                disabledStations: disabledStations,
                hidingRadius: radius,
                hidingRadiusUnits,
                alternateLocations: structuredClone(altLoc),
                zoneOptions: zoneOptions,
                useCustomStations: useCustom,
                customStations: $customStations,
                includeDefaultStations: includeDefault,
                presets: structuredClone(presets),
            };
        }
    },
);

export const drawingQuestionKey = atom<number>(-1);
export const planningModeEnabled = persistentAtom<boolean>(
    "planningModeEnabled",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
/** Which questions draw their reference places (star, dots, zone outline). */
export const referencePlacesMode = persistentAtom<ReferenceMode>(
    "referencePlaces",
    "active",
);
/** The question being worked on: its card was last opened, tapped or added. */
export const activeQuestionKey = atom<number | null>(null);
export const autoZoom = persistentAtom<boolean>("autoZoom", true, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

/** Background work in progress (map refresh, hiding zones, GPS lookups). */
export const busy = createBusyTracker();
export const isLoading = busy.isBusy;

/** Per-question result of the last map refresh, keyed by question key. */
export const questionStatuses = atom<Record<number, QuestionStatus>>({});

export type BaseTileLayer = "selfhosted" | "selfhosted-dark" | "osmcarto";
export const baseTileLayer = persistentAtom<BaseTileLayer>(
    "baseTileLayer",
    (import.meta.env.PUBLIC_DEFAULT_TILE_LAYER as BaseTileLayer) ||
        "selfhosted",
);
export const followMe = persistentAtom<boolean>("followMe", false, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const defaultCustomQuestions = persistentAtom<boolean>(
    "defaultCustomQuestions",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

export const showTutorial = persistentAtom<boolean>("showTutorials", true, {
    encode: JSON.stringify,
    decode: JSON.parse,
});
export const tutorialStep = atom<number>(0);

export const customInitPreference = persistentAtom<"ask" | "blank" | "prefill">(
    "customInitPreference",
    "ask",
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);

/** Extra Overpass server tried after the app's own one (blank: none). */
export const overpassCustomHost = persistentAtom<string>(
    "overpassCustomHost",
    "",
);
/** Opt-in: fall back to public Overpass servers, which then see the queries. */
export const allowPublicOverpass = persistentAtom<boolean>(
    "allowPublicOverpass",
    false,
    {
        encode: JSON.stringify,
        decode: JSON.parse,
    },
);
