import { useStore } from "@nanostores/react";
import * as L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

import { questionsToReference } from "@/lib/activeQuestion";
import {
    activeQuestionKey,
    mapGeoJSON,
    questions,
    referencePlacesMode,
} from "@/lib/context";
import { escapeHtml } from "@/lib/html";
import { ICON_COLORS } from "@/maps/api";
import { questionReference } from "@/maps/references";
import type { Question } from "@/maps/schema";

// Draws what each question measures against (see maps/references.ts): a
// star on the seeker's reference place, dots on the other candidates and the
// seeker's zone outline, for the active question (or all, or none: see
// the Map settings). Hidden questions draw nothing.

const colorOf = (question: Question) =>
    ICON_COLORS[
        ((question.data as any).color ?? "black") as keyof typeof ICON_COLORS
    ] ?? ICON_COLORS.black;

const starIcon = (color: string) =>
    L.divIcon({
        html: `<div style="color:${color};font-size:22px;line-height:22px;text-shadow:0 0 2px #fff,0 0 2px #fff">★</div>`,
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });

export const ReferenceMarkers = () => {
    const map = useMap();
    const $questions = useStore(questions);
    const $mode = useStore(referencePlacesMode);
    const $active = useStore(activeQuestionKey);
    const $area = useStore(mapGeoJSON);

    useEffect(() => {
        const layer = L.layerGroup().addTo(map);
        const renderer = L.canvas({ padding: 0.5 });
        const shown = questionsToReference($questions, $mode, $active);
        if (shown.length === 0 || !$area) return () => void layer.remove();

        let cancelled = false;
        const draw = async () => {
            for (const question of shown) {
                const reference = await questionReference(question).catch(
                    () => null,
                );
                if (cancelled || !reference) continue;
                const color = colorOf(question);

                if (reference.outline) {
                    L.geoJSON(reference.outline, {
                        interactive: false,
                        style: {
                            color,
                            weight: 3,
                            dashArray: "6 6",
                            fill: false,
                        },
                    }).addTo(layer);
                }
                for (const dot of reference.dots) {
                    L.circleMarker([dot.lat, dot.lng], {
                        renderer,
                        radius: 3,
                        color,
                        weight: 1,
                        fillOpacity: 0.8,
                    })
                        .bindTooltip(escapeHtml(dot.name ?? ""))
                        .addTo(layer);
                }
                if (reference.star) {
                    L.marker([reference.star.lat, reference.star.lng], {
                        icon: starIcon(color),
                        keyboard: false,
                    })
                        .bindTooltip(
                            escapeHtml(reference.star.name ?? "Reference"),
                        )
                        .addTo(layer);
                }
            }
        };
        draw().catch(() => undefined);

        return () => {
            cancelled = true;
            layer.remove();
        };
    }, [map, $questions, $mode, $active, $area]);

    return null;
};
