// Before a question is sent from a pin away from the seekers: a line from
// where the phone is to the pin, with the map framing both, so they can see
// which is right (components/game/SendQuestion.tsx).
import * as L from "leaflet";

import { leafletMapContext, mapBottomInset } from "@/lib/context";

let line: L.Polyline | null = null;

export const showAskFrom = (
    here: { latitude: number; longitude: number },
    pin: { lat: number; lng: number },
) => {
    const map = leafletMapContext.get();
    if (!map) return;
    line?.remove();
    line = L.polyline(
        [
            [here.latitude, here.longitude],
            [pin.lat, pin.lng],
        ],
        {
            color: "#0284c7",
            weight: 3,
            dashArray: "6 6",
            interactive: false,
            className: "ask-from-line",
        },
    ).addTo(map);
    map.fitBounds(line.getBounds(), {
        paddingTopLeft: [48, 48],
        paddingBottomRight: [48, 48 + mapBottomInset.get()],
        maxZoom: 16,
    });
};

export const clearAskFrom = () => {
    line?.remove();
    line = null;
};
