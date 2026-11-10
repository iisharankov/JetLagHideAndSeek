import { useStore } from "@nanostores/react";
import { Circle, Polyline } from "react-leaflet";

import { questions } from "@/lib/context";
import { gameRole, gameState } from "@/lib/game/session";
import { currentPosition } from "@/lib/geolocation";

/**
 * A thermometer under way, on the seekers' map: the line from its start to
 * where the phone is now (the dashed circle of its distance is the
 * question's own outline, drawn with the questions waiting).
 */
export const ThermometerTravel = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $here = useStore(currentPosition);
    const $questions = useStore(questions);
    if (!$game || $role !== "seeker" || !$here) return null;
    return $questions
        .flatMap((question) =>
            question.id === "thermometer" &&
            $game.questions[String(question.key)]?.state === "armed"
                ? [question]
                : [],
        )
        .map((question) => (
            <Polyline
                key={question.key}
                positions={[
                    [question.data.latA, question.data.lngA],
                    [$here.latitude, $here.longitude],
                ]}
                // Leaflet takes these when the line is made (not as later
                // style changes).
                className="thermometer-travel"
                interactive={false}
                pathOptions={{ color: "#0284c7", weight: 3 }}
            />
        ));
};

/**
 * A game's draft thermometer, before it's started (round 47): the circle
 * of its distance around the start, dashed, so the seekers see how far
 * they must go, and which stations and lines get them out of it.
 */
export const ThermometerRing = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $questions = useStore(questions);
    if (!$game || $role !== "seeker") return null;
    return $questions
        .flatMap((question) => {
            if (question.id !== "thermometer" || question.data.hidden) {
                return [];
            }
            const state = $game.questions[String(question.key)]?.state;
            return state === undefined || state === "draft" ? [question] : [];
        })
        .map((question) => (
            <Circle
                key={question.key}
                center={[question.data.latA, question.data.lngA]}
                radius={question.data.distanceKm * 1000}
                className="thermometer-ring"
                interactive={false}
                pathOptions={{
                    color: "#9c2bcb",
                    weight: 3,
                    dashArray: "8 6",
                    fill: false,
                }}
            />
        ));
};
