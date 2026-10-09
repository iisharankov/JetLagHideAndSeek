// Mirroring a shared game's questions on this phone. Pure functions; the
// connection and timing live in session.ts.
import { type Question, questionSchema } from "@/maps/schema";

import {
    type GameOp,
    type GameState,
    LOCAL_FIELDS,
    type SharedQuestion,
} from "./types";

/** A question without this phone's own view settings (collapsed etc.). */
export const toShared = (question: Question): SharedQuestion => {
    const data: Record<string, unknown> = { ...question.data };
    for (const field of LOCAL_FIELDS) delete data[field];
    return { id: question.id, key: question.key, data };
};

/** Compares questions by what is shared. */
export const syncedJson = (question: Question) =>
    JSON.stringify(toShared(question));

const viewFields = (question: Question) =>
    Object.fromEntries(
        LOCAL_FIELDS.map((field) => [field, (question.data as any)[field]]),
    );

/**
 * The questions this phone should show, given the server's game, what the
 * phone has, and `synced` (what the phone last had in common with the
 * server, by key). Changes not sent yet win: an edited question keeps its
 * edit, a new one stays, a deleted one stays deleted. With `lockAnswered`
 * (seekers, when only the hider may change answers) answered questions are
 * locked.
 */
export const mergeRemoteQuestions = (
    state: GameState,
    local: Question[],
    synced: Map<number, string>,
    me: string,
    { lockAnswered = false }: { lockAnswered?: boolean } = {},
): Question[] => {
    const localByKey = new Map(local.map((q) => [q.key, q]));
    const unsent = new Set(
        local
            .filter((q) => synced.get(q.key) !== syncedJson(q))
            .map((q) => q.key),
    );

    const fromServer = Object.values(state.questions)
        .sort(
            (a, b) =>
                a.createdAt - b.createdAt || a.question.key - b.question.key,
        )
        .flatMap((entry) => {
            const key = entry.question.key;
            const mine = localByKey.get(key);
            if (mine && unsent.has(key)) return [mine];
            // Deleted on this phone but not sent yet.
            if (!mine && synced.has(key)) return [];

            const view = mine
                ? viewFields(mine)
                : {
                      collapsed: false,
                      hidden: false,
                      drag: entry.state === "draft" && entry.createdBy === me,
                  };
            if (lockAnswered && entry.state === "answered") view.drag = false;
            const parsed = questionSchema.safeParse({
                ...entry.question,
                data: { ...entry.question.data, ...view },
            });
            return parsed.success ? [parsed.data as Question] : [];
        });

    const onServer = new Set(fromServer.map((q) => q.key));
    const created = local.filter(
        (q) => !onServer.has(q.key) && !synced.has(q.key),
    );
    return [...fromServer, ...created];
};

/** The changes to send: new and edited questions, and deletions. */
export const diffLocal = (
    local: Question[],
    synced: Map<number, string>,
): GameOp[] => {
    const ops: GameOp[] = [];
    const keys = new Set(local.map((q) => q.key));
    for (const question of local) {
        if (synced.get(question.key) !== syncedJson(question)) {
            ops.push({ type: "putQuestion", question: toShared(question) });
        }
    }
    for (const key of synced.keys()) {
        if (!keys.has(key)) ops.push({ type: "deleteQuestion", key });
    }
    return ops;
};

/**
 * How a question shapes the map: confirmed answers shade it; seekers'
 * drafts shade it as speculation; questions waiting for the hider don't.
 * Without a shared game every question counts.
 */
export const roleOnMap = (
    question: Question,
    state: GameState | null,
): "confirmed" | "speculative" | "waiting" => {
    if (!state) return "confirmed";
    const entry = state.questions[String(question.key)];
    if (!entry || entry.state === "draft") return "speculative";
    return entry.state === "answered" ? "confirmed" : "waiting";
};
