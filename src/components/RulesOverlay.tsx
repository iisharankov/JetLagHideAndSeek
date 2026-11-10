import { useStore } from "@nanostores/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ReferencePage } from "@/components/rules/ReferencePage";
import { RulesText } from "@/components/RulesText";
import { headingSlug } from "@/lib/rules/sections";
import {
    closeRules,
    rulesOverlay,
    rulesViewFromHref,
} from "@/lib/rulesOverlay";
import { cn } from "@/lib/utils";

interface Page {
    id: string;
    title: string;
    order: number;
    body: string;
}

// The rulebook's pages, loaded the first time the rules open.
const files = import.meta.glob("/src/content/rules/**/*.md", {
    query: "?raw",
    import: "default",
}) as Record<string, () => Promise<string>>;

let loaded: Promise<Page[]> | null = null;
const loadPages = () =>
    (loaded ??= Promise.all(
        Object.entries(files).map(async ([path, load]) => {
            const raw = await load();
            const front = raw.match(/^---\n([\s\S]*?)\n---\n/);
            const field = (name: string) =>
                front?.[1]
                    .match(new RegExp(`^${name}:\\s*["']?(.*?)["']?\\s*$`, "m"))
                    ?.at(1);
            return {
                id: path
                    .replace(/^\/src\/content\/rules\//, "")
                    .replace(/\.md$/, ""),
                title: field("title") ?? path,
                order: Number(field("order") ?? 999),
                body: front ? raw.slice(front[0].length) : raw,
            };
        }),
    ).then((pages) => pages.sort((a, b) => a.order - b.order)));

/** Plain text of a markdown block, for the search's snippets. */
const plain = (text: string) =>
    text
        .replace(/<[^>]+>/g, "")
        .replace(/[*_#>`\\]/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

/**
 * The rules over the app (round 42): the page list (opens from ☰), a
 * search over every page, the page itself; × closes it, the game is still
 * there underneath. "Questions & cards" is the reference.
 */
export const RulesOverlay = () => {
    const view = useStore(rulesOverlay);
    const [pages, setPages] = useState<Page[] | null>(null);
    const [listOpen, setListOpen] = useState(false);
    const [search, setSearch] = useState("");
    const body = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (view && !pages) void loadPages().then(setPages);
    }, [view, pages]);
    useEffect(() => {
        if (!view) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeRules();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [view]);

    const pageId = view?.page || pages?.[0]?.id || "";
    const page =
        pageId === "reference"
            ? null
            : (pages?.find((p) => p.id === pageId) ?? pages?.[0] ?? null);

    // To the heading asked for, or the top.
    useEffect(() => {
        if (!view || !body.current) return;
        const target = view.heading
            ? body.current.querySelector(`[id="${view.heading}"]`)
            : null;
        if (target) target.scrollIntoView({ block: "start" });
        else body.current.scrollTop = 0;
    }, [view?.page, view?.heading, page?.id]);

    const found = useMemo(() => {
        const typed = search.trim().toLowerCase();
        if (!pages || typed.length < 2) return [];
        return pages.flatMap((p) =>
            p.body
                .split(/\n{2,}/)
                .map((block, index, blocks) => ({ block, index, blocks }))
                .filter(({ block }) =>
                    plain(block).toLowerCase().includes(typed),
                )
                .slice(0, 3)
                .map(({ block, index, blocks }) => {
                    // The heading above the match, to jump to.
                    const heading = blocks
                        .slice(0, index + 1)
                        .reverse()
                        .find((b) => /^#{1,6}\s/.test(b));
                    return {
                        page: p,
                        text: plain(block).slice(0, 160),
                        heading: heading
                            ? headingSlug(heading.replace(/^#{1,6}\s+/, ""))
                            : undefined,
                    };
                }),
        );
    }, [pages, search]);

    if (!view) return null;

    const go = (next: { page: string; heading?: string }) => {
        rulesOverlay.set(next);
        setListOpen(false);
        setSearch("");
    };

    return (
        <div
            className="fixed inset-0 z-[1100] flex flex-col bg-[hsl(var(--sidebar-background))] text-white"
            role="dialog"
            aria-label="Rules"
            data-testid="rules-overlay"
        >
            <header className="flex items-center gap-2 border-b border-slate-700 p-2">
                <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xl"
                    aria-label="Rules pages"
                    aria-expanded={listOpen}
                    onClick={() => setListOpen((open) => !open)}
                >
                    ☰
                </button>
                <input
                    type="search"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 text-base"
                    placeholder="Search the rules"
                    aria-label="Search the rules"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-2xl"
                    aria-label="Close the rules"
                    onClick={closeRules}
                >
                    ×
                </button>
            </header>
            <div className="relative flex min-h-0 flex-1">
                <nav
                    className={cn(
                        "absolute inset-y-0 left-0 z-10 w-72 max-w-[85vw] overflow-y-auto border-r border-slate-700 bg-slate-950 p-2 transition-transform md:static md:translate-x-0",
                        listOpen ? "translate-x-0" : "-translate-x-full",
                    )}
                    aria-label="Rules pages"
                >
                    <button
                        type="button"
                        className={cn(
                            "block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold",
                            pageId === "reference"
                                ? "bg-blue-600"
                                : "hover:bg-white/10",
                        )}
                        onClick={() => go({ page: "reference" })}
                    >
                        Questions &amp; cards
                    </button>
                    {(pages ?? []).map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            className={cn(
                                "block min-h-11 w-full rounded-lg px-3 text-left text-sm",
                                p.id === page?.id && pageId !== "reference"
                                    ? "bg-blue-600 font-semibold"
                                    : "hover:bg-white/10",
                                p.id.includes("/") && "pl-6",
                            )}
                            onClick={() => go({ page: p.id })}
                        >
                            {p.title}
                        </button>
                    ))}
                </nav>
                <div
                    ref={body}
                    className="min-w-0 flex-1 overflow-y-auto p-4"
                    onClick={(event) => {
                        // Links between rules pages stay in here.
                        const link = (event.target as HTMLElement).closest("a");
                        const href = link?.getAttribute("href") ?? "";
                        const next = rulesViewFromHref(href);
                        if (next) {
                            event.preventDefault();
                            go(next);
                        } else if (href.startsWith("#")) {
                            event.preventDefault();
                            go({ page: pageId, heading: href.slice(1) });
                        }
                    }}
                >
                    {search.trim().length >= 2 ? (
                        <ul
                            className="flex flex-col gap-2"
                            data-testid="rules-results"
                        >
                            {found.length === 0 && (
                                <li className="text-slate-400">
                                    Nothing in the rules for that.
                                </li>
                            )}
                            {found.map((hit, index) => (
                                <li key={index}>
                                    <button
                                        type="button"
                                        className="w-full rounded-lg border border-slate-700 p-3 text-left hover:bg-white/5"
                                        onClick={() =>
                                            go({
                                                page: hit.page.id,
                                                heading: hit.heading,
                                            })
                                        }
                                    >
                                        <span className="block text-xs font-semibold text-blue-300">
                                            {hit.page.title}
                                        </span>
                                        <span className="text-sm">
                                            {hit.text}…
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : pageId === "reference" ? (
                        <ReferencePage />
                    ) : page ? (
                        <article className="rules-text mx-auto max-w-3xl">
                            <h1>{page.title}</h1>
                            <RulesText markdown={page.body} />
                        </article>
                    ) : (
                        <p className="text-slate-400">Loading the rules…</p>
                    )}
                </div>
            </div>
        </div>
    );
};
