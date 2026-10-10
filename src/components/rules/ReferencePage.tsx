import { CardFace } from "@/components/game/CardFace";
import { CardText, RulesText } from "@/components/RulesText";
import { withBase } from "@/lib/config";
import {
    CATEGORIES,
    type QuestionCategory,
    type TypeInfo,
    TYPES,
} from "@/lib/questionInfo";
import { CURSES, POWERUPS, TIME_BONUSES } from "@/lib/rules/cards";
import {
    categoryIntro,
    RULES_PAGES,
    rulesText,
    rulesUrl,
} from "@/lib/rules/content";
import { headingSlug } from "@/lib/rules/sections";

// Quick lookup during a game: every question type with its rules and how
// the app answers it, the photo questions and the hider deck. Rendered to
// static HTML by src/pages/reference.astro.

const ORDER: QuestionCategory[] = [
    "matching",
    "measuring",
    "thermometer",
    "radius",
    "tentacles",
];

const TypeEntry = ({ id, info }: { id: string; info: TypeInfo }) => {
    const rules = info.rules && rulesText(info.rules);
    return (
        <div id={id} className="rounded-md bg-slate-900 px-3 py-2">
            <h4 className="!mt-0">{info.label}</h4>
            {rules && <RulesText markdown={rules} images={false} />}
            {info.note && (
                <p className="text-slate-300">
                    <em>In this app:</em> {info.note}
                </p>
            )}
            {info.rules && (
                <p className="text-sm">
                    <a href={rulesUrl(info.rules)}>Full rules</a>
                </p>
            )}
        </div>
    );
};

/** The rest of a page after its introduction (e.g. distances by size). */
const pageSections = (page: keyof typeof RULES_PAGES) =>
    RULES_PAGES[page].sections
        .map(
            (section) =>
                `${"#".repeat(Math.max(section.level, 3))} ${section.title}\n\n${section.body}`,
        )
        .join("\n\n");

export const ReferencePage = () => {
    const nav = [
        ...ORDER.map((id) => [id, CATEGORIES[id].name]),
        ["photos", "Photos"],
        ["curses", "Curses"],
        ["powerups", "Powerups"],
        ["time-bonuses", "Time bonuses"],
    ];
    return (
        <main className="rules-text mx-auto max-w-3xl px-4 py-6 font-oxygen leading-relaxed">
            <p className="flex flex-wrap gap-x-4 text-sm">
                <a href={withBase("")}>← Back to the map</a>
                <a href={withBase("rules/")}>Full rules</a>
            </p>
            <h1>Question &amp; card reference</h1>
            <p className="text-slate-300">
                Every question the app knows, with its rules and how the app
                works out the answer, then the photo questions and the hider
                deck.
            </p>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {nav.map(([id, name]) => (
                    <a key={id} href={`#${id}`}>
                        {name}
                    </a>
                ))}
            </nav>

            {ORDER.map((id) => {
                const category = CATEGORIES[id];
                const types =
                    id === "matching" ||
                    id === "measuring" ||
                    id === "tentacles"
                        ? Object.entries(TYPES[id])
                        : [];
                return (
                    <section key={id} id={id}>
                        <h2>{category.name}</h2>
                        <RulesText
                            markdown={categoryIntro(category.rules.page)}
                            images={false}
                        />
                        {(id === "radius" || id === "thermometer") && (
                            <RulesText
                                markdown={pageSections(category.rules.page)}
                                images={false}
                            />
                        )}
                        <p className="text-slate-300">
                            <em>In this app:</em> {category.app}
                        </p>
                        <p className="text-sm">
                            <a href={rulesUrl(category.rules)}>Full rules</a>
                        </p>
                        {types.length > 0 && (
                            <div className="space-y-3">
                                {types.map(([type, info]) => (
                                    <TypeEntry
                                        key={type}
                                        id={`${id}-${type}`}
                                        info={info}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}

            <section id="photos">
                <h2>Photos</h2>
                <RulesText
                    markdown={categoryIntro("seeking/photo-questions")}
                    images={false}
                />
                <RulesText
                    markdown={pageSections("seeking/photo-questions")}
                    images={false}
                />
            </section>

            <section id="curses">
                <h2>Curses</h2>
                <RulesText
                    markdown={
                        rulesText({ page: "hiding/the-hider-deck/curses" })!
                    }
                />
                <div className="space-y-3">
                    {CURSES.map((curse) => {
                        const notes = rulesText({
                            page: "hiding/the-hider-deck/curses",
                            heading: curse.name,
                        });
                        return (
                            <div
                                key={curse.name}
                                id={headingSlug(curse.name)}
                                className="rounded-md bg-slate-900 px-3 py-2"
                            >
                                <h4 className="!mt-0">{curse.name}</h4>
                                <p>
                                    <CardText text={curse.effect} />
                                </p>
                                <p>
                                    <strong>Casting cost: </strong>
                                    <CardText text={curse.castingCost} />
                                </p>
                                {notes && (
                                    <details>
                                        <summary className="cursor-pointer text-slate-300">
                                            Rules notes
                                        </summary>
                                        <RulesText markdown={notes} />
                                    </details>
                                )}
                                <details>
                                    <summary className="cursor-pointer text-slate-300">
                                        Card
                                    </summary>
                                    <CardFace
                                        card={{
                                            id: curse.image,
                                            kind: "curse",
                                            name: curse.name,
                                            image: curse.image,
                                            effect: curse.effect,
                                        }}
                                        className="max-w-[300px]"
                                    />
                                </details>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section id="powerups">
                <h2>Powerups</h2>
                <div className="space-y-3">
                    {POWERUPS.map((powerup) => (
                        <div
                            key={powerup.name}
                            className="rounded-md bg-slate-900 px-3 py-2"
                        >
                            <h4 className="!mt-0">
                                {powerup.name}{" "}
                                <span className="text-sm font-normal text-slate-400">
                                    ×{powerup.count} in the deck
                                </span>
                            </h4>
                            <p>
                                <CardText text={powerup.effect} />
                            </p>
                        </div>
                    ))}
                </div>
                <p className="text-sm">
                    <a href={withBase("rules/hiding/the-hider-deck/powerups/")}>
                        Powerup rules
                    </a>
                </p>
            </section>

            <section id="time-bonuses">
                <h2>Time bonuses</h2>
                <table>
                    <thead>
                        <tr>
                            <th>
                                <span className="game-size game-size-small">
                                    Small
                                </span>
                            </th>
                            <th>
                                <span className="game-size game-size-medium">
                                    Medium
                                </span>
                            </th>
                            <th>
                                <span className="game-size game-size-large">
                                    Large
                                </span>
                            </th>
                            <th>In the deck</th>
                        </tr>
                    </thead>
                    <tbody>
                        {TIME_BONUSES.map((bonus) => (
                            <tr key={bonus.image}>
                                {bonus.minutes.map((minutes, n) => (
                                    <td key={n}>{minutes} min</td>
                                ))}
                                <td>×{bonus.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="text-sm">
                    <a
                        href={withBase(
                            "rules/hiding/the-hider-deck/time-bonuses/",
                        )}
                    >
                        Time bonus rules
                    </a>
                </p>
            </section>
        </main>
    );
};
