import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";

import { ScreenHeader } from "@/components/ask/QuestionTypes";
import {
    PlayCardConfirm,
    RANDOMIZE_ID,
} from "@/components/game/PlayCardConfirm";
import { useRuleInfo } from "@/components/RuleInfo";
import { RulesText } from "@/components/RulesText";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { ago, clockTime } from "@/lib/format";
import { tap } from "@/lib/game/alerts";
import {
    answerTimerText,
    answerTimerTone,
    photoTimeLeft,
    photoTimeMs,
} from "@/lib/game/answerTimer";
import { photoUrl } from "@/lib/game/api";
import { DRAWS } from "@/lib/game/deck";
import { sendPhoto } from "@/lib/game/photos";
import {
    repeatBadge,
    timesPhotoAnsweredBefore,
} from "@/lib/game/questionIdentity";
import { serverNow } from "@/lib/game/serverTime";
import {
    activeGameId,
    gameRole,
    gameState,
    sendOp,
    uploadPhoto,
} from "@/lib/game/session";
import type { PhotoRequest } from "@/lib/game/types";
import {
    type Box,
    frame,
    panBy,
    type Point,
    START,
    toggleZoom,
    type View,
    zoomAt,
} from "@/lib/photoView";
import { photoQuestions } from "@/lib/rules/content";
import { back, pushScreen } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/maps/errors";

const TONE = {
    ok: "",
    warning: "text-amber-300",
    overdue: "text-red-300",
};

/**
 * A photo from the camera (`camera`) or the gallery, shrunk (and stripped
 * of its location) and sent, as the answer to `requestId` or on its own.
 */
const PhotoButton = ({
    label,
    requestId,
    camera,
    className,
    variant,
}: {
    label: string;
    requestId?: string;
    camera: boolean;
    className?: string;
    variant?: "default" | "secondary" | "outline";
}) => {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    return (
        <>
            <input
                ref={input}
                type="file"
                accept="image/*"
                {...(camera ? { capture: "environment" } : {})}
                className="hidden"
                data-testid={camera ? "photo-camera" : "photo-gallery"}
                onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setBusy(true);
                    try {
                        // As the camera took it, unless it's too big.
                        const sent = await sendPhoto(file, (photo) =>
                            uploadPhoto(photo, { requestId }),
                        );
                        tap();
                        toast.success(
                            sent === "smaller"
                                ? "Photo sent (made smaller: it was too big)"
                                : "Photo sent",
                            { autoClose: 2000 },
                        );
                        if (requestId && gameRole.get() === "hider") {
                            toast.info("Draw 1, keep 1: see Cards.", {
                                toastId: "draw",
                                autoClose: 8000,
                            });
                        }
                    } catch (error) {
                        toast.error(errorMessage(error));
                    } finally {
                        setBusy(false);
                    }
                }}
            />
            <Button
                className={className}
                variant={variant}
                disabled={busy}
                onClick={() => input.current?.click()}
            >
                {busy ? "Sending…" : label}
            </Button>
        </>
    );
};

/** A sent photo; `lazy` in a list, at once on its question's screen. */
const Photo = ({ photoId, lazy }: { photoId: string; lazy?: boolean }) => {
    const url = photoUrl(activeGameId.get(), photoId);
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                className="block w-full"
                aria-label="Show the photo"
                onClick={() => setOpen(true)}
            >
                <img
                    src={url}
                    alt="Photo"
                    loading={lazy ? "lazy" : "eager"}
                    className="max-h-72 w-full rounded-md object-cover"
                />
            </button>
            {open && (
                <PhotoViewer photoId={photoId} onClose={() => setOpen(false)} />
            )}
        </>
    );
};

/** Two points' middle. */
const middle = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
});

/**
 * A photo over the whole screen (round 43): ↻ turns it a quarter, so a
 * landscape photo fills a phone held upright; × (or Escape) closes it.
 * Round 44: two fingers zoom (or a double tap, or the wheel) and one moves
 * the zoomed photo, to see its details; Fit shows it whole again; New tab
 * opens it on its own, as before round 43.
 */
export const PhotoViewer = ({
    photoId,
    onClose,
}: {
    photoId: string;
    onClose: () => void;
}) => {
    const [turn, setTurn] = useState(0);
    const [view, setView] = useState<View>(START);
    const [natural, setNatural] = useState<Box | null>(null);
    const [screen, setScreen] = useState<Box | null>(null);
    const stage = useRef<HTMLDivElement>(null);
    // The fingers on the photo, and whether this touch is a tap.
    const pointers = useRef(new Map<number, Point>());
    const touch = useRef({
        moved: false,
        down: { x: 0, y: 0 },
        lastTap: null as (Point & { at: number }) | null,
    });
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    useEffect(() => {
        const el = stage.current;
        if (!el) return;
        const measure = () =>
            setScreen({ width: el.clientWidth, height: el.clientHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    /** Screen pixels from the middle of the photo's space. */
    const fromMiddle = (clientX: number, clientY: number): Point => {
        const rect = stage.current!.getBoundingClientRect();
        return {
            x: clientX - rect.left - rect.width / 2,
            y: clientY - rect.top - rect.height / 2,
        };
    };
    // The wheel zooms where the mouse is (not passive: the page stays put).
    useEffect(() => {
        const el = stage.current;
        if (!el || !natural || !screen) return;
        const fitted = frame(natural, screen, turn);
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const dy = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
            const at = fromMiddle(event.clientX, event.clientY);
            setView((v) => zoomAt(v, Math.exp(-dy * 0.002), at, fitted));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [natural, screen, turn]);

    const fitted = natural && screen ? frame(natural, screen, turn) : null;
    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // A pointer the browser doesn't track (the tests' fingers).
        }
        const at = fromMiddle(event.clientX, event.clientY);
        pointers.current.set(event.pointerId, at);
        if (pointers.current.size === 1) {
            touch.current.moved = false;
            touch.current.down = at;
        } else {
            touch.current.moved = true;
        }
    };
    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const fingers = pointers.current;
        const before = fingers.get(event.pointerId);
        if (!before || !fitted) return;
        const after = fromMiddle(event.clientX, event.clientY);
        fingers.set(event.pointerId, after);
        const { down } = touch.current;
        if (Math.hypot(after.x - down.x, after.y - down.y) > 8) {
            touch.current.moved = true;
        }
        if (fingers.size === 1) {
            const dx = after.x - before.x;
            const dy = after.y - before.y;
            setView((v) => panBy(v, dx, dy, fitted));
            return;
        }
        // Two fingers: zoom by how far apart they moved, where they are.
        const other = [...fingers].find(([id]) => id !== event.pointerId)?.[1];
        if (!other) return;
        const was = Math.hypot(before.x - other.x, before.y - other.y);
        const now = Math.hypot(after.x - other.x, after.y - other.y);
        const from = middle(before, other);
        const to = middle(after, other);
        setView((v) =>
            panBy(
                zoomAt(v, was > 0 ? now / was : 1, from, fitted),
                to.x - from.x,
                to.y - from.y,
                fitted,
            ),
        );
    };
    const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.delete(event.pointerId)) return;
        if (
            event.type !== "pointerup" ||
            pointers.current.size > 0 ||
            touch.current.moved ||
            !fitted
        ) {
            return;
        }
        // A tap; two close together zoom in, or back out.
        const at = fromMiddle(event.clientX, event.clientY);
        const last = touch.current.lastTap;
        if (
            last &&
            event.timeStamp - last.at < 350 &&
            Math.hypot(at.x - last.x, at.y - last.y) < 30
        ) {
            touch.current.lastTap = null;
            setView((v) => toggleZoom(v, at, fitted));
        } else {
            touch.current.lastTap = { ...at, at: event.timeStamp };
        }
    };

    const url = photoUrl(activeGameId.get(), photoId);
    // Turned sideways, the photo's width runs along the screen's height.
    const sideways = turn % 180 !== 0;
    const size = fitted
        ? sideways
            ? { width: fitted.seen.height, height: fitted.seen.width }
            : fitted.seen
        : null;
    const HEAD_BUTTON =
        "flex h-11 shrink-0 items-center gap-2 rounded-lg bg-slate-800 px-4 font-semibold";
    return createPortal(
        <div
            // Over the notifications too (9999): nothing covers Fit or ×.
            className="fixed inset-0 z-[10000] flex flex-col bg-black text-white"
            role="dialog"
            aria-label="Photo"
            data-testid="photo-viewer"
        >
            <div className="flex items-center gap-2 p-2">
                <button
                    type="button"
                    className={HEAD_BUTTON}
                    aria-label="Turn the photo"
                    onClick={() => {
                        setTurn((turn + 90) % 360);
                        setView(START);
                    }}
                >
                    <span aria-hidden>↻</span> Turn
                </button>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={HEAD_BUTTON}
                    aria-label="Open the photo in a new tab"
                >
                    <span aria-hidden>↗</span> New tab
                </a>
                <span className="flex-1" />
                {view.scale > 1 && (
                    <button
                        type="button"
                        className={HEAD_BUTTON}
                        onClick={() => setView(START)}
                    >
                        Fit
                    </button>
                )}
                <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-2xl"
                    aria-label="Close the photo"
                    onClick={onClose}
                >
                    ×
                </button>
            </div>
            <div
                ref={stage}
                className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
                data-testid="photo-stage"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                <img
                    src={url}
                    alt="Photo"
                    draggable={false}
                    data-turn={turn}
                    data-scale={view.scale}
                    data-x={Math.round(view.x)}
                    data-y={Math.round(view.y)}
                    onLoad={(event) =>
                        setNatural({
                            width: event.currentTarget.naturalWidth,
                            height: event.currentTarget.naturalHeight,
                        })
                    }
                    className="absolute left-1/2 top-1/2 max-w-none"
                    style={
                        size
                            ? {
                                  width: size.width,
                                  height: size.height,
                                  transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale}) rotate(${turn}deg)`,
                              }
                            : { opacity: 0 }
                    }
                />
            </div>
        </div>,
        document.body,
    );
};

/** Where a photo question stands: Waiting, Sent, Can't be answered. */
const status = (request: PhotoRequest, hider: boolean) =>
    request.photoId
        ? // The seekers' row opens the photo itself (round 43).
          hider
            ? { text: "Sent", className: "bg-green-900/70 text-green-100" }
            : { text: "Show", className: "bg-green-700 text-white" }
        : request.nullAnswer
          ? {
                text: "Can't be answered",
                className: "bg-slate-700 text-slate-200",
            }
          : hider
            ? { text: "Send it", className: "bg-blue-700 text-white" }
            : { text: "Waiting", className: "bg-blue-700 text-white" };

/**
 * The game's photo questions, under the questions (Questions tab): a row
 * each, the newest first; a row opens the photo question's screen.
 */
export const PhotoRows = () => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    // An answered photo, shown over everything (the seekers' Show).
    const [showing, setShowing] = useState<string | null>(null);
    if (!$game || $game.photoRequests.length === 0) return null;
    return (
        <section className="px-2 pb-2">
            <h3 className="px-1 pb-1 text-xs font-semibold text-slate-400">
                Photos
            </h3>
            <ul className="flex flex-col gap-1" data-testid="photo-requests">
                {[...$game.photoRequests].reverse().map((request) => {
                    const tag = status(request, $role === "hider");
                    return (
                        <li key={request.id}>
                            <button
                                type="button"
                                className="flex min-h-11 w-full items-center gap-2 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-sm hover:bg-slate-800"
                                data-testid="photo-request"
                                onClick={() =>
                                    // A seeker's answered photo: the photo
                                    // itself; anything else, its screen.
                                    $role !== "hider" && request.photoId
                                        ? setShowing(request.photoId)
                                        : pushScreen({
                                              tab: "questions",
                                              kind: "photo",
                                              id: request.id,
                                          })
                                }
                            >
                                <span aria-hidden>📷</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold">
                                        Photo · {request.name}
                                    </span>
                                    <span className="block text-xs text-slate-400">
                                        asked by {request.askedBy} ·{" "}
                                        {ago(request.askedAt, serverNow())}
                                    </span>
                                </span>
                                {request.randomizedFrom && (
                                    <span className="shrink-0 rounded bg-red-900/60 px-1.5 py-0.5 text-[11px] font-semibold text-red-100">
                                        Randomized
                                    </span>
                                )}
                                <span
                                    className={cn(
                                        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                                        tag.className,
                                    )}
                                >
                                    {tag.text}
                                </span>
                                <span className="text-slate-400" aria-hidden>
                                    ›
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {showing && (
                <PhotoViewer
                    photoId={showing}
                    onClose={() => setShowing(null)}
                />
            )}
        </section>
    );
};

/**
 * One photo question (mock-up 12): exactly what the photo must show, the
 * time to send it, what it earns; the hider sends it (camera, or the
 * gallery when the game allows), can't answer it, or randomizes it.
 */
export const PhotoScreen = ({ id }: { id: string }) => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const request = $game?.photoRequests.find((r) => r.id === id);
    const info = useRuleInfo("photo", request?.name);
    const [confirm, setConfirm] = useState<"null" | "randomize" | null>(null);
    const open = !!request && !request.photoId && !request.nullAnswer;
    useTick(open, 1000);
    if (!$game || !request) {
        return (
            <div className="flex flex-col gap-2 p-2" data-testid="photo-screen">
                <ScreenHeader title="Photo" kind="photo" />
                <p className="px-2 text-sm text-slate-400">
                    This photo question is gone.
                </p>
            </div>
        );
    }
    const size = $game.settings.size;
    const rules = photoQuestions().find((q) => q.name === request.name)?.rules;
    const left = photoTimeLeft(request, size, serverNow());
    const hider = $role === "hider";
    const hand = $game.deck?.hand;
    const canRandomize = hand ? hand.includes(RANDOMIZE_ID) : true;
    const again = timesPhotoAnsweredBefore($game, request.name, request.id);
    const minutes = photoTimeMs(size) / 60_000;
    return (
        <div className="flex min-h-full flex-col" data-testid="photo-screen">
            <ScreenHeader
                title="Photo"
                kind="photo"
                right={
                    <>
                        {left !== null && (
                            <span
                                className={cn(
                                    "shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-sm font-semibold tabular-nums",
                                    TONE[answerTimerTone(left)],
                                )}
                                data-testid="photo-timer"
                            >
                                ⏳ {answerTimerText(left)}
                            </span>
                        )}
                        {info.button}
                    </>
                }
            />
            {info.panel}
            <div className="flex flex-1 flex-col gap-3 p-3 text-sm">
                <h3 className="font-poppins text-xl font-semibold">
                    {request.name}
                </h3>
                <p className="text-slate-300">
                    Asked by {request.askedBy} ·{" "}
                    {ago(request.askedAt, serverNow())}
                    {request.randomizedFrom && (
                        <span data-testid="photo-randomized">
                            {" · "}
                            <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-red-100">
                                Randomized
                            </span>{" "}
                            was <strong>{request.randomizedFrom}</strong>
                            {request.randomizedAt &&
                                ` at ${clockTime(request.randomizedAt)}`}
                        </span>
                    )}
                </p>
                {rules && (
                    <div
                        className="rules-text rounded-xl bg-slate-800/80 p-3"
                        data-testid="photo-rule-text"
                    >
                        <p className="font-semibold">The rule.</p>
                        <RulesText markdown={rules} images={false} />
                    </div>
                )}
                <dl className="divide-y divide-slate-700 border-y border-slate-700">
                    <div className="flex justify-between gap-2 py-2">
                        <dt>Time to send</dt>
                        <dd className="text-slate-300">
                            {minutes} minutes ({size} game)
                        </dd>
                    </div>
                    <div className="flex justify-between gap-2 py-2">
                        <dt>{hider ? "You draw" : "The hider draws"}</dt>
                        <dd className="text-slate-300">
                            {DRAWS.photo.draw} card, keep {DRAWS.photo.keep}
                            {again > 0 && (
                                <span className="text-red-300">
                                    {" "}
                                    · {repeatBadge(again)}: asked before
                                </span>
                            )}
                        </dd>
                    </div>
                </dl>
                {request.late && (
                    <p className="font-semibold text-amber-300">
                        Sent late (
                        {request.late % 3 === 0
                            ? "the seekers' next question is free"
                            : `warning ${request.late % 3} of 2`}
                        ).
                    </p>
                )}
                {request.photoId && <Photo photoId={request.photoId} />}
                {request.nullAnswer && (
                    <p
                        className="rounded-lg bg-slate-800 p-2"
                        data-testid="photo-null-answer"
                    >
                        <strong>Can&apos;t be answered:</strong> the hider says
                        there&apos;s no such subject in their hiding zone.
                    </p>
                )}
                {open && !hider && (
                    <div className="flex items-center justify-between text-slate-400">
                        Waiting for the photo
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                void sendOp({
                                    type: "deletePhotoRequest",
                                    id: request.id,
                                });
                                back();
                            }}
                        >
                            Remove
                        </Button>
                    </div>
                )}
            </div>
            {open && hider && (
                <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-slate-700 bg-sidebar p-3">
                    <PhotoButton
                        label="📷 Take a photo"
                        requestId={request.id}
                        camera
                        className={cn(
                            "h-12 text-base font-semibold",
                            !$game.settings.galleryPhotos && "col-span-2",
                        )}
                    />
                    {$game.settings.galleryPhotos && (
                        <PhotoButton
                            label="From the gallery"
                            requestId={request.id}
                            camera={false}
                            variant="secondary"
                            className="h-12 text-base font-semibold"
                        />
                    )}
                    <Button
                        variant="outline"
                        className="h-auto min-h-11 whitespace-normal"
                        onClick={() => setConfirm("null")}
                    >
                        I cannot answer
                    </Button>
                    <Button
                        variant="outline"
                        className="h-auto min-h-11 whitespace-normal"
                        disabled={!canRandomize}
                        title="Play Randomize Question: another photo question, chosen at random, which you send instead"
                        onClick={() => setConfirm("randomize")}
                    >
                        {canRandomize ? "Randomize" : "Randomize (no card)"}
                    </Button>
                </div>
            )}
            <PlayCardConfirm
                cardId={confirm === "randomize" ? RANDOMIZE_ID : null}
                title="Randomize this photo question?"
                text="It becomes another photo question, chosen at random, which you send instead."
                action="Play Randomize"
                onPlay={() =>
                    void sendOp({ type: "randomizePhoto", id: request.id })
                }
                onClose={() => setConfirm(null)}
            />
            <AlertDialog
                open={confirm === "null"}
                onOpenChange={(value) => !value && setConfirm(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            &ldquo;I cannot answer&rdquo;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Only when the subject of the photo doesn&apos;t
                            exist in your hiding zone. You still draw your card.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                void sendOp({
                                    type: "photoNullAnswer",
                                    id: request.id,
                                })
                            }
                        >
                            Send: I cannot answer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

/** Photos sent without a question (anyone's), under the photo questions. */
export const OtherPhotos = () => {
    const $game = useStore(gameState);
    if (!$game) return null;
    const photos = $game.photos.filter((photo) => !photo.requestId).reverse();
    return (
        <details className="mx-2 mb-2 rounded-md border border-slate-700 px-2 py-1 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                Other photos ({photos.length})
            </summary>
            <div className="flex flex-col gap-2 pb-2">
                <PhotoButton
                    label="Add a photo"
                    camera={false}
                    variant="outline"
                />
                {photos.map((photo) => (
                    <div key={photo.id}>
                        <Photo photoId={photo.id} lazy />
                        <p className="text-xs text-slate-400">
                            {photo.by} · {ago(photo.at, serverNow())}
                        </p>
                    </div>
                ))}
            </div>
        </details>
    );
};
