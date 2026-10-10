// A question's identity for the map: what it means, not how its card looks.
import { syncedJson } from "@/lib/game/sync";
import type { Question } from "@/maps/schema";

const keys = new WeakMap<Question, string>();

/**
 * The question's shared fields as a string (its place, answer, type…; not
 * whether its card is folded, hidden or locked). Cached per object: a
 * question is never changed in place, so a new object means a new key and
 * an unchanged one costs nothing.
 */
export const questionGeometryKey = (question: Question): string => {
    let key = keys.get(question);
    if (key === undefined) {
        key = syncedJson(question);
        keys.set(question, key);
    }
    return key;
};

/**
 * Everything about the list of questions that the map depends on: which
 * questions, in which order, each one's data, and whether it's hidden or
 * locked. Folding a card doesn't change it.
 */
export const questionsMapKey = (questions: Question[]): string =>
    questions
        .map(
            (q) =>
                `${q.data.hidden ? "h" : "-"}${q.data.drag ? "u" : "l"}${questionGeometryKey(q)}`,
        )
        .join("\n");
