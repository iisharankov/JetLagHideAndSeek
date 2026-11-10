// Draws the tutorial's examples (lib/tourDemo.ts) on the map, in a pane of
// their own above the game's shading, and puts the map back where it was
// when the tour ends. Loaded only when a tour shows an example.
import * as turf from "@turf/turf";
import * as L from "leaflet";

import { leafletMapContext, mapBottomInset } from "@/lib/context";
import { DEMO_ZONE_KM, type DemoId, demoScene } from "@/lib/tourDemo";

const PANE = "tourDemo";
/** The example's names: the game's own tooltips are hidden meanwhile. */
const LABEL_PANE = "tourDemoLabels";
/** On the map's container while an example shows: the game's layers hide (globals.css). */
const ACTIVE = "tour-demo-active";
/** Everything outside the open area, as the game's own shading does it. */
const WORLD = turf.bboxPolygon([-179, -85, 179, 85]);

let layer: L.LayerGroup | null = null;
/** Where the map was before the first example. */
let before: { center: L.LatLng; zoom: number } | null = null;

const ZONE = {
    color: "green",
    fillColor: "green",
    fillOpacity: 0.2,
    weight: 2,
};
const KEPT = { ...ZONE, weight: 4, fillOpacity: 0.35 };
/** The hider's own zone, as the app draws it on their phone. */
const MINE = { color: "red", fillColor: "red", weight: 3, fillOpacity: 0.15 };
const ENDGAME = {
    color: "#ef4444",
    weight: 3,
    dashArray: "8 6",
    fill: false,
};

const label = (marker: L.CircleMarker, text: string, left?: boolean) =>
    marker.bindTooltip(text, {
        permanent: true,
        direction: left ? "left" : "right",
        offset: [left ? -8 : 8, 0],
        className: "tour-demo-label",
        pane: LABEL_PANE,
    });

export const showDemo = (id: DemoId) => {
    const map = leafletMapContext.get();
    if (!map) return;
    if (!map.getPane(PANE)) {
        // Above the shading and the zones (400), under markers (600).
        map.createPane(PANE).style.zIndex = "450";
        map.createPane(LABEL_PANE).style.zIndex = "650";
    }
    // Only the example on the map: the game's own shading, zones, stations
    // and pins (the hider choosing a station sees them all) wait.
    map.getContainer().classList.add(ACTIVE);
    before ??= { center: map.getCenter(), zoom: map.getZoom() };
    layer?.remove();
    const scene = demoScene(id);
    const group = L.layerGroup();

    if (scene.open) {
        const shade = turf.difference(
            turf.featureCollection([WORLD, scene.open]),
        );
        if (shade) {
            L.geoJSON(shade, { pane: PANE, interactive: false }).addTo(group);
        }
    }
    for (const zone of scene.zones) {
        L.circle([zone.station.lat, zone.station.lng], {
            pane: PANE,
            interactive: false,
            radius: DEMO_ZONE_KM * 1000,
            ...(zone.style === "endgame"
                ? ENDGAME
                : zone.style === "kept"
                  ? KEPT
                  : zone.style === "mine"
                    ? MINE
                    : ZONE),
        }).addTo(group);
        L.circleMarker([zone.station.lat, zone.station.lng], {
            pane: PANE,
            interactive: false,
            radius: 2,
            color: "#111827",
            fillOpacity: 1,
        }).addTo(group);
    }
    if (scene.line) {
        L.polyline(scene.line, {
            pane: PANE,
            interactive: false,
            color: "#2563eb",
            weight: 3,
            dashArray: "6 6",
        }).addTo(group);
    }
    for (const point of scene.points) {
        const marker = L.circleMarker([point.lat, point.lng], {
            pane: PANE,
            interactive: false,
            radius: point.kind === "station" ? 3 : 7,
            color: point.kind === "pin" ? "#b91c1c" : "#1d4ed8",
            fillColor:
                point.kind === "pin"
                    ? "#ef4444"
                    : point.kind === "seekers"
                      ? "#3b82f6"
                      : "#111827",
            fillOpacity: 1,
            weight: 2,
        });
        label(marker, point.label, point.left).addTo(group);
    }

    group.addTo(map);
    layer = group;
    // Clear of the tutorial's note: at the top on a phone (the example goes
    // below it, above the tab bar), on the left on a bigger screen.
    const phone = window.innerWidth < 768;
    map.fitBounds(scene.bounds, {
        paddingTopLeft: [phone ? 16 : 360, phone ? noteBottom() + 24 : 40],
        paddingBottomRight: [16, 24 + mapBottomInset.get()],
    });
};

/**
 * Where the tutorial's note ends on a phone: the note on screen (the step
 * before's, about the same size), or a typical one below the top margin.
 */
const noteBottom = () => {
    const note = document.querySelector('[data-testid="coach-mark"]');
    const bottom = note?.getBoundingClientRect().bottom ?? 0;
    return bottom > 0 ? bottom : 64 + 200;
};

/** Takes the example off the map; at the tour's end, the map goes back. */
export const clearDemo = (restoreView: boolean) => {
    layer?.remove();
    layer = null;
    const map = leafletMapContext.get();
    map?.getContainer().classList.remove(ACTIVE);
    if (restoreView && before && map) {
        map.setView(before.center, before.zoom);
    }
    if (restoreView) before = null;
};
