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
    onDiscard,
    selected,
    onSelect,
}: {
    card: CardInfo;
    custom: CustomCard[];
    size: GameSize;
    onOpen: () => void;
    onPlay?: () => void;
    /** Only while the hand is over its limit (or a card's cost asks). */
    onDiscard?: () => void;
    /** Choosing cards to discard for a "Discard N, draw M". */
    selected?: boolean;
    onSelect?: () => void;
}) => (
    <li className="flex flex-col gap-1" data-testid="hand-card">
        <CardPicture
            card={card}
            custom={custom}
            size={size}
            selected={selected}
            onOpen={onOpen}
        />
        <p className="line-clamp-2 text-center text-xs leading-tight">
            {cardLabel(card.id, size, custom)}
        </p>
        {onSelect && (
            <Button
                size="sm"
                variant={selected ? "default" : "outline"}
                onClick={onSelect}
            >
                {selected ? "Discard ✓" : "Discard this"}
            </Button>
        )}
        {!onSelect && (
            <div className="flex flex-col gap-1">
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
                {onDiscard && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={onDiscard}
                    >
                        Discard
                    </Button>
                )}
            </div>
        )}
    </li>
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
