import { useStore } from "@nanostores/react";

import { useTakenAway } from "@/hooks/useTakenAway";
import { summaryTitle } from "@/lib/cardText";
import {
    gameSettings,
    hiderMode,
    isLoading,
    type QuestionPatch,
    questions,
    updateQuestion,
} from "@/lib/context";
import { askedBefore, radarQuestion } from "@/lib/game/newQuestion";
import { gameState } from "@/lib/game/session";
import type { Question, RadiusQuestion } from "@/maps/schema";

import { QuestionCard, useFrozen } from "./base";
import { FixedRow, LocationButton, useWhere } from "./layout";
import { DistancePicker, kmLabel } from "./parts";

/** "My GPS · 47.3706, 8.5500" or "The pin · …": layout C's second line. */
export const whereLine = (where: string, lat: number, lng: number) =>
    `${where === "me" ? "My GPS" : "The pin"} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

export const RadiusQuestionComponent = ({
    data,
    questionKey,
    sub,
    className,
}: {
    data: RadiusQuestion;
    questionKey: number;
    sub?: string;
    className?: string;
}) => {
    const $hiderMode = useStore(hiderMode);
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const $game = useStore(gameState);
    const $settings = useStore(gameSettings);
    const set = (patch: QuestionPatch) => updateQuestion(questionKey, patch);
    // Asked or answered: what was asked is a statement, not a choice.
    const frozen = useFrozen(questionKey);
    const where = useWhere(data.lat, data.lng);
    // The game's radar distances; anything else is "custom".
    const radii = ($game?.settings ?? $settings).radarKm;
    // Radii a Curse of the Drained Brain took away.
    const gone = useTakenAway("radius").map(Number);
    const locked = !data.drag || $isLoading;
    const km = data.unit === "meters" ? data.radius / 1000 : data.radius;
    const label = `Radius
    ${
        $questions
            .filter((q) => q.id === "radius")
            .map((q) => q.key)
            .indexOf(questionKey) + 1
    }`;

    return (
        <QuestionCard
            questionKey={questionKey}
            label={label}
            sub={sub}
            className={className}
            parts={
                frozen
                    ? null
                    : {
                          first: {
                              label: "Distance",
                              render: (look) => (
                                  <DistancePicker
                                      look={look}
                                      value={km}
                                      options={radii}
                                      taken={gone}
                                      disabled={locked}
                                      asked={(km) =>
                                          askedBefore(
                                              $game,
                                              radarQuestion(
                                                  {
                                                      lat: data.lat,
                                                      lng: data.lng,
                                                  },
                                                  km,
                                              ),
                                          )
                                      }
                                      onChange={(km) =>
                                          set({
                                              radius: km,
                                              unit: "kilometers",
                                          })
                                      }
                                  />
                              ),
                          },
                          location: {
                              label: "Location",
                              render: (look) => (
                                  <LocationButton
                                      look={look}
                                      lat={data.lat}
                                      lng={data.lng}
                                      colorName={data.color}
                                      disabled={locked}
                                      onChange={(lat, lng) =>
                                          set({
                                              lat: lat ?? data.lat,
                                              lng: lng ?? data.lng,
                                          })
                                      }
                                  />
                              ),
                          },
                          sentence: (first, location) => (
                              <>
                                  Are you within {first} of {location}?
                              </>
                          ),
                          summary: {
                              title: summaryTitle(
                                  { id: "radius", data } as Question,
                                  where,
                              ),
                              sub: whereLine(where, data.lat, data.lng),
                          },
                          guess: {
                              value: data.within ? "inside" : "outside",
                              options: [
                                  { value: "inside", label: "Inside" },
                                  { value: "outside", label: "Outside" },
                              ],
                              onChange: (value) =>
                                  set({ within: value === "inside" }),
                              disabled: !!$hiderMode || locked,
                          },
                      }
            }
        >
            {frozen && (
                <FixedRow
                    first={`Within ${kmLabel(km)}`}
                    testId="radius-fact"
                    place={{ lat: data.lat, lng: data.lng }}
                />
            )}
        </QuestionCard>
    );
};
