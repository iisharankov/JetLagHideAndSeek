// While the play area is being chosen: one admin level's areas in view
// (cantons, districts or municipalities), outlined on the map to tap in or
// out. Green: in the play area; red: cut out of it. Started by the play
// area bar (components/PlayAreaBar.tsx); the logic is lib/playAreaPick.ts.
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import * as L from "leaflet";
import { toast } from "react-toastify";

import {
    additionalMapGeoLocations,
    leafletMapContext,
    mapGeoLocation,
    playAreaDrawing,
    playAreaEditing,
} from "@/lib/context";
import {
    applyPlaces,
    currentPlaces,
    holdMapView,
    pickHint,
    pickLevel,
    pickMode,
    placeStatus,
    plural,
    tapPlace,
} from "@/lib/playAreaPick";
import { adminLevelLabel } from "@/maps/adminBorders";
import { zoneToPlace } from "@/maps/api/geocode";
import { ADMIN_LEVELS } from "@/maps/datasets/categories";
import { datasets } from "@/maps/datasets/load";

type Zone = Feature<Polygon | MultiPolygon, Record<string, any>>;

const PANE = "playAreaPick";
/** More than this in view: too many to tap, and slow to draw. */
const MAX_SHOWN = 600;

const STYLES = {
    added: {
        color: "#15803d",
        weight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.35,
    },
    cut: {
        color: "#b91c1c",
        weight: 2,
        fillColor: "#ef4444",
        fillOpacity: 0.35,
    },
    none: {
        color: "#334155",
        weight: 1,
        fillColor: "#64748b",
        fillOpacity: 0.06,
    },
};

let layer: L.GeoJSON | null = null;
/** Each redraw's number: a slower, older one doesn't draw over a newer one. */
let drawing = 0;

const clear = () => {
    layer?.remove();
    layer = null;
};

const nameOf = (zone: Zone) =>
    String(zone.properties["name:en"] ?? zone.properties.name ?? "");

/** A tap: the area in or out, with the areas around it for "replaces". */
const tap = async (zone: Zone) => {
    const level = Number(zone.properties.admin_level);
    const [lng, lat] = turf.pointOnFeature(zone).geometry.coordinates;
    const inside: number[] = [];
    for (const lower of ADMIN_LEVELS) {
        if (lower >= level) break;
        const around = await datasets.adminZoneAt(lat, lng, lower);
        if (around) inside.push(Number(around.properties?.id));
    }
    const place = await zoneToPlace(zone as never);
    const next = tapPlace(currentPlaces(), place, pickMode.get(), inside);
    if (!next) {
        toast.info("The play area needs at least one area.", {
            toastId: "play-area-empty",
        });
        return;
    }
    holdMapView.set(true);
    applyPlaces(next);
};

const redraw = async () => {
    const run = ++drawing;
    const map = leafletMapContext.get();
    const level = pickLevel.get();
    if (
        !map ||
        playAreaEditing.get() === false ||
        level === null ||
        playAreaDrawing.get()
    ) {
        clear();
        pickHint.set("");
        return;
    }
    if (!map.getPane(PANE)) {
        // Above the play area's shading (400), under the markers (600).
        map.createPane(PANE).style.zIndex = "420";
    }
    // The view, clipped to what the data covers (zoomed out, the view
    // reaches past it, and the data only answers for boxes it covers).
    const view = map.getBounds();
    const covered = (await datasets.manifest())?.bbox;
    const box: [number, number, number, number] | null = covered
        ? [
              Math.max(view.getWest(), covered[0]),
              Math.max(view.getSouth(), covered[1]),
              Math.min(view.getEast(), covered[2]),
              Math.min(view.getNorth(), covered[3]),
          ]
        : null;
    const zones =
        box && box[0] < box[2] && box[1] < box[3]
            ? ((await datasets.adminZonesIn(level, box)) as Zone[] | undefined)
            : undefined;
    if (run !== drawing) return;
    const label = plural(
        adminLevelLabel(level, mapGeoLocation.get().properties.countrycode),
    );
    if (!zones) {
        clear();
        pickHint.set("No map data here: search or draw instead.");
        return;
    }
    if (zones.length > MAX_SHOWN) {
        clear();
        pickHint.set(`Zoom in to see the ${label}.`);
        return;
    }
    pickHint.set(
        zones.length === 0 ? `No ${label} here: move or zoom out.` : "",
    );
    const area = currentPlaces();
    clear();
    layer = L.geoJSON(turf.featureCollection(zones), {
        pane: PANE,
        bubblingMouseEvents: false,
        style: (zone) =>
            STYLES[
                placeStatus(area, Number(zone?.properties?.id)) === "added"
                    ? "added"
                    : placeStatus(area, Number(zone?.properties?.id)) === "cut"
                      ? "cut"
                      : "none"
            ],
        onEachFeature: (zone, shape) => {
            shape.bindTooltip(nameOf(zone as Zone), {
                sticky: true,
                direction: "top",
                className: "play-area-pick-label",
            });
            shape.on("click", () => void tap(zone as Zone));
        },
    } as L.GeoJSONOptions).addTo(map);
};

/** Keeps the areas on the map in step; returns the function that stops it. */
export const startPickLayer = () => {
    const update = () => void redraw();
    const stores = [
        pickLevel,
        playAreaEditing,
        playAreaDrawing,
        mapGeoLocation,
        additionalMapGeoLocations,
        leafletMapContext,
    ];
    const unbind = stores.map((store) => store.listen(update));
    let map = leafletMapContext.get();
    map?.on("moveend", update);
    const follow = leafletMapContext.listen((next) => {
        map?.off("moveend", update);
        map = next;
        map?.on("moveend", update);
    });
    update();
    return () => {
        unbind.forEach((stop) => stop());
        follow();
        map?.off("moveend", update);
        drawing++;
        clear();
        pickHint.set("");
    };
};
