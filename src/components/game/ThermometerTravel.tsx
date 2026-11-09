import { useStore } from "@nanostores/react";
import { Polyline } from "react-leaflet";

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
