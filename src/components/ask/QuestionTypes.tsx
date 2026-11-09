import { useStore } from "@nanostores/react";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "react-toastify";

import { addQuestion, leafletMapContext } from "@/lib/context";
import {
    blockingCurses,
    disabledCategory,
    kindRefusal,
} from "@/lib/game/curseRules";
import { DRAWS } from "@/lib/game/hand";
import { restRefusal } from "@/lib/game/rest";
import { serverNow } from "@/lib/game/serverTime";
import { gameRole, gameState } from "@/lib/game/session";
import type { GameState } from "@/lib/game/types";
import { recentPosition } from "@/lib/geolocation";
import { askFlow, type AskKind, back, pickKind } from "@/lib/screens";
import { startTour } from "@/lib/tour";
import { cn } from "@/lib/utils";

/**
 * The six kinds, as the type picker shows them (mock-up 03). The tour
 * points at the Photo tile as data-testid="ask-photo" (built from the kind).
 */
export const KINDS: {
    kind: AskKind;
    title: string;
    line: string;
    icon: string;
}[] = [
    { kind: "radius", title: "Radar", line: "Within X km of me?", icon: "◎" },
    {
        kind: "thermometer",
        title: "Thermometer",
        line: "Hotter or colder after X km",
        icon: "🌡️",
    },
    {
        kind: "matching",
        title: "Matching",
        line: "Same nearest place as me?",
        icon: "⇄",
    },
    {
        kind: "measuring",
        title: "Measuring",
        line: "Closer to a place than me?",
        icon: "📏",
    },
    {
        kind: "tentacles",
        title: "Tentacles",
        line: "Which place within X km?",
        icon: "🐙",
    },
    {
        kind: "photo",
        title: "Photo",
        line: "Send me a picture of…",
        icon: "📷",
    },
];

/** "2/1": the hider draws 2, keeps 1 (the rulebook's numbers per kind). */
export const DrawBadge = ({ kind }: { kind: AskKind }) => {
    const draw = DRAWS[kind];
    return (
        <span
            className="shrink-0 rounded-md bg-slate-700 px-1.5 py-0.5 text-xs font-semibold text-slate-200"
            title={`The hider draws ${draw.draw}, keeps ${draw.keep}`}
            data-testid="draw-badge"
        >
            {draw.draw}/{draw.keep}
        </span>
    );
};

/** "×2": asked before this round, so it costs double. */
export const TwiceBadge = ({ className }: { className?: string }) => (
    <span
        className={cn(
            "rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white",
            className,
        )}
        title="Asked before this round: it costs double"
        data-testid="twice-badge"
    >
        ×2
    </span>
);

/** A pushed screen's header: ‹ back, the badge, the title, and what's on the right. */
export const ScreenHeader = ({
    title,
    kind,
    right,
}: {
    title: string;
    kind?: AskKind;
    right?: ReactNode;
}) => (
    <div className="flex items-center gap-2 px-2 pt-2">
        <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800"
            aria-label="Back"
            onClick={back}
        >
            <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        {kind && <DrawBadge kind={kind} />}
        <h3 className="min-w-0 flex-1 truncate font-poppins text-lg font-semibold">
            {title}
        </h3>
        {right}
    </div>
);

/** Where a new question starts: where the phone is, else the map's centre. */
export const startPoint = () => {
    const here = recentPosition();
    if (here) return { lat: here.latitude, lng: here.longitude, here };
    const center = leafletMapContext.get()?.getCenter();
    return center ? { lat: center.lat, lng: center.lng, here: null } : null;
};

/**
 * Why a kind can't be asked now, or null. `sending`: asking for real (a
 * rest period or a curse that stops asking also stops it); otherwise a
 * draft, which only a disabled category stops.
 */
export const askRefusal = (
    game: GameState | null,
    kind: AskKind,
    sending: boolean,
) => {
    if (!game) return null;
    const now = serverNow();
    if (sending) {
        const rest = restRefusal(game);
        if (rest) return rest;
        const blocking = blockingCurses(game, now)[0];
        if (blocking)
            return `${blocking.name}: no questions until it's cleared.`;
    }
    const disabled = disabledCategory(game, now);
    if (disabled === kind) {
        return `${disabled.charAt(0).toUpperCase()}${disabled.slice(1)} questions are disabled right now (Curse of the Spotty Memory).`;
    }
    return kind === "thermometer"
        ? kindRefusal(game, "thermometer", now)
        : null;
};

/**
 * Ask a question: the six kinds as tiles (mock-up 03), each with what the
 * hider draws. A tile opens the kind's choices; nothing is made yet.
 */
export const QuestionTypes = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $ask = useStore(askFlow);
    const research = !!$ask?.research;
    // Photos are asked of the hider: only seekers, in a shared game.
    const kinds = KINDS.filter(
        (k) => k.kind !== "photo" || ($game && $role === "seeker" && !research),
    );
    return (
        <div className="flex flex-col gap-3 pb-4" data-testid="question-types">
            <ScreenHeader
                title={research ? "Add a research question" : "Ask a question"}
                right={
                    <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center"
                        aria-label="How this screen works"
                        title="How this screen works"
                        onClick={() => startTour("ask")}
                        data-testid="ask-tour"
                    >
                        <span
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-400 text-sm font-bold"
                            aria-hidden
                        >
                            ?
                        </span>
                    </button>
                }
            />
            {research && (
                <p className="px-3 text-xs text-slate-400">
                    Only on your phone, answered from the station you tapped (or
                    your pin).
                </p>
            )}
            <div
                className="grid grid-cols-2 gap-2 px-2"
                data-tutorial-id="ask-kinds"
            >
                {kinds.map(({ kind, title, line, icon }) => {
                    const refusal = research
                        ? null
                        : askRefusal($game, kind, false);
                    return (
                        <button
                            key={kind}
                            type="button"
                            disabled={refusal !== null}
                            title={refusal ?? undefined}
                            aria-label={title}
                            className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800/70 p-2 text-center hover:bg-slate-800 disabled:opacity-40"
                            onClick={() => pickKind(kind)}
                            data-testid={`ask-${kind}`}
                        >
                            <span className="text-2xl" aria-hidden>
                                {icon}
                            </span>
                            <span className="flex flex-wrap items-center justify-center gap-1.5">
                                <DrawBadge kind={kind} />
                                <span className="font-semibold">{title}</span>
                            </span>
                            <span className="text-xs text-slate-400">
                                {refusal ?? line}
                            </span>
                        </button>
                    );
                })}
            </div>
            {!$game && (
                <button
                    type="button"
                    className="mx-3 self-start text-xs text-slate-400 underline"
                    onClick={async () => {
                        try {
                            const parsed = JSON.parse(
                                await navigator.clipboard.readText(),
                            );
                            addQuestion({ ...parsed, key: Math.random() });
                            askFlow.set(null);
                            toast.success("Question added from the clipboard.");
                        } catch {
                            toast.error("No question in the clipboard.");
                        }
                    }}
                >
                    Paste a question from the clipboard
                </button>
            )}
        </div>
    );
};
