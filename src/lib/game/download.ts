// A copy of the game on the phone: the whole game as this phone sees it
// (questions, answers, rounds, the scoreboard's numbers) and links to its
// photos, as one JSON file. A keepsake, and a backup that needs no server.
import { photoUrl } from "./api";
import { gameRole, gameState } from "./session";
import type { GameState, Role } from "./types";

/** The file's contents. */
export const gameFile = (game: GameState, role: Role, now = new Date()) =>
    JSON.stringify(
        {
            app: "Jet Lag Hide and Seek",
            exportedAt: now.toISOString(),
            role,
            link: typeof location !== "undefined" ? location.href : undefined,
            photos: game.photos.map((photo) => ({
                ...photo,
                url: photoUrl(game.id, photo.id),
            })),
            game,
        },
        null,
        2,
    );

export const gameFileName = (game: GameState, now = new Date()) =>
    `jetlag-game-${game.id}-${now.toISOString().slice(0, 10)}.json`;

/** Downloads the current game as a file. */
export const downloadGame = () => {
    const game = gameState.get();
    if (!game) return false;
    const blob = new Blob([gameFile(game, gameRole.get())], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = gameFileName(game);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
};
