import { useState } from "react";

import { RulesText } from "@/components/RulesText";
import { withBase } from "@/lib/config";
import { type QuestionCategory, questionInfo } from "@/lib/questionInfo";
import {
    categoryIntro,
    PHOTO_PAGE,
    photoQuestions,
    rulesText,
    rulesUrl,
} from "@/lib/rules/content";
import { openRules, rulesViewFromHref } from "@/lib/rulesOverlay";
import { cn } from "@/lib/utils";

export type RuleCategory = QuestionCategory | "photo";

/** The round "i" at a question screen's top right (principle 5). */
export const RuleInfoButton = ({
    open,
    onClick,
    className,
}: {
    open: boolean;
    onClick: () => void;
    className?: string;
}) => (
    <button
        type="button"
        className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center",
            className,
        )}
        aria-label="About this question"
        aria-expanded={open}
        title="The rules for this question"
        onClick={onClick}
    >
        <span
            className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border border-slate-400 font-serif text-sm font-bold italic",
                open && "border-blue-400 bg-blue-600 text-white",
            )}
            aria-hidden
        >
            i
        </span>
    </button>
);

/**
 * What the "i" unfolds: the rule for this question (the rulebook's text
 * for the type, or the kind's first paragraph), how the app works it out,
 * and the way to the full rules.
 */
export const RulePanel = ({
    category,
    type,
}: {
    category: RuleCategory;
    type?: string;
}) => {
    if (category === "photo") {
        const photo = type
            ? photoQuestions().find((q) => q.name === type)
            : undefined;
        return (
            <Panel
                title={photo ? `Photo: ${photo.name}` : "Photo"}
                rule={photo?.rules ?? firstParagraph(PHOTO_PAGE.intro)}
                app="The hider sends a photo that meets the rule, or says it can't be answered. The seekers judge it."
                url={rulesUrl({ page: "seeking/photo-questions" })}
            />
        );
    }
    const info = questionInfo(category, type);
    const typeRule = info.type?.rules && rulesText(info.type.rules);
    return (
        <Panel
            title={
                info.category.name + (info.type ? `: ${info.type.label}` : "")
            }
            ruleHeading={typeRule ? info.type!.rules!.heading : undefined}
            rule={
                typeRule ||
                firstParagraph(categoryIntro(info.category.rules.page))
            }
            app={info.category.app}
            note={info.type?.note}
            url={rulesUrl(info.type?.rules ?? info.category.rules)}
        />
    );
};

/** A rules link that opens the rules over the app, not a new tab. */
const inOverlay = (href: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    if (href === "reference") openRules("reference");
    else {
        const view = rulesViewFromHref(href);
        openRules(view?.page, view?.heading);
    }
};

const firstParagraph = (markdown: string) =>
    markdown.split(/\n{2,}/).find((block) => block.trim()) ?? "";

const Panel = ({
    title,
    ruleHeading,
    rule,
    app,
    note,
    url,
}: {
    title: string;
    ruleHeading?: string;
    rule: string;
    app: string;
    note?: string;
    url: string;
}) => (
    <div
        className="rules-text mx-2 mb-2 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-sm"
        data-testid="rule-info"
    >
        <p className="text-base font-semibold">{title}</p>
        {ruleHeading && <p className="font-semibold">{ruleHeading}</p>}
        <RulesText markdown={rule} images={false} />
        <p className="font-semibold">In this app</p>
        <p>{app}</p>
        {note && <p>{note}</p>}
        <p className="flex flex-wrap gap-x-4">
            <a href={url} onClick={inOverlay(url)}>
                Full rules
            </a>
            <a href={withBase("reference/")} onClick={inOverlay("reference")}>
                All questions
            </a>
        </p>
    </div>
);

/** The "i" and what it unfolds, for a screen that places them apart. */
export const useRuleInfo = (category: RuleCategory, type?: string) => {
    const [open, setOpen] = useState(false);
    return {
        button: (
            <RuleInfoButton open={open} onClick={() => setOpen((o) => !o)} />
        ),
        panel: open ? <RulePanel category={category} type={type} /> : null,
    };
};
