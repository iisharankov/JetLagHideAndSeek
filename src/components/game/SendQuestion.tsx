import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { updateQuestion } from "@/lib/context";
import { askedFrom, fromHere, pinAway } from "@/lib/game/askFrom";
import { sendQuestion } from "@/lib/game/session";
import { recentPosition } from "@/lib/geolocation";
import { clearAskFrom, showAskFrom } from "@/maps/askFromLayer";
import type { Question } from "@/maps/schema";

const distance = (metres: number) =>
    metres < 1000
        ? `${Math.round(metres / 10) * 10} m`
        : `${(metres / 1000).toFixed(1)} km`;

/**
 * Send (the card's foot since round 46). Questions are asked from where
 * the seekers are: with the phone's position known and the pin away from
 * it, Send asks which to send from first, the map showing both.
 */
export const useSendQuestion = (question: Question, questionKey: number) => {
    const [away, setAway] = useState<number | null>(null);
    useEffect(() => clearAskFrom, []);

    const send = (fromPhone: boolean) => {
        const here = recentPosition();
        if (fromPhone && here) {
            updateQuestion(questionKey, fromHere(question, here));
        }
        setAway(null);
        clearAskFrom();
        void sendQuestion(questionKey);
    };
    const start = () => {
        const here = recentPosition();
        const metres = pinAway(question, here);
        const pin = askedFrom(question);
        if (metres === null || !here || !pin) {
            send(false);
            return;
        }
        setAway(metres);
        showAskFrom(here, pin);
    };
    const cancel = () => {
        setAway(null);
        clearAskFrom();
    };
    return { away, start, send, cancel };
};

/** The pin is away from the phone: send from where I am, or the pin. */
export const AskFromPanel = ({
    question,
    away,
    send,
    cancel,
}: {
    question: Question;
    away: number;
    send: (fromPhone: boolean) => void;
    cancel: () => void;
}) => (
    <div
        className="flex flex-col gap-1 rounded-md border border-sky-500/60 bg-sky-950/40 p-2 text-xs"
        data-testid="ask-from"
    >
        <p>
            Its {askedFrom(question)?.end ? "end " : ""}pin is {distance(away)}{" "}
            from where you are (the dashed line). Questions are asked from where
            you are.
        </p>
        <Button size="sm" onClick={() => send(true)}>
            Send from where I am
        </Button>
        <Button size="sm" variant="outline" onClick={() => send(false)}>
            Send from the pin
        </Button>
        <button
            type="button"
            className="self-start text-slate-300 underline"
            onClick={cancel}
        >
            Not yet
        </button>
    </div>
);
