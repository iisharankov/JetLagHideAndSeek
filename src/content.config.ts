import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

// The rulebook (src/content/rules/), shown at /rules/. One file per page;
// `order` is the reading order, `section` the top-level chapter.
const rules = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/rules" }),
    schema: z.object({
        title: z.string(),
        order: z.number(),
        section: z.string(),
    }),
});

export const collections = { rules };
