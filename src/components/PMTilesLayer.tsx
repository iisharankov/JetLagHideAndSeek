import { namedFlavor } from "@protomaps/basemaps";
import type { Layer } from "leaflet";
import { labelRules, leafletLayer } from "protomaps-leaflet";
import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

import { TILES_URL } from "@/lib/config";
import { basemapPaintRules } from "@/maps/basemapStyle";
import { basemaps } from "@/maps/datasets/areas";
import { dataAreas, datasets } from "@/maps/datasets/load";

// protomaps-leaflet labels with `name:<lang>`, falling back to `name`. No
// feature has a `name:local` tag, so labels always show the local name, the
// same one that is on station signs.
const LOCAL_NAMES = "local";

/** Basemap drawn in the browser from a self-hosted Protomaps .pmtiles file. */
export const PMTilesLayer = ({
    url,
    flavor,
    bbox = null,
}: {
    url: string;
    flavor: "light" | "dark";
    /** Only inside this box: no requests for tiles the file doesn't have. */
    bbox?: [number, number, number, number] | null;
}) => {
    const map = useMap();

    useEffect(() => {
        const theme = namedFlavor(flavor);
        const layer = leafletLayer({
            url,
            paintRules: basemapPaintRules(theme),
            labelRules: labelRules(theme, LOCAL_NAMES),
            backgroundColor: theme.background,
            lang: LOCAL_NAMES,
            noWrap: true,
            ...(bbox
                ? {
                      bounds: [
                          [bbox[1], bbox[0]],
                          [bbox[3], bbox[2]],
                      ],
                  }
                : {}),
            maxDataZoom: 15,
            // Smoother zooming (round 49): every tile is drawn in the
            // browser, so none are drawn for the steps of a pinch or a
            // wheel zoom, only once it settles; more are kept around the
            // view for panning back.
            updateWhenZooming: false,
            keepBuffer: 4,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; <a href="https://protomaps.com">Protomaps</a>',
        }) as unknown as Layer;
        layer.addTo(map);
        return () => {
            map.removeLayer(layer);
        };
    }, [map, url, flavor, bbox?.join(",")]);

    return null;
};

/**
 * The self-hosted basemaps: the main file and each far area's (round 49),
 * each drawn only inside its box.
 */
export const Basemaps = ({ flavor }: { flavor: "light" | "dark" }) => {
    const [layers, setLayers] = useState(() => basemaps(TILES_URL, null, []));
    useEffect(() => {
        let cancelled = false;
        void Promise.all([datasets.manifest(), dataAreas()]).then(
            ([manifest, areas]) => {
                if (!cancelled) {
                    setLayers(
                        basemaps(TILES_URL, manifest?.bbox ?? null, areas),
                    );
                }
            },
        );
        return () => {
            cancelled = true;
        };
    }, []);
    return (
        <>
            {layers.map((layer) => (
                <PMTilesLayer
                    key={layer.url}
                    url={layer.url}
                    flavor={flavor}
                    bbox={layer.bbox}
                />
            ))}
        </>
    );
};
