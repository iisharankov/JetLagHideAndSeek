// Cards → History.
import { CardText } from "@/components/RulesText";
import type {
    CurseEntry,
    GameSize,
    MoveArchive,
    PowerupEntry,
} from "@/lib/game/types";
import { POWERUPS } from "@/lib/rules/cards";

const time = (at: number) =>
    new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Cards → History: moves, cards played, curses cleared, the deck's log. */
export const CardHistory = ({
    moves,
    played,
    cleared,
    log,
    size,
}: {
    moves: MoveArchive[];
    played: PowerupEntry[];
    cleared: CurseEntry[];
    log: { at: number; text: string }[];
    size: GameSize;
}) => {
    const history = cleared.length + played.length + log.length + moves.length;
    return (
        <details className="rounded-md border border-slate-700 p-2">
            <summary className="cursor-pointer font-semibold font-poppins">
                History ({history})
            </summary>
            <div className="mt-2 flex flex-col gap-2 text-xs">
                {history === 0 && (
                    <p className="text-slate-400">Nothing yet.</p>
                )}
                {moves.map((entry, index) => (
                    <p key={`m${index}`} className="text-slate-300">
                        Move at {time(entry.at)}
                        {entry.station && ` from ${entry.station.name}`}:{" "}
                        {entry.questions.length} question
                        {entry.questions.length === 1 ? "" : "s"} put away.
                    </p>
                ))}
                {played.map((entry) => {
                    const powerup = POWERUPS.find((p) => p.name === entry.name);
                    return (
                        <div
                            key={entry.id}
                            className="rounded-md border border-amber-500/60 bg-amber-950/30 p-2"
                            data-testid="played-powerup"
                        >
                            <p className="font-semibold">
                                {entry.name} · played {time(entry.playedAt)}
                                {entry.by && ` by ${entry.by}`}
                            </p>
                            {powerup && (
                                <p className="text-slate-300">
                                    <CardText
                                        text={powerup.effect}
                                        size={size}
                                    />
                                </p>
                            )}
                        </div>
                    );
                })}
                {cleared.map((entry) => (
                    <p key={entry.id} className="text-slate-300">
                        {entry.name}: cast {time(entry.castAt)}, cleared by{" "}
                        {entry.clearedBy}
                    </p>
                ))}
                {log.map((entry, index) => (
                    <p key={`l${index}`} className="text-slate-300">
                        {time(entry.at)} {entry.text}
                    </p>
                ))}
            </div>
        </details>
    );
};
