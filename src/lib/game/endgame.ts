// The end game: the seekers pick the hider's station. In a shared game the
// pick goes through the server (everyone, hider included, gets it); alone,
// it's this phone's own.
import { endgame, questions } from "@/lib/context";
import { activeGameId, sendOp } from "@/lib/game/session";
import type { StationPick } from "@/lib/game/types";

export const startEndgame = (station: StationPick) => {
    if (activeGameId.get()) {
        void sendOp({ type: "startEndgame", station });
        return;
    }
    endgame.set({
        station,
        startedAt: Date.now(),
        before: questions.get().map((q) => q.key),
    });
};

export const endEndgame = () => {
    if (activeGameId.get()) {
        void sendOp({ type: "endEndgame" });
        return;
    }
    endgame.set(null);
};
