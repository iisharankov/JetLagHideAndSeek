// How the basemap is drawn: protomaps-leaflet's own rules for its theme,
// with two of its slips put right (tests/basemapStyle.test.ts checks they
// are still there). Without them a zoomed-out map of fields and forests
// looked like a dense city.
import type { Flavor } from "@protomaps/basemaps";
import {
    type Feature,
    LineSymbolizer,
    type PaintRule,
    paintRules,
    PolygonSymbolizer,
} from "protomaps-leaflet";

/** A stand-in feature, to find the rule that draws a kind of land. */
const ofKind = (kind: string) => ({ props: { kind } }) as unknown as Feature;

export const basemapPaintRules = (flavor: Flavor): PaintRule[] =>
    paintRules(flavor).map((rule) => {
        const { filter, symbolizer } = rule;
        // Footpaths, farm tracks and village streets are 0 wide when zoomed
        // out, but a canvas ignores a width of 0 and draws them at 1 px:
        // white lines all over the fields and forests. Leave them out.
        if (symbolizer instanceof LineSymbolizer) {
            return {
                ...rule,
                filter: (zoom: number, feature: Feature) =>
                    (!filter || filter(zoom, feature)) &&
                    symbolizer.width.get(zoom, feature) > 0,
            };
        }
        // Forests are meant to turn green as the map zooms in, but stay on
        // the pale end, close to the colour of open land. The green, then,
        // from where forests show at all (half at zoom 8, as before).
        if (rule.dataLayer === "landuse" && filter?.(12, ofKind("wood"))) {
            return {
                ...rule,
                symbolizer: new PolygonSymbolizer({
                    fill: flavor.wood_b,
                    opacity: (zoom: number) =>
                        zoom < 8 ? 0 : zoom === 8 ? 0.5 : 1,
                }),
            };
        }
        return rule;
    });
