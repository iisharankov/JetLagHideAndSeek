import type { Team } from "@/lib/game/types";

/** What the player chose: no team, one of the game's, or a new one. */
export type TeamChoice =
    | { kind: "none" }
    | { kind: "existing"; id: string; name: string }
    | { kind: "new"; name: string };

/** The choice that matches the team a player is in, if any. */
export const currentTeamChoice = (teams: Team[], me: string): TeamChoice => {
    const mine = teams.find((team) => team.members.includes(me));
    return mine
        ? { kind: "existing", id: mine.id, name: mine.name }
        : { kind: "none" };
};

/**
 * Teams: people hiding or seeking together (2 v 2, say). One team hides,
 * the others seek; the team's name goes on the scoreboard.
 */
export const TeamPicker = ({
    teams,
    value,
    onChange,
    hiderTeamId,
}: {
    teams: Team[];
    value: TeamChoice;
    onChange: (choice: TeamChoice) => void;
    hiderTeamId: string | null;
}) => (
    <fieldset className="flex flex-col gap-1 text-sm" data-testid="team-picker">
        <legend className="text-xs text-slate-400">
            Team (hiding or seeking together)
        </legend>
        <label className="flex items-center gap-2">
            <input
                type="radio"
                name="team"
                checked={value.kind === "none"}
                onChange={() => onChange({ kind: "none" })}
            />
            No team
        </label>
        {teams.map((team) => (
            <label key={team.id} className="flex items-center gap-2">
                <input
                    type="radio"
                    name="team"
                    checked={value.kind === "existing" && value.id === team.id}
                    onChange={() =>
                        onChange({
                            kind: "existing",
                            id: team.id,
                            name: team.name,
                        })
                    }
                />
                <span>
                    {team.name}
                    <span className="text-xs text-slate-400">
                        {" "}
                        ({team.members.join(", ") || "nobody yet"}
                        {team.id === hiderTeamId ? "; hiding this round" : ""})
                    </span>
                </span>
            </label>
        ))}
        <label className="flex items-center gap-2">
            <input
                type="radio"
                name="team"
                checked={value.kind === "new"}
                onChange={() =>
                    onChange({
                        kind: "new",
                        name: value.kind === "new" ? value.name : "",
                    })
                }
            />
            New team:
            <input
                type="text"
                aria-label="New team's name"
                maxLength={30}
                placeholder="Foxes"
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                value={value.kind === "new" ? value.name : ""}
                onFocus={() => {
                    if (value.kind !== "new")
                        onChange({ kind: "new", name: "" });
                }}
                onChange={(event) =>
                    onChange({ kind: "new", name: event.target.value })
                }
            />
        </label>
    </fieldset>
);
