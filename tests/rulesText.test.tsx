import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CardText, RulesText } from "@/components/RulesText";

const html = (markdown: string) =>
    renderToStaticMarkup(<RulesText markdown={markdown} />);

describe("RulesText", () => {
    it("renders paragraphs with bold, italics, escapes and links", () => {
        expect(
            html(
                'Format: "Are you within \\_\\_\\_\\_ of me?" The hider may **draw 2 cards and keep 1**, *usually*. See [hiding zones](/rules/hiding/hiding-zones/).',
            ),
        ).toBe(
            '<p>Format: &quot;Are you within ____ of me?&quot; The hider may <strong>draw 2 cards and keep 1</strong>, <em>usually</em>. See <a href="/rules/hiding/hiding-zones/">hiding zones</a>.</p>',
        );
    });

    it("renders lists, headings, images and game-size badges", () => {
        const out = html(
            [
                "#### Zoo",
                "",
                "- ¼ Mile",
                "- 1 Mile",
                "",
                '**<span class="game-size game-size-large">LARGE</span> games**',
                "",
                "![A diagram](/rules/img/x.webp)",
            ].join("\n"),
        );
        expect(out).toContain("<h4>Zoo</h4>");
        expect(out).toContain("<ul><li>¼ Mile</li><li>1 Mile</li></ul>");
        expect(out).toContain(
            '<strong><span class="game-size game-size-large">LARGE</span> games</strong>',
        );
        expect(out).toContain('<img src="/rules/img/x.webp" alt="A diagram"');
    });

    it("can leave out images (for small popovers)", () => {
        expect(
            renderToStaticMarkup(
                <RulesText markdown="![A diagram](/x.webp)" images={false} />,
            ),
        ).toBe("");
    });

    it("never renders other HTML from the text", () => {
        expect(html("<script>alert(1)</script>")).toBe(
            "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
        );
    });
});

describe("CardText", () => {
    it("shows values that depend on the game size as S/M/L badges", () => {
        expect(
            renderToStaticMarkup(
                <CardText text="Seekers must be at least {1/5/30} miles from you." />,
            ),
        ).toBe(
            'Seekers must be at least <span class="game-size game-size-small">S 1</span> <span class="game-size game-size-medium">M 5</span> <span class="game-size game-size-large">L 30</span> miles from you.',
        );
    });
});
