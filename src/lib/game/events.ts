// What changed between two states of a shared game, as things a player must
// hear about: a toast, a buzz, a popup. Pure, so it's easy to test; the
// phones decide how to show each kind (GamePopups.tsx).
import type { Question } from "@/maps/schema";

import { describeAnswer } from "./answers";
import { kindLabel } from "./curseRules";
import type { GameState, Role, SharedQuestion } from "./types";

export interface GameEvent {
    key: string;
    kind:
        | "question"
        | "answer"
        | "photoRequest"
        | "photo"
        | "endgame"
        | "curse"
        | "powerup"
        | "move"
        | "award"
        | "hider"
        | "round";
    title: string;
    body?: string;
    /** The card's name, for curses and powerups. */
    name?: string;
}

const LABELS: Record<string, string> = {
    radius: "Radar",
    thermometer: "Thermometer",
    tentacles: "Tentacles",
    matching: "Matching",
    measuring: "Measuring",
};

const label = (question: SharedQuestion) => {
    const data = question.data as {
        type?: string;
        locationType?: string;
        radius?: number;
        unit?: string;
    };
    const category = LABELS[question.id] ?? question.id;
    if (question.id === "radius" && typeof data.radius === "number") {
        const unit = data.unit === "kilometers" ? "km" : (data.unit ?? "km");
        return `${category} ${data.radius} ${unit}`;
    }
    const type = data.type ?? data.locationType;
    return type
        ? `${category} (${String(type).replace(/[-_]/g, " ")})`
        : category;
};

const answerText = (question: SharedQuestion) => {
    try {
        return describeAnswer(question as unknown as Question);
    } catch {
        return "answered";
    }
};

/** The news in `after` compared with `before`, for a player in this role. */
export const gameEvents = (
    before: GameState | null,
    after: GameState,
    role: Role,
): GameEvent[] => {
    // The first state of a game: nothing is news yet.
    if (!before || before.id !== after.id) return [];
    const events: GameEvent[] = [];

    for (const [key, entry] of Object.entries(after.questions)) {
        const previous = before.questions[key];
        if (role === "hider") {
            if (
                entry.state === "asked" &&
                previous?.state !== "asked" &&
                previous?.state !== "answered" &&
                previous?.state !== "vetoed"
            ) {
                events.push({
                    key: `q${key}`,
                    kind: "question",
                    title: "New question",
                    body: `${label(entry.question)}, from ${entry.updatedBy}`,
                });
            }
        } else {
            if (
                entry.state === "answered" &&
                previous &&
                previous.state !== "answered"
            ) {
                events.push({
                    key: `a${key}:${entry.updatedAt}`,
                    kind: "answer",
                    title: "Answered",
                    body: `${label(entry.question)}: ${answerText(entry.question)}`,
                });
            }
            if (entry.state === "vetoed" && previous?.state !== "vetoed") {
                events.push({
                    key: `v${key}`,
                    kind: "answer",
                    title: "Vetoed",
                    body: `${label(entry.question)}: the hider gave no answer`,
                });
            }
        }
    }

    // A new round: everyone says who they are again.
    if (after.rounds.length > before.rounds.length) {
        const team = after.teams.find((t) => t.id === after.hiderTeamId);
        events.push({
            key: `rd${after.rounds.length}`,
            kind: "round",
            title: `Round ${after.rounds.length + 1}`,
            body: team
                ? `Team ${team.name} hides. Say who you are.`
                : "The next hider sets a new password. Say who you are.",
        });
    }
    if (
        after.nextHiderTeamId &&
        after.nextHiderTeamId !== before.nextHiderTeamId
    ) {
        const team = after.teams.find((t) => t.id === after.nextHiderTeamId);
        events.push({
            key: `nh${after.nextHiderTeamId}`,
            kind: "round",
            title: `${team?.name ?? "A team"} hides next`,
            body: "Anyone can start the new round.",
        });
    }

    if (role === "hider") {
        for (const request of after.photoRequests) {
            if (before.photoRequests.some((b) => b.id === request.id)) continue;
            events.push({
                key: `pr${request.id}`,
                kind: "photoRequest",
                title: "Photo question",
                body: `${request.name}, from ${request.askedBy}`,
            });
        }
        if (after.endgame && !before.endgame) {
            events.push({
                key: `e${after.endgame.startedAt}`,
                kind: "endgame",
                title: "End game",
                body: `The seekers picked ${after.endgame.station.name}: answers now come from your pin`,
            });
        }
        return events;
    }

    // The hider has their station: the seekers hear that, not where.
    if (after.hiderReadyAt && after.hiderReadyAt !== before.hiderReadyAt) {
        events.push({
            key: `hr${after.hiderReadyAt}`,
            kind: "hider",
            title: "The hider is in place",
            body: "They've picked their station (not shown to you). Start the clock when you set off.",
        });
    }
    for (const photo of after.photos) {
        if (before.photos.some((b) => b.id === photo.id)) continue;
        const request = after.photoRequests.find(
            (r) => r.id === photo.requestId,
        );
        events.push({
            key: `ph${photo.id}`,
            kind: "photo",
            title: "Photo received",
            body: request?.name,
        });
    }
    for (const curse of after.curses) {
        if (before.curses.some((b) => b.id === curse.id)) continue;
        events.push({
            key: `c${curse.id}`,
            kind: "curse",
            title: `The hider cast ${curse.name}`,
            name: curse.name,
        });
    }
    for (const award of after.awards ?? []) {
        if ((before.awards ?? []).some((b) => b.id === award.id)) continue;
        events.push({
            key: `aw${award.id}`,
            kind: "award",
            title: `The hider gets ${award.minutes} minutes`,
            body: award.reason || undefined,
        });
    }
    for (const curse of after.curses) {
        const previous = before.curses.find((b) => b.id === curse.id);
        if (curse.kinds && previous && !previous.kinds) {
            events.push({
                key: `ck${curse.id}`,
                kind: "curse",
                title: "Curse of the Drained Brain took questions away",
                body: curse.kinds.map(kindLabel).join(", "),
                name: curse.name,
            });
        }
    }
    for (const powerup of after.powerups) {
        if (before.powerups.some((b) => b.id === powerup.id)) continue;
        const move = powerup.name === "Move";
        // Randomize Question: say what the question became.
        const randomized =
            powerup.name === "Randomize Question"
                ? Object.values(after.questions).find(
                      (entry) =>
                          entry.randomizedFrom &&
                          entry.updatedAt === powerup.playedAt,
                  )
                : undefined;
        const randomizedPhoto =
            powerup.name === "Randomize Question"
                ? after.photoRequests.find(
                      (request) =>
                          request.randomizedFrom &&
                          request.randomizedAt === powerup.playedAt,
                  )
                : undefined;
        events.push({
            key: `p${powerup.id}`,
            kind: move ? "move" : "powerup",
            title: `${powerup.by || "The hider"} played ${powerup.name}`,
            name: powerup.name,
            body: move
                ? `The hider is moving${
                      after.move?.station
                          ? ` and was at ${after.move.station.name}`
                          : ""
                  }. No questions until they continue; the questions so far are in Cards → History.`
                : randomized
                  ? `${randomized.randomizedFrom} became ${label(randomized.question)}; the hider answers that instead.`
                  : randomizedPhoto
                    ? `Photo: ${randomizedPhoto.randomizedFrom} became Photo: ${randomizedPhoto.name}; the hider sends that instead.`
                    : undefined,
        });
    }
    return events;
};
