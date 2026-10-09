// Reads the rulebook's Markdown pages (src/content/rules/) into sections, so
// the ⓘ popovers and the reference page can show the rules for one question.

export interface RulesSection {
    title: string;
    /** The heading's id on the rules page (same as Astro generates). */
    slug: string;
    level: number;
    /** Markdown up to the next heading. */
    body: string;
}

export interface RulesPage {
    title: string;
    /** Markdown before the first heading. */
    intro: string;
    sections: RulesSection[];
    /** A section by title (case-insensitive). */
    section: (title: string) => RulesSection | undefined;
}

/** Text of a heading without inline HTML or Markdown escapes. */
const plain = (text: string) =>
    text
        .replace(/<[^>]+>/g, "")
        .replace(/\\(.)/g, "$1")
        .trim();

/** GitHub-style heading id: "Station Name's Length" → "station-names-length". */
export const headingSlug = (title: string) =>
    plain(title)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s/g, "-");

export const parseRulesPage = (markdown: string): RulesPage => {
    const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/);
    const title =
        frontmatter?.[1].match(/^title:\s*["']?(.*?)["']?\s*$/m)?.[1] ?? "";
    const content = frontmatter
        ? markdown.slice(frontmatter[0].length)
        : markdown;

    const sections: RulesSection[] = [];
    const intro: string[] = [];
    let current: (RulesSection & { lines: string[] }) | null = null;
    for (const line of content.split("\n")) {
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
            if (current) sections.push(finish(current));
            current = {
                title: plain(heading[2]),
                slug: headingSlug(heading[2]),
                level: heading[1].length,
                body: "",
                lines: [],
            };
        } else if (current) {
            current.lines.push(line);
        } else {
            intro.push(line);
        }
    }
    if (current) sections.push(finish(current));

    return {
        title,
        intro: intro.join("\n").trim(),
        sections,
        section: (wanted) =>
            sections.find(
                (s) => s.title.toLowerCase() === wanted.toLowerCase(),
            ),
    };
};

const finish = ({
    lines,
    ...section
}: RulesSection & { lines: string[] }): RulesSection => ({
    ...section,
    body: lines.join("\n").trim(),
});
