import { Fragment } from "react";

import { withBase } from "@/lib/config";
import type { CardInfo } from "@/lib/game/deck";
import type { GameSize } from "@/lib/game/types";
import { cardImage, CURSES } from "@/lib/rules/cards";
import { cn } from "@/lib/utils";

const SIZE_INDEX: Record<GameSize, number> = { small: 0, medium: 1, large: 2 };

/** The S / M / L badges as the cards print them. */
const BADGES = [
    { label: "S", color: "#f5b324" },
    { label: "M", color: "#f26d21" },
    { label: "L", color: "#e4262c" },
];

/** Card text with "{a/b/c}" as the badges; the game's size stands out. */
const Badged = ({ text, size }: { text: string; size?: GameSize }) => (
    <>
        {text.split(/(\{[^}]+\})/).map((part, index) => {
            const values = part.match(/^\{(.+)\}$/)?.[1].split("/");
            if (!values) return <Fragment key={index}>{part}</Fragment>;
            return (
                <span
                    key={index}
                    className="inline-flex gap-[2px] whitespace-nowrap align-baseline"
                >
                    {values.map((value, i) => (
                        <span
                            key={i}
                            className="rounded-[2px] px-[3px] font-bold text-white"
                            style={{
                                background: BADGES[i]?.color ?? "#64748b",
                                opacity:
                                    size && SIZE_INDEX[size] !== i ? 0.4 : 1,
                            }}
                        >
                            {BADGES[i]?.label} {value}
                        </span>
                    ))}
                </span>
            );
        })}
    </>
);

/**
 * A card as a picture. Time bonuses and powerups are the printed cards'
 * pictures (their text has no distances). Curses and the players' own cards
 * are drawn from their text, so they read in metric and look like the
 * printed ones: an SVG that scales with its box.
 */
export const CardFace = ({
    card,
    size,
    photo,
    className,
}: {
    card: CardInfo;
    size?: GameSize;
    /** A custom card's own photo, instead of a drawn card. */
    photo?: string;
    className?: string;
}) => {
    if (photo) {
        return (
            <img
                src={photo}
                alt={card.name}
                className={cn("w-full rounded-md", className)}
            />
        );
    }
    if (card.image && card.kind !== "curse") {
        return (
            <img
                src={withBase(cardImage(card.image))}
                alt={card.name}
                loading="lazy"
                className={cn("w-full rounded-md", className)}
            />
        );
    }
    const curse = CURSES.find((c) => c.image === card.image);
    const effect = card.effect ?? "";
    const bodySize = effect.length > 520 ? 9.5 : effect.length > 380 ? 10 : 11;
    return (
        <svg
            viewBox="0 0 250 350"
            className={cn("w-full rounded-md", className)}
            role="img"
            aria-label={card.name}
        >
            <foreignObject x="0" y="0" width="250" height="350">
                <div
                    // @ts-expect-error The XHTML namespace, for the SVG.
                    xmlns="http://www.w3.org/1999/xhtml"
                    className="flex h-[350px] w-[250px] flex-col overflow-hidden bg-white px-[18px] py-[22px] font-poppins text-[#1e1b4b]"
                >
                    <h3 className="text-[19px] font-bold uppercase leading-[1.05]">
                        {card.name}
                    </h3>
                    <p
                        className="mt-[14px] flex-1 leading-[1.35] text-slate-800"
                        style={{ fontSize: bodySize }}
                    >
                        <Badged text={effect} size={size} />
                    </p>
                    {curse && (
                        <p className="mt-[8px] text-[10px] font-bold leading-snug">
                            Casting cost:{" "}
                            <Badged text={curse.castingCost} size={size} />
                        </p>
                    )}
                </div>
            </foreignObject>
        </svg>
    );
};
