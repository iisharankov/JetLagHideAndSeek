import type { Layer } from "leaflet";
import { leafletLayer } from "protomaps-leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

// protomaps-leaflet labels with `name:<lang>`, falling back to `name`. No
// feature has a `name:local` tag, so labels always show the local name, the
// same one that is on station signs.
const LOCAL_NAMES = "local";

/** Basemap drawn in the browser from a self-hosted Protomaps .pmtiles file. */
export const PMTilesLayer = ({
    url,
    flavor,
}: {
    url: string;
    flavor: "light" | "dark";
}) => {
    const map = useMap();

    useEffect(() => {
        const layer = leafletLayer({
            url,
            flavor,
            lang: LOCAL_NAMES,
            noWrap: true,
            maxDataZoom: 15,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; <a href="https://protomaps.com">Protomaps</a>',
        }) as unknown as Layer;
        layer.addTo(map);
        return () => {
            map.removeLayer(layer);
        };
    }, [map, url, flavor]);

    return null;
};
