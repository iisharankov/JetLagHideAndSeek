import { Fragment, type ReactNode } from "react";

// Renders the rulebook's Markdown (src/content/rules/) as React: paragraphs,
// headings, lists, tables, quotes, images, bold/italic, links and the
// SMALL/MEDIUM/LARGE badges. Any other HTML in the text is shown as text.

const SIZE_BADGE =
    /^<span class="game-size game-size-(small|medium|large)">(\w+)<\/span>/;

/** Inline Markdown → React nodes. */
const inline = (text: string, key = "i"): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let plain = "";
    const flush = () => {
        if (plain) nodes.push(plain);
        plain = "";
    };
    let i = 0;
    while (i < text.length) {
        const rest = text.slice(i);
        const k = `${key}-${i}`;
        if (rest[0] === "\\" && rest.length > 1) {
            plain += rest[1];
            i += 2;
            continue;
        }
        const badge = rest.match(SIZE_BADGE);
        if (badge) {
            flush();
            nodes.push(
                <span key={k} className={`game-size game-size-${badge[1]}`}>
                    {badge[2]}
                </span>,
            );
            i += badge[0].length;
            continue;
        }
        if (rest.startsWith("**")) {
            const end = rest.indexOf("**", 2);
            if (end > 2) {
                flush();
                nodes.push(
                    <strong key={k}>{inline(rest.slice(2, end), k)}</strong>,
                );
                i += end + 2;
                continue;
            }
        }
        if (rest[0] === "*") {
            const end = rest.indexOf("*", 1);
            if (end > 1) {
                flush();
                nodes.push(<em key={k}>{inline(rest.slice(1, end), k)}</em>);
                i += end + 1;
                continue;
            }
        }
        if (rest[0] === "`") {
            const end = rest.indexOf("`", 1);
            if (end > 1) {
                flush();
                nodes.push(<code key={k}>{rest.slice(1, end)}</code>);
                i += end + 1;
                continue;
            }
        }
        const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
        if (link) {
            flush();
            const external = /^https?:/.test(link[2]);
            nodes.push(
                <a
                    key={k}
                    href={link[2]}
                    {...(external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                >
                    {inline(link[1], k)}
                </a>,
            );
            i += link[0].length;
            continue;
        }
        plain += rest[0];
        i += 1;
    }
    flush();
    return nodes;
};

const withBreaks = (text: string, key: string) =>
    text
        .split(/ {2}\n/)
        .flatMap((part, index) => [
            ...(index > 0 ? [<br key={`${key}-br${index}`} />] : []),
            <Fragment key={`${key}-p${index}`}>
                {inline(part.replace(/\n/g, " "), `${key}-${index}`)}
            </Fragment>,
        ]);

const isItem = (line: string) => /^\s*(?:- |\d+\. )/.test(line);

export const RulesText = ({
    markdown,
    images = true,
}: {
    markdown: string;
    /** Show the diagrams (off in small popovers). */
    images?: boolean;
}) => {
    const blocks = markdown.trim().split(/\n{2,}/);
    return (
        <>
            {blocks.map((block, index) => {
                const key = `b${index}`;
                const heading = block.match(/^(#{1,6})\s+(.*)$/);
                if (heading) {
                    const Tag = `h${heading[1].length}` as "h4";
                    return <Tag key={key}>{inline(heading[2], key)}</Tag>;
                }
                const image = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
                if (image) {
                    return images ? (
                        <img
                            key={key}
                            src={image[2]}
                            alt={image[1].replace(/\\(.)/g, "$1")}
                            loading="lazy"
                        />
                    ) : null;
                }
                const lines = block.split("\n");
                if (lines.every(isItem)) {
                    const ordered = /^\s*\d+\. /.test(lines[0]);
                    const items = lines.map((line, n) => (
                        <li key={n}>
                            {inline(
                                line.replace(/^\s*(?:- |\d+\. )/, ""),
                                `${key}-${n}`,
                            )}
                        </li>
                    ));
                    return ordered ? (
                        <ol key={key}>{items}</ol>
                    ) : (
                        <ul key={key}>{items}</ul>
                    );
                }
                if (lines.every((line) => line.startsWith(">"))) {
                    return (
                        <blockquote key={key}>
                            <RulesText
                                markdown={lines
                                    .map((line) => line.replace(/^> ?/, ""))
                                    .join("\n")}
                                images={images}
                            />
                        </blockquote>
                    );
                }
                if (lines.every((line) => line.startsWith("|"))) {
                    const cells = (line: string) =>
                        line
                            .slice(1, -1)
                            .split(/(?<!\\)\|/)
                            .map((cell) => cell.trim());
                    const [head, , ...rows] = lines;
                    return (
                        <table key={key}>
                            <thead>
                                <tr>
                                    {cells(head).map((cell, n) => (
                                        <th key={n}>
                                            {inline(cell, `${key}h${n}`)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, r) => (
                                    <tr key={r}>
                                        {cells(row).map((cell, n) => (
                                            <td key={n}>
                                                {inline(
                                                    cell,
                                                    `${key}r${r}c${n}`,
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    );
                }
                return <p key={key}>{withBreaks(block, key)}</p>;
            })}
        </>
    );
};

const SIZES = [
    ["small", "S"],
    ["medium", "M"],
    ["large", "L"],
] as const;

/**
 * Card text where "{1/5/30}" means 1, 5 or 30 depending on the game size
 * (small/medium/large), shown as S/M/L badges like on the cards.
 */
export const CardText = ({ text }: { text: string }) => (
    <>
        {text.split(/(\{[^}]+\})/).map((part, index) => {
            const values = part.match(/^\{(.+)\}$/)?.[1].split("/");
            if (!values) return <Fragment key={index}>{part}</Fragment>;
            return (
                <Fragment key={index}>
                    {values.map((value, n) => (
                        <Fragment key={n}>
                            {n > 0 && " "}
                            <span
                                className={`game-size game-size-${SIZES[n][0]}`}
                            >
                                {SIZES[n][1]} {value}
                            </span>
                        </Fragment>
                    ))}
                </Fragment>
            );
        })}
    </>
);
