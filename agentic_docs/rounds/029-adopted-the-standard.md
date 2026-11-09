# Round 29, 2026-11-09: adopted the standard

Model: Fable 5.1. Budget: the rest of the session.

Asked: "please read the copied agentic-ai/standard folder i added just now and adjust all docs to it, including moving the original docs items to agentic-ai (or if the name was different, rename the folder, whoopise). The only thing in docs should be the project docs, unrelated to our vibe coding." Earlier in the session: the November game's seven points, planned (not built) into `plans/nov-game-fixes/`.

The round counter: the old plan's sections reached "Round 26" while the commits reached "Round 28" (the plan skipped "updates tutorials" and one round was split). This file follows the commits: round 29.

Answers used:
- (in chat) "it should all be set to metric! … (no imperial option)": a decision; the values wait on Q51.
- Not answered, not built: Q47, Q48, Q49 (since 2026-10-17), Q50 (since 2026-10-31).
- Closed items from the old questions file, carried here as adopt.md asks (answered in round 19, 2026-10-15): **Q43 (Overpass and other areas)** answered with the size table and "one box today"; **Q44 (Authelia)** "No Authelia then"; **Q45 (backups, accounts)** the download button and `backup.sh`, accounts to Q49; **Q46 (addresses)** "No addresses. Done." The full text is in `history/questions-before-the-standard.md`.

Did:
- **Renamed** `agentic-ai/` to `agentic_docs/` (the standard's name).
- **Old to new:**

| Old | New | What changed |
|---|---|---|
| `agentic-ai/standard/` | `agentic_docs/standard/` | moved, unchanged |
| `agentic-ai/Nov-Game-Fixes/` | `agentic_docs/plans/nov-game-fixes/` | moved; its links to `docs/plan.md`, `docs/questions.md`, `docs/architecture.md` fixed |
| `docs/plan.md` | `agentic_docs/history/rounds-before-the-standard.md` | moved as it was, one header line added; "What's left" rewritten into `roadmap.md` |
| `docs/questions.md` | `agentic_docs/questions.md` (Q47–Q50, new format) + `agentic_docs/history/questions-before-the-standard.md` (the file as it was) | the decisions list also in `agents/decisions.md` |
| `docs/audit.md` | `agentic_docs/history/audit-2026-10-17.md`; open findings into `agentic_docs/known-issues.md` | moved; findings copied, numbering kept |
| `docs/tutorial-revamp.md` | `agentic_docs/history/plans/tutorial-revamp.md` | moved (already had its Built note); link to the agent brief now points at `CLAUDE.md` |
| `docs/agent-brief.md` | `CLAUDE.md` + `agentic_docs/agents/notes.md` | content carried, file deleted |
| `docs/areas.md` | `docs/guides/areas.md` | moved; the link in the deploy doc fixed |
| `deploy/README.md` | `docs/deployment.md`; a pointer left at `deploy/README.md` | moved |
| `deploy/FIRST-DEPLOY.md` | `docs/guides/first-deploy.md` | moved |
| `docs/README.md` | rewritten: the project's pages only | the stale `how-we-work.md` link is gone |
| `README.md` (root) | links updated | |
| memory | one memory points at the standard; five project-status memories folded into `agents/notes.md` and deleted; `rules-text-in-app` kept | |

- **New:** `CLAUDE.md`, `agentic_docs/README.md`, `questions.md`, `roadmap.md`, `known-issues.md`, `agents/notes.md`, `agents/decisions.md`, `history/README.md`, this file.
- **`.prettierignore`:** `agentic_docs/` added next to `docs/`, so `lint:check` doesn't reflow prose. The only non-doc change.

Found on the way: `docs/README.md` linked a `how-we-work.md` that didn't exist. `docs/architecture.md`'s header said "as of round 19" and linked plan.md and audit.md; the links now point into `agentic_docs/`.

Checked: `npm run lint:check` (exit 0); every relative link in `agentic_docs/`, `docs/`, `CLAUDE.md`, `README.md`, `deploy/README.md` resolves; `grep -rn "docs/plan.md\|docs/questions.md\|agent-brief\|agentic-ai\|FIRST-DEPLOY\|docs/areas.md\|tutorial-revamp.md" --include=*.md .` outside `agentic_docs/history/` and this file finds nothing. Not run: the build and the tests (no code changed).
No root-run file changed.
Decisions: decisions.md, round 29. Steps created: S1–S4. Questions added: Q51–Q53.
Commit message: Round 29: adopted the standard v0.3; docs split into agentic_docs/ and docs/; the November plan filed under plans/
