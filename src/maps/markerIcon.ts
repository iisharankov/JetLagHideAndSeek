import { Icon } from "leaflet";

import { ICON_COLORS } from "@/maps/api/constants";

// Pins are drawn as inline SVG so the map never fetches marker images from
// a third-party host (and keeps working without network).
const pinSvg = (fill: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">` +
    `<path d="M12.5.5C5.87.5.5 5.87.5 12.5c0 2.4.7 4.6 1.9 6.5l10.1 21.5 10.1-21.5c1.2-1.9 1.9-4.1 1.9-6.5C24.5 5.87 19.13.5 12.5.5z" fill="${fill}" stroke="#fff" stroke-opacity=".7"/>` +
    `<circle cx="12.5" cy="12.5" r="4.6" fill="#fff"/></svg>`;

const icons = new Map<keyof typeof ICON_COLORS, Icon>();

export const markerIcon = (color: keyof typeof ICON_COLORS): Icon => {
    let icon = icons.get(color);
    if (!icon) {
        icon = new Icon({
            iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(ICON_COLORS[color]))}`,
            shadowUrl: `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}marker-shadow.png`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
        });
        icons.set(color, icon);
    }
    return icon;
};

// The hider's own position (hider mode): a black pin with a yellow "hidden"
// eye and a HIDER label, so it can't be mistaken for a question's pin.
const hiderSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="64" viewBox="0 0 44 64">` +
    `<rect x="2" y="1" width="40" height="13" rx="6.5" fill="#111827" stroke="#facc15" stroke-width="1.5"/>` +
    `<text x="22" y="11" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="#facc15">HIDER</text>` +
    `<path d="M22 17C13.7 17 7 23.7 7 32c0 3 .8 5.8 2.3 8.2L22 63l12.7-22.8C36.2 37.8 37 35 37 32c0-8.3-6.7-15-15-15z" fill="#111827" stroke="#facc15" stroke-width="2"/>` +
    `<g transform="translate(13 23) scale(.75)" fill="none" stroke="#facc15" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>` +
    `<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>` +
    `<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>` +
    `<path d="m2 2 20 20"/></g></svg>`;

let hider: Icon | undefined;

export const hiderIcon = (): Icon =>
    (hider ??= new Icon({
        iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(hiderSvg)}`,
        iconSize: [44, 64],
        iconAnchor: [22, 63],
        popupAnchor: [0, -60],
        className: "hider-marker",
    }));
