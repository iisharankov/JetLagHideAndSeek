import { useStore } from "@nanostores/react";
import { useRef, useState } from "react";
import { toast } from "react-toastify";

import { RulesText } from "@/components/RulesText";
import { Button } from "@/components/ui/button";
import { photoUrl } from "@/lib/game/api";
import { shrinkPhoto } from "@/lib/game/photos";
import {
    activeGameId,
    gameRole,
    gameState,
    sendOp,
    uploadPhoto,
} from "@/lib/game/session";
import { photoQuestions } from "@/lib/rules/content";
import { errorMessage } from "@/maps/errors";

const ago = (time: number) => {
    const minutes = Math.round((Date.now() - time) / 60000);
    return minutes < 1
        ? "just now"
        : minutes < 60
          ? `${minutes} min ago`
          : `${Math.round(minutes / 60)} h ago`;
};

/** Picks a photo (the camera on phones), shrinks it and sends it. */
const PhotoButton = ({
    label,
    requestId,
}: {
    label: string;
    requestId?: string;
}) => {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    return (
        <>
            <input
                ref={input}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setBusy(true);
                    try {
                        await uploadPhoto(await shrinkPhoto(file), {
                            requestId,
                        });
                        toast.success("Photo sent", { autoClose: 2000 });
                    } catch (error) {
                        toast.error(errorMessage(error));
                    } finally {
                        setBusy(false);
                    }
                }}
            />
            <Button
                size="sm"
                disabled={busy}
                onClick={() => input.current?.click()}
            >
                {busy ? "Sending…" : label}
            </Button>
        </>
    );
};

const Photo = ({ photoId }: { photoId: string }) => {
    const url = photoUrl(activeGameId.get(), photoId);
    return (
        <a href={url} target="_blank" rel="noreferrer">
            <img
                src={url}
                alt="Photo"
                loading="lazy"
                className="max-h-48 w-full rounded-md object-cover"
            />
        </a>
    );
};

/** Sidebar → Photos: photo questions and the photos sent in the game. */
export const PhotosPanel = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const size = $game?.settings.size ?? "medium";
    const available = photoQuestions().filter((q) => q.sizes.includes(size));

    return (
        <div className="flex flex-col gap-3 p-3 text-sm">
            {!$game && (
                <p className="rounded-md bg-slate-800 p-2 text-xs text-slate-300">
                    Start a shared game (Menu → Game) to ask for photos and send
                    them. Below are the photo questions for reference.
                </p>
            )}

            {$game && $game.photoRequests.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold font-poppins">Asked</h3>
                    {[...$game.photoRequests].reverse().map((request) => (
                        <div
                            key={request.id}
                            className="flex flex-col gap-1 rounded-md bg-slate-800 p-2"
                            data-testid="photo-request"
                        >
                            <p>
                                <strong>{request.name}</strong>
                                <span className="text-xs text-slate-400">
                                    {" "}
                                    · asked by {request.askedBy}{" "}
                                    {ago(request.askedAt)}
                                </span>
                            </p>
                            {request.photoId ? (
                                <Photo photoId={request.photoId} />
                            ) : $role === "hider" ? (
                                <PhotoButton
                                    label="Send the photo"
                                    requestId={request.id}
                                />
                            ) : (
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    Waiting for the photo
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            void sendOp({
                                                type: "deletePhotoRequest",
                                                id: request.id,
                                            })
                                        }
                                    >
                                        Remove
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            )}

            <section className="flex flex-col gap-1">
                <h3 className="font-semibold font-poppins">
                    Photo questions ({size} game)
                </h3>
                {available.map((question) => (
                    <details
                        key={question.name}
                        className="rounded-md bg-slate-900 px-2 py-1"
                    >
                        <summary className="flex cursor-pointer items-center justify-between gap-2">
                            <span>{question.name}</span>
                            {$game && $role === "seeker" && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(event) => {
                                        event.preventDefault();
                                        void sendOp({
                                            type: "askPhoto",
                                            name: question.name,
                                        });
                                    }}
                                >
                                    Ask
                                </Button>
                            )}
                        </summary>
                        <div className="rules-text py-1 text-xs">
                            <RulesText
                                markdown={question.rules}
                                images={false}
                            />
                        </div>
                    </details>
                ))}
            </section>

            {$game && (
                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold font-poppins">Other photos</h3>
                    <PhotoButton label="Add a photo" />
                    {$game.photos
                        .filter((photo) => !photo.requestId)
                        .reverse()
                        .map((photo) => (
                            <div key={photo.id}>
                                <Photo photoId={photo.id} />
                                <p className="text-xs text-slate-400">
                                    {photo.by} · {ago(photo.at)}
                                </p>
                            </div>
                        ))}
                </section>
            )}
        </div>
    );
};
