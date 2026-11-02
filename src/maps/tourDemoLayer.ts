// Draws the tutorial's examples (lib/tourDemo.ts) on the map, in a pane of
// their own above the game's shading, and puts the map back where it was
// when the tour ends. Loaded only when a tour shows an example.
import * as turf from "@turf/turf";
import * as L from "leaflet";

import { leafletMapContext, mapBottomInset } from "@/lib/context";
import { DEMO_ZONE_KM, type DemoId, demoScene } from "@/lib/tourDemo";

const PANE = "tourDemo";
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
    });

export const showDemo = (id: DemoId) => {
    const map = leafletMapContext.get();
    if (!map) return;
    if (!map.getPane(PANE)) {
        // Above the shading and the zones (400), under markers (600).
        map.createPane(PANE).style.zIndex = "450";
    }
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
    // Clear of the tutorial's note: at the bottom on a phone (above the
    // sidebar button), at the top on a bigger screen.
    const phone = window.innerWidth < 768;
    map.fitBounds(scene.bounds, {
        paddingTopLeft: [16, phone ? 16 : 60],
        paddingBottomRight: [16, (phone ? 240 : 16) + mapBottomInset.get()],
    });
};

/** Takes the example off the map; at the tour's end, the map goes back. */
export const clearDemo = (restoreView: boolean) => {
    layer?.remove();
    layer = null;
    const map = leafletMapContext.get();
    if (restoreView && before && map) {
        map.setView(before.center, before.zoom);
    }
    if (restoreView) before = null;
};
