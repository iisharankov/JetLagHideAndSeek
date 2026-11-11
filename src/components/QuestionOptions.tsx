// How the questions show (round 48): pins, drafts and the card's layout.
// At the top of Questions (⚙, a pop-up) and in Menu → Settings → Questions.
import { useStore } from "@nanostores/react";
import { Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/toggle-card";
import { cardLayout, draftsOnMap, pinsOnMap } from "@/lib/context";

const Row = ({
    label,
    note,
    children,
}: {
    label: string;
    note: string;
    children: ReactNode;
}) => (
    <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
        </p>
        {children}
        <p className="text-xs text-slate-400">{note}</p>
    </div>
);

/** The three choices, as rows. */
export const QuestionOptionFields = () => {
    const $pins = useStore(pinsOnMap);
    const $drafts = useStore(draftsOnMap);
    const $card = useStore(cardLayout);
    const allOrActive = [
        { value: "all" as const, label: "All" },
        { value: "active" as const, label: "Active" },
    ];
    return (
        <>
            <Row
                label="Pins"
                note="Every question's pin, or only the active one's (last opened or tapped)."
            >
                <SegmentedControl
                    label="Pins"
                    options={allOrActive}
                    value={$pins}
                    onValueChange={pinsOnMap.set}
                />
            </Row>
            <Row
                label="Drafts"
                note="Drafts shade the map as if answered: all, or only the active one (the others outlined)."
            >
                <SegmentedControl
                    label="Drafts"
                    options={allOrActive}
                    value={$drafts}
                    onValueChange={draftsOnMap.set}
                />
            </Row>
            <Row
                label="Card"
                note="Labelled rows, or a sentence with words to tap."
            >
                <SegmentedControl
                    label="Card"
                    options={[
                        { value: "sections", label: "Sections" },
                        { value: "sentence", label: "Sentence" },
                    ]}
                    value={$card}
                    onValueChange={cardLayout.set}
                />
            </Row>
        </>
    );
};

/** ⚙ at the top of Questions: the choices in a small pop-up. */
export const QuestionOptions = () => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                aria-label="Question options"
                title="Question options: pins, drafts, the card"
            >
                <Settings2 className="h-4 w-4" aria-hidden />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            align="end"
            className="flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 border-slate-600 bg-slate-900 p-3 text-white"
            data-testid="question-options"
        >
            <QuestionOptionFields />
        </PopoverContent>
    </Popover>
);
