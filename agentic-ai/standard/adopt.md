# Adopting the standard in an existing project

Version 0.3, 2026-11-08. For the agent of a project that already has its own docs. Read [README.md](README.md), [agents.md](agents.md) and [profile.md](profile.md) first. Adopting is one round, about an hour, and touches the docs only.

## Before you start

The owner copies the standard into `agentic_docs/standard/` himself. If the folder is missing, stop and give him the command:

```bash
mkdir -p agentic_docs && cp -r ~/Workspace/github/iisharankov/standardization/standard agentic_docs/standard
```

## What must not happen

- **No code changes and no behaviour changes.** Fixing a bug you notice is a later round: put it in `known-issues.md`.
- **No git commands that change anything.** Use plain `mv`, never `git mv` or `git rm`: both stage changes. The owner's `git add -A` picks the moves up.
- **Nothing is lost.** Keep the owner's answers and quotes, every question ID (never renumber: other documents cite them), every decision and every open item. Move text rather than rewrite it. When a file's content is messy, move it to `agentic_docs/history/` as it is, rather than editing it.
- **Files other repos link to stay put,** such as a contract at a fixed path. Leave them, and say so in `CLAUDE.md`.
- **No real data, as always.** Don't open the files the deny list or the rules name, even to see what is in a folder.
- **Nothing in `agentic_docs/standard/` is edited.**

## Steps

1. **Open the round file.** Continue the project's own round counter: if the last round was 53, this is `agentic_docs/rounds/054-adopted-the-standard.md`. Where the project counted something else, or nothing, start at 001 and say so in the file. Fill it in as you go.
2. **Take inventory.** The work files (questions, plans, roadmap, known issues, agent notes, round logs, decisions, history) move to `agentic_docs/`. The pages that describe the project (architecture, deployment, configuration, guides) stay in `docs/`. List every Markdown file in the repo and every memory file. Map each to its home in the layout (agents.md, section 3), in a table: old path, new path, what changes.
3. **Write `CLAUDE.md`** from the template in agents.md's appendix. Its first line names the version and points to `agentic_docs/standard/`. Take the rules and commands from the old agent brief (`agent-brief.md`, `AGENT-CONTEXT.md`, `START-HERE.md`, the notes README). The longer parts go to `agentic_docs/agents/notes.md`. Under "Differs from it in", list what this project keeps differently, each with why.
4. **The questions file** becomes `agentic_docs/questions.md`:
   - open questions keep their IDs; new ones continue the Q counter;
   - the answer line becomes `> **Answer:**`, and the suggestion line `*Suggested:*`;
   - **the header changes meaning:** where it said "a blank answer takes the suggestion" (HomeHunter, Augury), it now says a blank is unanswered and nothing is built for it. Say this in the hand-back, because the owner has relied on the old meaning in those projects;
   - each open question gets "(asked <date>)" when the date is known;
   - the sections are Now, Plans waiting on you, Questions, Your steps;
   - the owner's steps become checkboxes with Where, Expect and Done (agents.md, section 6), in order;
   - an "Only 5 minutes?" line goes at the top when more than five items are open;
   - answered items leave the file: their title and the owner's answer, word for word, go into the round file you opened in step 1, under "Answers used".
5. **Decisions** go to `agentic_docs/agents/decisions.md`, whether they were kept at the end of the questions file, in a decided table or in their own file. Keep the per-round blocks and the owner's words.
6. **The old round log** (`plan.md` sections, `rounds.md`, `history.md`, notes) is **not split into one file per round.** Move it, as it is, to `agentic_docs/history/rounds-before-the-standard.md`, with one line at the top saying what it is and which rounds it covers. `agentic_docs/rounds/` starts with this round's file. *Why:* splitting a 1,300-line log by hand is an hour of risk for no gain; the old log stays searchable where it is.
7. **The State and the traps** go to `agentic_docs/agents/notes.md`: the current status (status.md, a "state" section, "what's left"), and every trap or lesson learned. Write the State fresh, on today's date, from what is true now.
8. **The other files:**
   - plans not yet built go to `agentic_docs/plans/`; built ones go to `agentic_docs/history/plans/` with a Built note;
   - ideas and "what's next" go to `agentic_docs/roadmap.md`;
   - bugs, debt and audit findings go to `agentic_docs/known-issues.md`;
   - setup walkthroughs go to `docs/guides/`;
   - project-specific reference pages (`api.md`, `method.md`) stay and are listed in `agentic_docs/README.md`;
   - one-off handoff files whose content is now saved are deleted.
9. **Indexes and links:** write `agentic_docs/README.md` (every file, one line each) and update the root README's table of docs. Check every relative link, and grep for every old file name.
10. **Finish the round file:** the old-to-new table goes in it, under "Did".
11. **Memory:** add one memory that points to `agentic_docs/standard/` and its version. Remove memories that now say the same as `profile.md` or the standard. Keep those holding feedback that only applies to this project.

## The hand-back

- The old-to-new table, and what the project keeps differently, with why.
- The sentence about blank answers, if the project used to take the suggestion on a blank.
- "Links checked; grep for the old names finds nothing."
- All open questions, each in `agentic_docs/questions.md` with a suggestion, with their dates. At most three new ones, only those the adoption couldn't settle.
- **For the standard:** what this project knows that `profile.md` or the standard gets wrong or misses. Don't edit the copy; the owner carries this to the original.
- A proposed commit message, "Round N: adopted the standard v0.3". The owner commits.

## On the server

The copy in `agentic_docs/standard/` travels with the repo, so an agent on the server has it once the owner pulls. Nothing else is needed.
