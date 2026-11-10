// Cards → History (round 41): everything that happened this round, newest
// first: questions asked, answered and vetoed, thermometers started, photo
// questions, curses cast and cleared, cards played, moves, the end game.
// Pure, from the game's state, so every phone tells the same story.
import { answerText, label } from "./events";
import type { GameState } from "./types";

export interface HistoryEntry {
    at: number;
    kind:
        | "question"
        | "answer"
        | "photo"
        | "curse"
        | "powerup"
        | "move"
        | "hider"
        | "endgame";
    text: string;
}

export const historyEntries = (state: GameState): HistoryEntry[] => {
    const entries: HistoryEntry[] = [];
    const add = (
        at: number | null | undefined,
        kind: HistoryEntry["kind"],
        text: string,
    ) => {
        if (typeof at === "number") entries.push({ at, kind, text });
    };

    add(state.hiderReadyAt, "hider", "The hider picked their station");

    for (const entry of Object.values(state.questions)) {
        const what = label(entry.question);
        const data = entry.question.data as { armedAt?: number };
        if (entry.question.id === "thermometer" && data.armedAt) {
            add(data.armedAt, "question", `${entry.createdBy} started ${what}`);
        }
        if (entry.state !== "draft" && entry.state !== "armed") {
            add(entry.askedAt, "question", `${entry.createdBy} asked ${what}`);
        }
        if (entry.state === "answered") {
            add(
                entry.answeredAt ?? entry.updatedAt,
                "answer",
                `${entry.updatedBy} answered ${what}: ${answerText(entry.question)}`,
            );
        }
        if (entry.state === "vetoed") {
            add(entry.updatedAt, "answer", `${entry.updatedBy} vetoed ${what}`);
        }
    }

    for (const request of state.photoRequests) {
        add(
            request.askedAt,
            "photo",
            `${request.askedBy} asked for a photo: ${request.randomizedFrom ?? request.name}`,
        );
        if (request.photoId) {
            add(
                request.answeredAt,
                "photo",
                `The hider sent the photo: ${request.name}`,
            );
        } else if (request.nullAnswer) {
            add(
                request.answeredAt,
                "photo",
                `The hider can't answer the photo: ${request.name}`,
            );
        }
    }

    for (const curse of state.curses) {
        add(curse.castAt, "curse", `The hider cast ${curse.name}`);
        if (curse.clearedAt) {
            add(
                curse.clearedAt,
                "curse",
                `${curse.clearedBy ?? "The seekers"} cleared ${curse.name}`,
            );
        }
    }

    for (const powerup of state.powerups) {
        add(
            powerup.playedAt,
            "powerup",
            `${powerup.by || "The hider"} played ${powerup.name}${
                powerup.detail ? `: ${powerup.detail}` : ""
            }`,
        );
    }

    for (const move of state.moves ?? []) {
        add(
            move.at,
            "move",
            `The hider moved${move.station ? ` from ${move.station.name}` : ""}`,
        );
    }

    if (state.endgame) {
        add(
            state.endgame.startedAt,
            "endgame",
            state.endgame.byHider
                ? "The hider started the end game"
                : `${state.endgame.by ?? "The seekers"} started the end game at ${state.endgame.station.name}`,
        );
    }

    return entries.sort((a, b) => b.at - a.at);
};
