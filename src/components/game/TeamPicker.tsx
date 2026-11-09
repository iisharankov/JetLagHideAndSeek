import type { Player, Team } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/** What the player chose: one of the game's teams, or a new one. */
export type TeamChoice =
    | { kind: "existing"; id: string; name: string }
    | { kind: "new"; name: string };

/** The team body for joining: an existing team by id, a new one by name. */
export const teamBody = (choice: TeamChoice, password: string) =>
    choice.kind === "existing"
        ? { id: choice.id, password }
        : { name: choice.name.trim(), password };

/** The members' names, for a line under the teams. */
const memberNames = (team: Team, players: Record<string, Player>) =>
    team.members
        .map((id) => players[id])
        .filter((player) => player && !player.left)
        .map((player) => player!.name)
        .join(", ");

/**
 * Teams: people hiding or seeking together (2 v 2, say). One team hides,
 * the others seek. A team has a password, chosen by whoever makes it;
 * joining one means typing it. Already in the team: nothing to type.
 */
export const TeamPicker = ({
    teams,
    players,
    hiderTeamId,
    mine,
    value,
    onChange,
    password,
    onPasswordChange,
}: {
    teams: Team[];
    players: Record<string, Player>;
    hiderTeamId: string | null;
    /** The team this player is in already, if any. */
    mine: string | null;
    value: TeamChoice | null;
    onChange: (choice: TeamChoice) => void;
    password: string;
    onPasswordChange: (password: string) => void;
}) => {
    const chosen =
        value?.kind === "existing"
            ? teams.find((team) => team.id === value.id)
            : undefined;
    const needsPassword = value !== null && chosen?.id !== mine;
    const button = (active: boolean) =>
        cn(
            "min-h-11 rounded-md border px-2 py-2 text-sm font-semibold transition-colors",
            active
                ? "border-blue-500 bg-blue-500 text-white"
                : "border-slate-600 bg-slate-800/40 text-slate-200 hover:bg-slate-800",
        );
    return (
        <div className="flex flex-col gap-2 text-sm" data-testid="team-picker">
            <div
                role="radiogroup"
                aria-label="Team"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
                {teams.map((team) => (
                    <button
                        key={team.id}
                        type="button"
                        role="radio"
                        aria-checked={chosen?.id === team.id}
                        className={button(chosen?.id === team.id)}
                        onClick={() =>
                            onChange({
                                kind: "existing",
                                id: team.id,
                                name: team.name,
                            })
                        }
                    >
                        {team.name}
                        {team.id === hiderTeamId && " (hiding)"}
                    </button>
                ))}
                <button
                    type="button"
                    role="radio"
                    aria-checked={value?.kind === "new"}
                    className={button(value?.kind === "new")}
                    onClick={() =>
                        onChange({
                            kind: "new",
                            name: value?.kind === "new" ? value.name : "",
                        })
                    }
                >
                    + New team
                </button>
            </div>
            {chosen && (
                <p className="text-xs text-slate-400">
                    In {chosen.name}:{" "}
                    {memberNames(chosen, players) || "nobody yet"}
                </p>
            )}
            {value?.kind === "new" && (
                <input
                    type="text"
                    aria-label="New team's name"
                    maxLength={30}
                    placeholder="Team name, e.g. Foxes"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={value.name}
                    onChange={(event) =>
                        onChange({ kind: "new", name: event.target.value })
                    }
                />
            )}
            {needsPassword && (
                <>
                    <input
                        type="password"
                        aria-label="Team password"
                        autoComplete="off"
                        maxLength={64}
                        placeholder="Team password"
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={password}
                        onChange={(event) =>
                            onPasswordChange(event.target.value)
                        }
                    />
                    <p className="text-xs text-slate-400">
                        {value?.kind === "new"
                            ? "Choose one, 6 to 64 characters, and tell your teammates."
                            : "Ask your teammates for it."}
                    </p>
                </>
            )}
        </div>
    );
};
