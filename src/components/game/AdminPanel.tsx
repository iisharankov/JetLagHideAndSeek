import { useStore } from "@nanostores/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ago } from "@/lib/format";
import {
    type AdminCodeRow,
    adminCodes,
    adminDeleteGame,
    type AdminGameRow,
    adminGames,
    adminMakeCode,
    adminRevokeCode,
} from "@/lib/game/api";
import { forgetCode, myCode } from "@/lib/game/codes";
import { gameLink } from "@/lib/game/session";
import { errorMessage } from "@/maps/errors";

const day = (at: number) =>
    new Date(at).toLocaleDateString([], { day: "numeric", month: "short" });

/**
 * Menu → Admin (the admin code on this phone): a creator code per friend
 * who should start games, revoked any time; every game, who made it, and
 * deleting any.
 */
export const AdminPanel = () => {
    const $code = useStore(myCode);
    const admin = $code?.kind === "admin" ? $code.code : null;
    const [codes, setCodes] = useState<AdminCodeRow[] | null>(null);
    const [games, setGames] = useState<AdminGameRow[] | null>(null);
    const [name, setName] = useState("");
    const [made, setMade] = useState<{ name: string; code: string } | null>(
        null,
    );
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!admin) return;
        try {
            const [c, g] = await Promise.all([
                adminCodes(admin),
                adminGames(admin),
            ]);
            setCodes(c.codes);
            setGames(g.games);
        } catch (error) {
            toast.error(errorMessage(error), { toastId: "admin-load" });
            // The admin code changed on the server: it's no use here.
            if ((error as { status?: number }).status === 403) forgetCode();
        }
    }, [admin]);
    useEffect(() => void load(), [load]);

    if (!admin) return null;

    const act = async (what: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await what();
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-3" data-testid="admin-panel">
            <section className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-semibold font-poppins">
                    Creator codes
                </h3>
                <p className="text-xs text-slate-400">
                    One per friend who should start games: 5 games a day each.
                    Revoking one stops new games; the games it made stay.
                </p>
                <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void act(async () => {
                            const code = await adminMakeCode(
                                admin,
                                name.trim(),
                            );
                            setMade({ name: code.name, code: code.code });
                            setName("");
                        });
                    }}
                >
                    <Label htmlFor="new-code-name" className="sr-only">
                        Whose code
                    </Label>
                    <Input
                        id="new-code-name"
                        placeholder="Whose code, e.g. Ana"
                        maxLength={40}
                        className="min-h-11"
                        debounce={0}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <Button
                        type="submit"
                        className="min-h-11"
                        disabled={busy || name.trim() === ""}
                    >
                        New code
                    </Button>
                </form>
                {made && (
                    <div
                        className="flex flex-col gap-2 rounded-md border border-green-600/60 bg-green-950/30 p-2"
                        data-testid="new-code"
                    >
                        <p className="text-xs">
                            {made.name}&apos;s code. Shown only now: send it to
                            them (not in a public chat).
                        </p>
                        <p className="text-center font-mono text-xl tracking-widest">
                            {made.code}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(
                                            made.code,
                                        );
                                        toast.success("Code copied", {
                                            autoClose: 2000,
                                        });
                                    } catch {
                                        toast.info(made.code);
                                    }
                                }}
                            >
                                Copy
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMade(null)}
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                )}
                {codes === null ? (
                    <p className="text-xs text-slate-400">Loading…</p>
                ) : codes.length === 0 ? (
                    <p className="text-xs text-slate-400">No codes yet.</p>
                ) : (
                    <ul
                        className="flex flex-col gap-1"
                        data-testid="codes-list"
                    >
                        {codes.map((code) => (
                            <li
                                key={code.id}
                                className={`flex min-h-11 items-center justify-between gap-2 rounded-md border border-slate-700 px-3 text-sm ${code.revokedAt ? "text-slate-500" : ""}`}
                            >
                                <span>
                                    {code.name}
                                    <span className="text-xs text-slate-400">
                                        {" "}
                                        · {day(code.createdAt)}
                                        {code.revokedAt
                                            ? " · revoked"
                                            : ` · ${code.gamesToday} of 5 today`}
                                    </span>
                                </span>
                                {!code.revokedAt && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    `Revoke ${code.name}'s code? It can't start games any more; its games stay.`,
                                                )
                                            ) {
                                                void act(() =>
                                                    adminRevokeCode(
                                                        admin,
                                                        code.id,
                                                    ),
                                                );
                                            }
                                        }}
                                    >
                                        Revoke
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <section className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3">
                <h3 className="text-sm font-semibold font-poppins">
                    Every game
                </h3>
                {games === null ? (
                    <p className="text-xs text-slate-400">Loading…</p>
                ) : games.length === 0 ? (
                    <p className="text-xs text-slate-400">No games.</p>
                ) : (
                    <ul
                        className="flex flex-col gap-1"
                        data-testid="admin-games"
                    >
                        {games.map((game) => (
                            <li
                                key={game.id}
                                className="flex items-center justify-between gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm"
                            >
                                <span className="min-w-0">
                                    <a
                                        href={gameLink(game.id)}
                                        className="block truncate underline"
                                    >
                                        {game.area}
                                    </a>
                                    <span className="block text-xs text-slate-400">
                                        {game.by || "?"}
                                        {game.creator &&
                                            ` (${game.creator})`} ·{" "}
                                        {day(game.createdAt)} · {game.players}{" "}
                                        player
                                        {game.players === 1 ? "" : "s"} ·
                                        changed {ago(game.updatedAt)}
                                    </span>
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                `Delete the game in ${game.area} for everyone, photos included?`,
                                            )
                                        ) {
                                            void act(() =>
                                                adminDeleteGame(admin, game.id),
                                            );
                                        }
                                    }}
                                >
                                    Delete
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};
