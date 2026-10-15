// The shape of what the phones send, checked before the rules see it: a
// malformed change is a 400 with a reason, not a 500 or a stored oddity.
// Sizes are generous for a game and small for a stranger with the link.
import { z } from "zod";

import type { GameOp, SharedQuestion } from "@/lib/game/types";

const finite = z.number().finite();
// Question keys are random fractions on the phones, not integers.
const key = z.number().finite().min(0);
const index = z.number().int().min(0).max(100);
const text = (max: number) => z.string().max(max);
const name = text(120);
const id = text(80);

const stationPick = z.object({
    id: text(80),
    name: text(160),
    lat: finite,
    lng: finite,
});
const pin = z.object({ latitude: finite, longitude: finite });
const draw = z.object({
    draw: z.number().int().min(1).max(6),
    keep: z.number().int().min(1).max(6),
    label: text(80),
});
const rest = z
    .object({ from: text(5), until: text(5), timeZone: text(80) })
    .nullable();

/** At most this much JSON per question, play area or zone. */
const MAX_JSON = 300_000;
const sized = (what: string) => (value: unknown) =>
    JSON.stringify(value ?? null).length <= MAX_JSON ||
    `The ${what} is too large.`;

export const sharedQuestionSchema = z.object({
    id: text(40),
    key,
    data: z.record(z.string(), z.unknown()).refine(sized("question"), {
        message: "The question is too large.",
    }),
});

const opSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("putQuestion"),
        question: sharedQuestionSchema,
        state: z.enum(["draft", "asked"]).optional(),
    }),
    z.object({ type: z.literal("deleteQuestion"), key }),
    z.object({ type: z.literal("sendQuestion"), key }),
    z.object({
        type: z.literal("answerQuestion"),
        key,
        answer: z.record(z.string(), z.unknown()).refine(sized("answer")),
        basedOn: finite,
    }),
    z.object({
        type: z.literal("setPlayArea"),
        playArea: z.unknown().refine(sized("play area")),
    }),
    z.object({
        type: z.literal("setZone"),
        zone: z.unknown().refine(sized("zone")),
    }),
    z.object({
        type: z.literal("setSettings"),
        settings: z.record(z.string(), z.unknown()).refine(sized("settings")),
    }),
    z.object({ type: z.literal("askPhoto"), name }),
    z.object({ type: z.literal("deletePhotoRequest"), id }),
    z.object({ type: z.literal("castCurse"), name }),
    z.object({ type: z.literal("clearCurse"), id }),
    z.object({
        type: z.literal("blockQuestions"),
        id,
        kinds: z.array(text(80)).max(20),
    }),
    z.object({ type: z.literal("setCurseCategory"), id, category: text(40) }),
    z.object({
        type: z.literal("setCurseTime"),
        id,
        seconds: z.number().int().min(0).max(86_400),
    }),
    z.object({
        type: z.literal("awardMinutes"),
        minutes: z.number().int().min(1).max(600),
        reason: text(200),
    }),
    z.object({ type: z.literal("playPowerup"), name }),
    z.object({ type: z.literal("startEndgame"), station: stationPick }),
    z.object({ type: z.literal("endEndgame") }),
    z.object({
        type: z.literal("clock"),
        action: z.enum(["start", "pause", "resume", "stop", "reset", "cancel"]),
    }),
    z.object({ type: z.literal("setRest"), rest }),
    z.object({ type: z.literal("cancelRest") }),
    z.object({
        type: z.literal("setBonus"),
        minutes: z.number().int().min(0).max(600),
    }),
    z.object({ type: z.literal("drawCards"), extra: draw.optional() }),
    z.object({
        type: z.literal("keepCards"),
        picks: z.array(index).max(12),
    }),
    z.object({
        type: z.literal("playCard"),
        index,
        discards: z.array(index).max(12).optional(),
        station: stationPick.nullable().optional(),
        copyOf: index.optional(),
    }),
    z.object({ type: z.literal("discardCard"), index }),
    z.object({ type: z.literal("discardHand") }),
    z.object({ type: z.literal("vetoQuestion"), key }),
    z.object({ type: z.literal("randomizeQuestion"), key }),
    z.object({ type: z.literal("randomizePhoto"), id }),
    z.object({ type: z.literal("keepQuestion"), key }),
    z.object({
        type: z.literal("setHiderStation"),
        station: stationPick.nullable(),
    }),
    z.object({ type: z.literal("hiderReady"), station: stationPick }),
    z.object({
        type: z.literal("setHiderPending"),
        station: stationPick.nullable(),
    }),
    z.object({ type: z.literal("joinTeam"), name: text(60) }),
    z.object({ type: z.literal("leaveTeam") }),
    z.object({
        type: z.literal("claimNextRound"),
        teamId: text(80).nullable(),
    }),
    z.object({ type: z.literal("setHiderPin"), pin }),
    z.object({ type: z.literal("move"), station: stationPick.nullable() }),
    z.object({ type: z.literal("resumeMove") }),
    z.object({ type: z.literal("newRound") }),
]);

/** The first problem with a change, in a sentence, or null when it's fine. */
export const opProblem = (op: unknown): string | null => {
    const result = opSchema.safeParse(op);
    if (result.success) return null;
    const issue = result.error.issues[0];
    const where = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
    return `${issue?.message ?? "Not a change the game knows"}${where}`;
};

/** The change, checked; the rules get exactly these fields. */
export const parseOp = (op: unknown): GameOp | null => {
    const result = opSchema.safeParse(op);
    return result.success ? (result.data as GameOp) : null;
};

/** Questions a game is created with, checked the same way. */
export const parseQuestions = (value: unknown): SharedQuestion[] | null => {
    const result = z.array(sharedQuestionSchema).max(500).safeParse(value);
    return result.success ? (result.data as SharedQuestion[]) : null;
};
