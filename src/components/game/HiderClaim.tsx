import { useStore } from "@nanostores/react";
import { useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    claimHider,
    forgetHider,
    gameRole,
    gameState,
} from "@/lib/game/session";
import { errorMessage } from "@/maps/errors";

/** Menu → Hider, in a shared game: becoming the hider (with a password). */
export const HiderClaim = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const [claiming, setClaiming] = useState(false);

    if ($role === "hider") {
        return (
            <section className="flex flex-col gap-2 rounded-lg border border-yellow-500/60 p-3">
                <p className="text-sm" data-testid="hider-status">
                    You&apos;re <strong>the hider</strong> in this game.
                </p>
                <Button variant="outline" size="sm" onClick={forgetHider}>
                    Stop being the hider on this phone
                </Button>
            </section>
        );
    }

    return (
        <section className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3">
            <p className="text-sm" data-testid="hider-status">
                You&apos;re a seeker in this game.
                {$game?.hasHider && " A hider has already joined."}
            </p>
            {!claiming ? (
                <Button variant="outline" onClick={() => setClaiming(true)}>
                    I&apos;m the hider
                </Button>
            ) : (
                <form
                    className="flex flex-col gap-2"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        // Read the field itself: the app's inputs report
                        // changes with a delay.
                        const password = String(
                            new FormData(event.currentTarget).get("password"),
                        );
                        try {
                            await claimHider(password);
                            setClaiming(false);
                            toast.success(
                                "You're the hider on this phone. Turn on hider mode below.",
                            );
                        } catch (error) {
                            toast.error(errorMessage(error));
                        }
                    }}
                >
                    <Label htmlFor="hider-password">
                        {$game?.hasHider
                            ? "Hider password"
                            : "Choose a hider password (seekers won't know it)"}
                    </Label>
                    <input
                        id="hider-password"
                        name="password"
                        type="password"
                        autoComplete="off"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Button type="submit">Become the hider</Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setClaiming(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            )}
            <p className="text-xs text-slate-400">
                Hider mode (below) is for the hider only: it suggests an answer
                to each question, which the hider then sends.
            </p>
        </section>
    );
};
