// The pieces of the Cards tab: a card's picture, the big view, a card in
// the hand with its buttons, and the rulebook's draws.
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    type CardInfo,
    cardLabel,
    CUSTOM_PREFIX,
    DRAWS,
} from "@/lib/game/deck";
import type { CustomCard, Draw, GameSize } from "@/lib/game/types";
import { cn } from "@/lib/utils";

import { CardFace } from "./CardFace";

const customPhoto = (card: CardInfo, custom: CustomCard[]) =>
    custom.find((own) => CUSTOM_PREFIX + own.id === card.id)?.photo;

/** A card's picture (a blank card with its name for the players' own). */
export const CardPicture = ({
    card,
    custom,
    size,
    onOpen,
    selected,
    className,
}: {
    card: CardInfo;
    custom: CustomCard[];
    size: GameSize;
    onOpen: () => void;
    selected?: boolean;
    className?: string;
}) => (
    <button
        type="button"
        aria-label={card.name}
        onClick={onOpen}
        className={cn(
            "block w-full overflow-hidden rounded-md border-2 border-transparent",
            selected && "border-blue-400 ring-2 ring-blue-400",
            className,
        )}
    >
        <CardFace card={card} size={size} photo={customPhoto(card, custom)} />
    </button>
);

/** The big view of a card, with its text. */
export const CardDialog = ({
    card,
    custom,
    size,
    onClose,
}: {
    card: CardInfo | null;
    custom: CustomCard[];
    size: GameSize;
    onClose: () => void;
}) => (
    <Dialog open={card !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="!bg-[hsl(var(--sidebar-background))] !text-white">
            {card && (
                <>
                    <DialogHeader>
                        <DialogTitle>
                            {cardLabel(card.id, size, custom)}
                        </DialogTitle>
                        <DialogDescription>
                            {card.kind === "time"
                                ? "Counts at the end of the round if it's still in your hand."
                                : "Tap outside to close."}
                        </DialogDescription>
                    </DialogHeader>
                    <CardFace
                        card={card}
                        size={size}
                        photo={customPhoto(card, custom)}
                        className="mx-auto max-h-[70vh] max-w-[360px]"
                    />
                </>
            )}
        </DialogContent>
    </Dialog>
);

/** A card in the hand: picture, name, what you can do with it. */
export const HandTile = ({
    card,
    custom,
    size,
    onOpen,
    onPlay,
    select,
    tag,
    dimmed,
}: {
    card: CardInfo;
    custom: CustomCard[];
    size: GameSize;
    onOpen: () => void;
    onPlay?: () => void;
    /**
     * Picking cards (to discard, for a cost or down to the hand limit): the
     * bar at the bottom (HandBar) says what for, and does it.
     */
    select?: { selected: boolean; onToggle: () => void; disabled?: boolean };
    /** What this card is doing now: "Casting". */
    tag?: string;
    /** Can't be picked for what's being done. */
    dimmed?: boolean;
}) => (
    <li
        className={cn("flex flex-col gap-1", dimmed && "opacity-40")}
        data-testid="hand-card"
    >
        <div className="relative">
            <CardPicture
                card={card}
                custom={custom}
                size={size}
                selected={select?.selected || !!tag}
                onOpen={onOpen}
            />
            {(tag || select?.selected) && (
                <span className="pointer-events-none absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    {tag ?? "✓"}
                </span>
            )}
        </div>
        <p className="line-clamp-2 text-center text-xs leading-tight">
            {cardLabel(card.id, size, custom)}
        </p>
        {onPlay && (
            <Button
                size="sm"
                className={cn(
                    "w-full",
                    card.kind === "curse"
                        ? "bg-red-700 hover:bg-red-600"
                        : "bg-amber-700 hover:bg-amber-600",
                )}
                onClick={onPlay}
            >
                {card.kind === "curse" ? "Cast" : "Play"}
            </Button>
        )}
        {select && (
            <Button
                size="sm"
                variant={select.selected ? "default" : "outline"}
                className="w-full"
                disabled={select.disabled && !select.selected}
                aria-pressed={select.selected}
                onClick={select.onToggle}
            >
                {select.selected ? "✓ Selected" : "Select"}
            </Button>
        )}
    </li>
);

/**
 * Pinned to the bottom of the Cards tab while cards are being picked: what
 * they're for, and the button that does it, in reach wherever the cards
 * are scrolled to.
 */
export const HandBar = ({
    children,
    actions,
    tone = "blue",
}: {
    children: React.ReactNode;
    actions: React.ReactNode;
    tone?: "blue" | "amber";
}) => (
    <div
        className={cn(
            "sticky bottom-0 z-10 -mx-3 -mb-3 mt-auto flex flex-col gap-2 border-t bg-[hsl(var(--sidebar-background))] p-3 text-xs shadow-[0_-8px_16px_rgba(0,0,0,0.45)]",
            tone === "amber" ? "border-amber-500/70" : "border-blue-500/70",
        )}
        data-testid="hand-bar"
    >
        <p>{children}</p>
        <div className="flex gap-2 [&>*]:flex-1">{actions}</div>
    </div>
);

export const DrawButtons = ({ onPick }: { onPick: (draw: Draw) => void }) => (
    <div className="flex flex-col gap-1">
        {Object.entries(DRAWS).map(([key, draw]) => (
            <Button
                key={key}
                size="sm"
                variant="outline"
                className="justify-start whitespace-normal text-left"
                onClick={() => onPick(draw)}
            >
                {draw.label}: draw {draw.draw}, keep {draw.keep}
            </Button>
        ))}
    </div>
);
