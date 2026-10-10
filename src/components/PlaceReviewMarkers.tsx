import { useStore } from "@nanostores/react";
import * as L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

import { mapGeoJSON, placeReview } from "@/lib/context";
import {
    isRejected,
    localRejections,
    rejectedPlacesByArea,
    reviewCounts,
    setLocalRejections,
    toggleRejection,
} from "@/lib/placeRules";
import { type PlaceKind, reviewPlaces } from "@/maps/questions/places";

/**
 * While reviewing places (game setup): a pin for every place of the chosen
 * kind, red when rejected. Its popup names it and rejects or restores it.
 */
export const PlaceReviewMarkers = () => {
    const map = useMap();
    const $review = useStore(placeReview);
    const $local = useStore(rejectedPlacesByArea);
    const $area = useStore(mapGeoJSON);
    const kind = $review?.kind;

    useEffect(() => {
        if (!kind || !$area) {
            reviewCounts.set({
                loading: false,
                total: 0,
                rejected: 0,
                merged: 0,
            });
            return;
        }
        const layer = L.layerGroup().addTo(map);
        let cancelled = false;
        reviewCounts.set({ loading: true, total: 0, rejected: 0, merged: 0 });
        reviewPlaces(kind as PlaceKind)
            .then(({ places, merged }) => {
                if (cancelled) return;
                const list = localRejections();
                let rejected = 0;
                for (const place of places) {
                    const [lng, lat] = place.geometry.coordinates;
                    const name =
                        (place.properties?.name as string | undefined) ??
                        "(unnamed)";
                    const out = isRejected(kind, name, lat, lng, list);
                    if (out) rejected += 1;
                    const marker = L.circleMarker([lat, lng], {
                        radius: 7,
                        color: out ? "#f87171" : "#2563eb",
                        weight: 2,
                        fillColor: out ? "#f87171" : "#60a5fa",
                        fillOpacity: out ? 0.2 : 0.7,
                    });
                    const content = document.createElement("div");
                    content.className = "flex flex-col gap-1 text-sm";
                    const title = document.createElement("strong");
                    title.textContent = out ? `${name} (rejected)` : name;
                    content.append(title);
                    const button = document.createElement("button");
                    button.type = "button";
                    button.textContent = out
                        ? "Keep this place"
                        : "Reject this place";
                    button.className =
                        "rounded-md bg-slate-700 px-2 py-1 text-xs text-white";
                    button.onclick = () => {
                        setLocalRejections(
                            toggleRejection(localRejections(), {
                                kind,
                                name,
                                lat,
                                lng,
                            }),
                        );
                        map.closePopup();
                    };
                    content.append(button);
                    marker.bindPopup(content).addTo(layer);
                }
                reviewCounts.set({
                    loading: false,
                    total: places.length,
                    rejected,
                    merged,
                });
            })
            .catch(() => {
                if (!cancelled) {
                    reviewCounts.set({
                        loading: false,
                        total: 0,
                        rejected: 0,
                        merged: 0,
                    });
                }
            });
        return () => {
            cancelled = true;
            layer.remove();
        };
    }, [map, kind, $local, $area]);

    return null;
};
