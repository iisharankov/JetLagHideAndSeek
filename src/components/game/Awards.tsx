import { useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendOp } from "@/lib/game/session";
import type { Award } from "@/lib/game/types";
import { errorMessage } from "@/maps/errors";

const time = (at: number) =>
    new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Cards → Awards: minutes the hider gets on top of the hand's time bonuses
 * (a curse's penalty, say). The hider records them; the seekers see them.
 */
export const Awards = ({
    awards,
    hider,
}: {
    awards: Award[];
    hider: boolean;
}) => {
    const [minutes, setMinutes] = useState("");
    const [reason, setReason] = useState("");
    const total = awards.reduce((sum, award) => sum + award.minutes, 0);
    if (awards.length === 0 && !hider) return null;

    return (
        <section
            className="flex flex-col gap-2 rounded-md border border-green-500/50 p-2"
            data-testid="awards"
        >
            <h3 className="font-semibold font-poppins">
                Awarded minutes{total > 0 && ` (+${total} min)`}
            </h3>
            {awards.length === 0 && (
                <p className="text-xs text-slate-400">
                    None yet. A curse&apos;s penalty (the egg cracked, the lemon
                    dropped…) goes here, added to the time bonuses at the end.
                </p>
            )}
            {awards.map((award) => (
                <p key={award.id} className="text-xs">
                    <strong>+{award.minutes} min</strong>
                    {award.reason && `: ${award.reason}`}
                    <span className="text-slate-400">
                        {" "}
                        · {time(award.at)} by {award.by}
                    </span>
                </p>
            ))}
            {hider && (
                <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        const value = Number(minutes);
                        if (!Number.isInteger(value) || value < 1) {
                            toast.error("How many minutes?");
                            return;
                        }
                        try {
                            await sendOp({
                                type: "awardMinutes",
                                minutes: value,
                                reason: reason.trim(),
                            });
                            setMinutes("");
                            setReason("");
                        } catch (error) {
                            toast.error(errorMessage(error));
                        }
                    }}
                >
                    <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={600}
                        className="w-20"
                        placeholder="min"
                        aria-label="Minutes to award"
                        value={minutes}
                        debounce={0}
                        onChange={(event) => setMinutes(event.target.value)}
                    />
                    <Input
                        type="text"
                        className="min-w-0 flex-1"
                        placeholder="Why (a card's penalty, say)"
                        aria-label="Reason"
                        value={reason}
                        debounce={0}
                        onChange={(event) => setReason(event.target.value)}
                    />
                    <Button type="submit" size="sm" variant="outline">
                        Award
                    </Button>
                </form>
            )}
        </section>
    );
};
