import { InfoIcon } from "lucide-react";

import { RulesText } from "@/components/RulesText";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { withBase } from "@/lib/config";
import { type QuestionCategory, questionInfo } from "@/lib/questionInfo";
import { categoryIntro, rulesText, rulesUrl } from "@/lib/rules/content";

/** ⓘ next to a question: the rules for it and how the app answers it. */
export const QuestionInfoButton = ({
    category,
    type,
}: {
    category: QuestionCategory;
    type?: string;
}) => {
    const info = questionInfo(category, type);
    const typeRules = info.type?.rules && rulesText(info.type.rules);
    return (
        <Popover>
            <PopoverTrigger
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white opacity-80 hover:opacity-100"
                aria-label="About this question"
            >
                <InfoIcon className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent
                className="rules-text text-sm w-80 max-h-[70vh] overflow-y-auto"
                align="end"
            >
                <p className="font-semibold text-base">
                    {info.category.name}
                    {info.type && `: ${info.type.label}`}
                </p>
                <RulesText
                    markdown={categoryIntro(info.category.rules.page)}
                    images={false}
                />
                {typeRules && (
                    <>
                        <p className="font-semibold">
                            {info.type!.rules!.heading}
                        </p>
                        <RulesText markdown={typeRules} images={false} />
                    </>
                )}
                <p className="font-semibold">In this app</p>
                <p>{info.category.app}</p>
                {info.type?.note && <p>{info.type.note}</p>}
                <p className="flex flex-wrap gap-x-3">
                    <a
                        href={rulesUrl(info.type?.rules ?? info.category.rules)}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Full rules
                    </a>
                    <a
                        href={withBase("reference/")}
                        target="_blank"
                        rel="noreferrer"
                    >
                        All questions
                    </a>
                </p>
            </PopoverContent>
        </Popover>
    );
};
