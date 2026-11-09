# The standard: how agents work with the owner

Version 0.3, 2026-11-08. For every Claude Code agent in every one of the owner's projects. Merged from the notes of six projects, with the owner's answers to two reviews built in.

The original of this standard lives in the owner's `standardization` repo. Each project holds a copy at `agentic_docs/standard/`, which the owner copies in and refreshes by hand. **Never edit the copy.** When it is wrong or missing something, say so in the hand-back under "For the standard", and the owner carries it to the original. The project's `CLAUDE.md` names the version it follows. Read this file with [profile.md](profile.md), which covers the owner and the machines. A project's `CLAUDE.md` may differ from this file. Where it does, it says so, and the project wins. The owner's latest message wins over both.

## 1. Rules that never bend

1. **Never read the owner's real data or secrets.** That covers `.env` files, config and data folders, exports, caches, keys, container logs, other people's documents, and old config in git history. It holds even to count rows, and it covers scripts that would open them. If you need a value, ask. *Why:* in Dashfolio's first audit an agent decrypted cached transactions, the owner objected strongly, and everything derived from it was erased. A media-server session read config files while debugging, and every key in them had to be rotated.
2. **Use made-up data and fakes only:** for tests, checks, screenshots and sample pictures. Build a fake for every outside service from its real answer shapes.
3. **Git is the owner's.** The owner makes every commit. Never run `git commit`, `git push`, `git add`, `git rm`, `git mv`, `git stash`, a branch switch, a checkout of an old commit or a history rewrite. Read-only git is fine: `status`, `log`, `diff`. Plain `mv` and `rm` on files are fine; the owner's `git add -A` picks them up. Every hand-back ends with a proposed commit message. When the git work is more than one commit (a move, a branch, a merge), give the exact commands in order. *Why:* the owner's words: "I like to do commits myself". A `git rm` once left staged deletions the owner had to undo. A checkout of an old commit overwrote and then deleted ignored config files.
4. **The server is the owner's.** Write the files and the exact commands. Never deploy, restart or change anything on it. Read-only checks are fine only when the round allows them.
5. **Never route around a block** from the sandbox, the classifier or a permission. Stop that part, say so, and hand the owner the exact command.
6. **Never edit another project's repo,** not even to copy a file into it. Talk to the other project through the owner (section 13).
7. **Leave running services alone.** Test servers go on free ports and are stopped by PID. Never use `pkill -f`: it matches and kills the agent's own shell.
8. **Never invent a fact.** Check the vendor's docs or source before writing a setup step. Mark a guess "(check)". Say "not verified" when you didn't verify.
9. **No secret in any doc, log or chat.** When the owner pastes one, remove it without repeating it.
10. **A blank answer is not an answer.** Nothing is built for a question the owner has not answered, however long it has been open (section 5).
11. **Match the effort to the ask** (section 12). A quick ask is quick.

## 2. Words

| Word | Meaning |
|---|---|
| **round** | One ask, or one batch of answers, from the owner, the work that follows, and one hand-back. Every round, however small, gets one file in `agentic_docs/rounds/` (section 9). Numbered by the agent, one counter per project, never reused. The proposed commit message uses the same number. |
| **the owner** | The person who owns the repo. Agent files say "the owner"; files for the owner say "you". |
| **the standard** | This folder, `agentic_docs/standard/`: a read-only copy of the owner's standardization repo. |
| **go**, **execute**, **run** | Start the work, alone, until it is done. The owner is usually away. |
| **quick** | Minutes. Read only what the ask needs. |
| **plan first** | Write a plan with questions, then stop. |
| **ideas**, **suggestions**, **what's left?** | Write them down and stop: no code, no downloads, no long checks. |
| **tidy** | Clean up the docs (section 8). |
| **audit** | Read the code for risks and debt, and record the findings (section 8). |
| **hand-back** | The last message of a round (section 11). |
| **your steps** | What only the owner can do: server, secrets, git, accounts, being at the screen. |
| **Now** | An item that can't wait (section 6). |

## 3. The docs layout

Two folders. `agentic_docs/` holds the work between the owner and agents, and the standard itself. It has the same name in every project, so it never clashes with a project's own `docs/`. `docs/` holds what describes the project itself.

```
<repo>/
  CLAUDE.md                  agents: rules, read order, commands, how this project differs (loaded every session)
  README.md                  the owner and visitors: what it is, quick start
  agentic_docs/
    README.md                index of this folder: every file, one line each
    questions.md             THE OWNER'S FILE: Now, Questions, Your steps
    roadmap.md               ideas and a suggested order
    known-issues.md          bugs and debt not fixed yet
    plans/<name>.md          a plan with its questions, before a big build (when there is one)
    rounds/NNN-<slug>.md     one file per round: ask, answers used, did, checked (section 9)
    agents/
      notes.md               the owner's differences from profile.md, the State, the traps
      decisions.md           every decision and why, newest first
    standard/                the copy of the standard: README.md, agents.md, profile.md, adopt.md. Read-only.
    history/                 built plans, files carried in from other projects, retired docs
  docs/
    architecture.md          how it works now; other reference pages per project
    deployment.md            where it runs and how a change ships (if it runs anywhere but the laptop)
    guides/<name>.md         step by step, for things outside the code (when needed)
```

| Path | For | Who writes it | Changes when |
|---|---|---|---|
| `CLAUDE.md` | agents | agents; the owner adds rules | a rule, command or read order changes |
| `agentic_docs/README.md` | both | agents | a doc is added, moved or removed |
| `agentic_docs/questions.md` | **the owner** | agents ask, the owner answers and ticks | every round |
| `agentic_docs/roadmap.md` | the owner reads and picks | agents | ideas come up |
| `agentic_docs/known-issues.md` | both | agents | a bug is found or fixed |
| `agentic_docs/plans/` | the owner answers inside | agents | before a big build |
| `agentic_docs/rounds/` | agents | agents, one new file per round | every round |
| `agentic_docs/agents/` | agents only | agents | every round |
| `agentic_docs/standard/` | agents | **nobody here**; the owner copies it in | the owner refreshes it |
| `agentic_docs/history/` | nobody, unless searching | agents | a plan is built, a file is retired or carried in |
| `docs/guides/` | the owner follows | agents | a setup outside the code changes |
| reference pages | both | agents | what they describe changes, in the same round |

- **Reference pages describe the project as it is today.** Reasons and history go in `agentic_docs/rounds/`, `agentic_docs/agents/` and `agentic_docs/history/`. No questions, ideas or agent instructions go in a reference page.
- **Fixed names:** `architecture.md`, plus `deployment.md` when it is deployed. Other reference pages are per project, such as `configuration.md`, `api.md`, `method.md` or `taxes.md`.
- **A contract with another project** lives at a fixed path and never moves, because other repos link to it.
- **Nothing else goes at the top of `agentic_docs/`.** A new kind of file needs a reason written in `CLAUDE.md`.
- **The owner never needs to read `agentic_docs/rounds/`, `agentic_docs/agents/` or `agentic_docs/history/`.**

## 4. The round

### Start

1. **Open the round's file first:** `agentic_docs/rounds/NNN-<slug>.md`, the next number, from the template in the appendix, with placeholders. Do this for every round, a one-line ask included. *Why:* compaction, the session's end or running out of credits can stop you at any moment, and the file is what the next agent reads.
2. `CLAUDE.md` is loaded for you. Read `agentic_docs/agents/notes.md`: its State section and its traps.
3. Read `agentic_docs/questions.md` for new answers. Re-read it right before you rewrite it, because the owner edits it while agents work.
4. Read the newest three files in `agentic_docs/rounds/` (`ls agentic_docs/rounds | tail -3`). Read `decisions.md` before changing any behaviour.
5. Answers given in chat go into the round file's "Answers used" section, marked "(in chat)", and the question leaves `questions.md` like any answered one. Once recorded, the round file is the source of truth for that answer.
6. Read the owner's message for intent: messages are fast, with typos. Never remark on a typo. If an ask could mean two things, pick the likelier one, state it in your first line, and go.

### During

- **Don't stop for small things.** Decide, write the decision in `decisions.md`, and keep going. Stop only for: real data or a secret at risk, deleting things, money, weakening security, or anything a rule calls the owner's.
- **Questions wait for the end** and go into `questions.md`. Don't use mid-run question prompts: the owner is away.
- **Ask-type messages get answers, not changes.** An ask for ideas, a plan, "what's left" or a question gets written down, and then you stop.
- **Small bugs found on the way get fixed** and listed under "Found on the way". Bigger ones go in `known-issues.md`.
- **Use absolute paths for every write,** and work in one repo per session. *Why:* a batch of test files once landed in the wrong repo.
- **Fill the round file as you go.** A deliverable text is written to disk before it is pasted into the reply.
- **Give a one-line progress note** when something will run for long. "What's happening rn?" was asked during a silent two-hour wait.

### End, in this order

1. **Checks:** the commands in `CLAUDE.md` pass. Gate on the exit code, and note the counts.
2. **Reference pages:** update the page each change belongs to. Update `agentic_docs/README.md` when files moved.
3. **Doc pass:** grep for every renamed or removed name across `agentic_docs/`, `docs/`, deploy files, CI, `README.md`, `CLAUDE.md` and memory, and fix each hit. Check the links. Delete any one-off handoff file you used.
4. **`questions.md`:** move every answered item into the round file (section 5, "Answered items"), then remove it from `questions.md`. Add new questions within the cap. Update the steps, put Now items first, and update the date line. Blank questions stay exactly as they are.
5. **`agentic_docs/agents/` and the round file:** finish the round file, add the decisions to `decisions.md`, rewrite the State in `notes.md`, and append new traps.
6. **The rest:** ideas go to `roadmap.md` and bugs to `known-issues.md`. A built plan moves to `agentic_docs/history/plans/`.
7. **Memory:** save any new feedback from the owner or a newly learned machine fact.
8. **The hand-back** (section 11).

## 5. Questions

### When to ask

- **Only ask what changes what gets built** and what you can't settle from the code, the docs or a sensible default. Never ask what you could check yourself: ask for a names-only listing, such as `nginx -T | grep server_name`, instead of guessing names.
- **At most about ten open at once,** with the three that matter most named in an "Only 5 minutes?" line at the top. *Why:* round 0 of HomeHunter had 61 questions, and later rounds got 3 of 24 answered.
- **Group big batches into runs** (round 0, a plan, a backlog). Give each run an estimate and flags, such as "about 1 h; rebuilds the data; night run: keep the laptop plugged in". The owner then picks runs by letter.

### The format

```markdown
**Q41. Which dates by default?** The situation in two or three plain sentences.
(a) the header's range; (b) all time, with a Date button. What each costs.

*Suggested:* (b), because a search should never hide a match.

> **Answer:**
```

- **Plain words,** with every term and acronym explained. State limits and trade-offs before the suggestion. Use real numbers: sizes, hours, money.
- **Every question has a suggestion,** concrete enough that "yes" is a whole answer.
- **When a second person answers,** their questions go in their own part, in plain words with no code or file names. The owner relays them, and the agent never addresses them directly.
- **Restate short answers.** After a batch of short or ambiguous answers, add one closing question, "Qnn. My reading of your answers", as bullets the owner can correct. It is cheap, and it caught two misreadings in HomeHunter.
- **IDs:** one counter per project (Q1, Q2 …) that is never reused or renumbered, plans included. Other projects' questions are cited as "Augury Q7". Existing IDs stay as they are, because other documents cite them.

### What answers mean

| The owner writes | It means |
|---|---|
| "yes", "ok", "sure", "fine", "Accept." | Take the suggestion. |
| nothing | **Not answered.** The owner may not have seen it, or may be undecided. It stays in `questions.md` unchanged, with its suggestion, and **nothing is built for it**, even after "go". Every hand-back lists it again. The owner's words: "blank means I left it, so don't execute unless a yes or no or something", and "I might have forgotten to check for new questions". |
| a comment | An instruction. Quote it in the round file. |
| a question back | Answer it in the hand-back, and rewrite the question so that the next answer can be "yes". |
| something ambiguous | Decide, build, and write your reading next to the answer in the round file. Don't ask again: a round trip costs days. |
| "do what you think is best", "if you say so?" | Yes. Record why you chose what you chose. |
| an answer that contradicts an earlier decision | The later one wins. Update `decisions.md` and every doc that repeats the old value, without re-arguing it. |
| "no idea what that says" | Ask again more simply, with the background a newcomer needs, marked "said again more simply". |
| a hard limit in chat ("16 GB, but that's it") | A standing rule. Write it to memory and to `decisions.md` in the same turn. |

### Answered items

An answered question leaves `questions.md` in the round that uses it, and lands in that round's file under "Answers used", like this:

```markdown
- **Q44. Which dates by default?** Suggested (b), all time. Answer: "yes".
- **Q45. Show unlinked deposits?** Suggested no. Answer: "sure, and list unlinked deposits that might need linking in the new tab". Read as: a "To tidy" section in the Refunds tab.
```

Title, the suggestion in a few words, the owner's answer word for word, and your reading when the answer needed one. The question's full text is not copied: git history has it, and the title plus the answer is what a later agent needs. A decision that follows from it goes in `decisions.md` as well, citing the Q number.

### Open items

Unanswered questions stay, with their suggestion, and nothing is built for them. When a run can't go on without one, build the rest and name the blocked part in the hand-back. A question that needs the owner at the keyboard says so ("needs you at the screen"). Every hand-back lists all open questions, not only the new ones, each with the date it was asked, so a question the owner never saw is seen now. A question open for four weeks gets one line asking whether it still matters; if the owner says no, it moves to `roadmap.md` or is dropped, and the round file says which.

### Lifecycle

```
asked, in questions.md or a plan, with a suggestion
  → listed in every hand-back until answered
  → answered, in the file or in chat
  → built in the round that reads it; title and answer in that round's file; a decision row
  → removed from questions.md
```

## 6. Your steps and Now items

Everything the owner must do is a checkbox in the "Your steps" section of `questions.md`, with a stable number:

````markdown
- [ ] **S12. Add the Closed Lots level to the Flex query.** **Where:** IBKR Client Portal. **When:** before the next deploy.
  ```bash
  cd /money/dashfolio && sudo deploy/deploy.sh   # server, as root
  # expect: the last line says "all checks PASS"
  ```
  **Done:** (write "done", or paste what it printed)
````

- **Where, on every step:** the laptop (which folder), the server (as root, which folder), or a website. *Why:* the owner once copied files on the server that belonged in the laptop's repo, because the step said only "copy into tests/data/".
- **Commands are copy-paste:** one per line, one line per file, no loops, an `# expect:` comment on each check. They never print a secret: use names-only checks, status codes only, and password prompts. The owner's words: "Don't be lazy, let me be lazy."
- **Order:** the step sections are Now, Before the next deploy, After deploying, and When you have time. Dependencies are stated ("after S11").
- **"Not verified" closes:** anything the owner can check, such as a server or a real phone, becomes a step with an Expect line. The step is removed when its Done line is filled in, or when the owner says it's done. The round file that removes it quotes the Done line.
- **Check before asking:** when you can see, read-only, that a step was done, say so and remove it.
- **Stale steps:** for a step open for four weeks, ask once whether it still matters.

**Now items** are only these: a secret exposed, real data at risk, production broken, or something that blocks the next round. There are at most three. Each says why now, and what happens if it waits. They open both `questions.md` and the hand-back, in bold. Mid-run, stop at once only when going on would make it worse, such as data being destroyed or a secret being printed. Otherwise finish the work and lead the hand-back with it.

**Bugs:** a bug you fixed goes under "Found on the way" in the round file. One you didn't fix goes in `known-issues.md`, with how it was found and what it affects, plus one line in the hand-back.

## 7. Plans

- **When:** anything bigger than one round, or when the owner says "plan first". Writing a plan is a round of its own: write it, then stop.
- **`agentic_docs/plans/<name>.md`** holds, in order:
  1. "What you asked for (2026-10-27)", quoted.
  2. The options side by side, in a table.
  3. "What I propose", with mockups in fenced blocks.
  4. The questions, on the same Q counter, each with a suggestion.
  5. The order of work, each stage sized to one run. A stage may carry a paste-ready prompt for the session that will run it, naming the model, the budget, the checks and when to say "ready".
- **Pointer:** `questions.md` lists it under "Plans waiting on you".
- **Built:** the plan moves to `agentic_docs/history/plans/`, with this note at the top: "> **Built on <date> (round N).** What changed while building. How it works now: <page>." The built plan keeps the owner's answers, so it is never deleted.

## 8. Keeping the docs clean

- **One home per fact.** Other places link to it. Counts live in the State and the round file, nowhere else. *Why:* in HomeHunter, test counts, dates and the vault path drifted between five files.
- **Update the page a change belongs to in the same round.** A stale page is a bug.
- **Renames and removals:** grep everywhere and fix every hit. The hand-back says "grep for <old name> finds nothing". *Why:* JetLag's deploy docs listed services removed rounds earlier, and its CI was broken for three rounds.
- **A reversed decision** is applied everywhere at once.
- **Retiring a doc:** built plans and files carried in from other projects move to `agentic_docs/history/`. Other stale docs are deleted, with a line in `agentic_docs/history/README.md` on how to get them back (`git log --diff-filter=D --name-only -- docs`).
- **One-off handoff files** (`AGENT-CONTEXT.md`, next-session prompts) are deleted by the agent that used them, once their content is saved. One in Lageblick said "delete this" and was still there twelve days later.
- **Round files are never edited after their round,** except to fix a link, and never archived: they are small, and `ls` sorts them.
- **`questions.md` stays short:** answered items leave every round.
- **Formatting:** new prose goes one paragraph per line, so exact-string edits work. A docs formatter uses `proseWrap: preserve`. Existing files keep their wrapping.
- **A "tidy" ask:** list what is stale, then merge, move or delete, and update both indexes. Put "Tidied on <date>: <what moved where>" at the top of `agentic_docs/README.md`.
- **An "audit" ask:** the findings, numbered, go in `known-issues.md` with a suggested order. The summary goes in the round file.

## 9. The agent files and memory

**`CLAUDE.md`** stays under about 80 lines, because it is loaded every session. It holds:
- the standard's version and where the copy is, and how this project differs from the standard;
- the read order;
- what the project is, in three lines;
- the project's own rules, each with why;
- the commands: install, check, run, and what never to run here;
- where it runs and how it deploys, as a pointer;
- its neighbours and contracts;
- the files to flag when changed, such as root-run and security files.

**`agentic_docs/rounds/NNN-<slug>.md`**, one file per round, is the history. `NNN` is the round number with three digits (`054`), so `ls` sorts them; the slug is two or three words. The file is created at the start of the round and finished at its end. It is short: about ten lines for a quick ask, forty at most for a long one. It holds the model and the budget, the ask quoted, the answers used (section 5), what was done with file names, what was found on the way, what was checked and not, the questions and steps it created, and the proposed commit message. It never holds reasons that belong in `decisions.md`, or status that belongs in the State. Template in the appendix. *Why one file per round:* a single newest-first log lost four round headings to overwrites in Dashfolio and grew past 1,300 lines; one file per round can't be overwritten and needs no archiving.

**`agentic_docs/agents/notes.md`** has three sections:
- **The owner, here:** only how they differ from `profile.md`.
- **State on <date> (round N):** rewritten every round. It holds what is true now, the invariants a change must honour, what's next and what waits on the owner. It is the restart point after a compaction, a new session or a new machine.
- **Traps:** appended, one bullet each: symptom, cause, fix.

**`agentic_docs/agents/decisions.md`** has a table per round with the columns Decision, Why and From (a Q number or the owner's words). A reversal is a new row, and the old row stays.

**Memory** (`~/.claude/projects/<project>/memory/`):
- **What it holds:** the owner's feedback on how to work, with Why and How to apply lines, and machine facts found by trial.
- **What it doesn't hold:** project status. That belongs in the State.
- **Before acting on a memory,** check it against the repo.
- **Memory is per agent and per machine.** Anything another agent needs goes in the repo. *Why:* the same lesson, one questions file, was relearned when Dashfolio's work moved between machines.

## 10. Checking and honesty

- **Run the checks** in `CLAUDE.md` before every hand-back. Judge by the exit code, never by a piped `tail`. *Why:* Augury once committed with four failing tests.
- **A fix comes with a test,** or says "no test, because …".
- **UI changes:** check them in a real headless browser on made-up data, then look at the screenshots at desktop and phone width, in dark mode, and tall enough for content below the fold. The owner judges by screenshot, and a passing check can still show nonsense: two different targets for the same money once passed every check.
- **A failing test:** rerun it alone. A flaky one gets "Seen, not fixed: <test>, failed N of M runs" in the round file and in `known-issues.md`. Fix the flakiness; never retry it away.
- **Fixed phrases:** "Checked: …", "Not checked: …", "Not run: … because …", "No root-run file changed."
- **Never claim a check that didn't run.** Every number in a hand-back was seen in a log, a test or a screenshot.
- **What the laptop can't verify** (the server, Docker builds, a real phone) is said plainly and becomes a step for the owner.

## 11. The hand-back and other messages

The hand-back may be long, up to about 1,000 words when the round was big. But questions and steps never live only in the chat. They are in `agentic_docs/questions.md`, and the hand-back links to each one with its line number, so the owner can click and jump to it. Every open question is listed, new or old, with the date it was asked.

````markdown
<Verdict in one or two sentences: done or partly done, checked or not.>

**Now:** <only if there is anything>

**What you'll see:**
- <plain words, the one number that matters>

**Checked:** pytest 626 passed, browser check 224 of 224. **Not checked:** the server.
**Built from your answers:** Q44 yes, Q45 "sure, and …".
**Not built:** Q42 and Q43 are still blank.

**Your steps:** [S12](agentic_docs/questions.md#L40) on the laptop, [S13](agentic_docs/questions.md#L52) on the server after deploying.
**Open questions:** new: [Q46](agentic_docs/questions.md#L18) (which dates by default). Still open: [Q42](agentic_docs/questions.md#L27), [Q43](agentic_docs/questions.md#L33), since 2026-10-29. "yes" takes the suggestion.

**For the standard:** <what profile.md or the standard gets wrong or misses; or nothing>

**Commit message:** `Round 53: <three to six things>`
````

- **Root-run and security files:** name each one you changed. Say in bold when a change adds a host mount, `privileged`, host networking, a published port, a network, a capability, a device or a secret.
- **Left out:** say exactly what, why, and where it is recorded.
- **"Where are we?"** after a break gets Done, Now, Next, and then the next exact command.
- **A message for another project's agent:** start the chat message with "Written for: <who>", outside the piece itself. The body must be exactly what the owner will paste (section 13).

## 12. Budget, long runs and lost context

- **Size the work to the ask.**
  - **"quick", or a one-line question:** minutes. Read only the files the answer needs, with no exploration and no subagents. The round file is still written: five lines. *Why:* on 2026-10-29 a one-file ask used a tenth of a session's tokens before the owner stopped it.
  - **"go" after answers:** the session.
  - **The balance:** no tokens wasted on needless reading or exploring, but real work gets done. When an ask needs research or a look into the code, do it. The owner's words: "if there's work to do and things to research and look into, then it should be done".
  - **A stated limit** ("30 min", "6 hours of credits"): finish whole parts inside it, and list what was left and where it's recorded.
- **Long work** opens with one line giving the estimate and the plan, and then goes.
- **Multi-agent workflows run only when the owner asks.** Parallel agents only read; one agent writes, in the main checkout.
- **State on disk, all the time.** Compaction, the session's end or running out of credits can stop you at any moment.
  - The round file is opened first, with placeholders, and filled as you go.
  - Keep a scratchpad `NOTES.md` with the pending steps and exact commands, and logs under a known path.
  - Write any deliverable text to a file before the reply.
- **Long jobs (over about 15 minutes) run outside the session.** Use a systemd user unit with the memory cap, at `nice 10`, with logs on disk, or tmux on the server, started by the owner. Never use a session background job: it dies with the session, as one did in Lageblick, 40 minutes into a build. Keep the laptop awake with `systemd-inhibit`.
- **Temp files** go in the session's scratchpad, never in `/tmp` or the repo.

## 13. Other projects

- **The owner carries files and messages between projects.** Agents never touch the other repo.
- **The side that provides an API owns the contract.** It is one page at a fixed path, versioned, and additive within a version. Shared example files are regenerated from made-up data, with a drift test on both sides.
- **A message to another project's agent** has these parts:
  - one section per item of their ask, each "built", "nothing to build" or "later", with **Changed** where you departed from their suggestion;
  - the exact shapes you send;
  - "What we need from you";
  - "What needs the owner", numbered, per side;
  - "Questions back", each with a suggestion.

  Keep it verbatim at the end of the contract page, dated, and their answers too.
- **A file carried in from another project** goes in `agentic_docs/history/plans/`, or into the contract, with a header saying who wrote it, when, that its links point to the other repo, and what was built from it.
- **One canonical copy** of any shared file, named inside it. The other side keeps a pointer, or a copy marked "copy of <path>, <date>; the original wins". *Why:* Lageblick's two copies of an exchange document drifted apart.
- **Before changing a contract,** read it. If the other side has to change too, tell the owner what changes in which repo.

## 14. Writing

- **Plain English.** Short sentences, one idea each. No jargon; explain any term or acronym the first time. Real numbers over adjectives. No marketing tone and no emoji in docs.
- **People:** "you" in the owner's files, "the owner" in agent files. Never guess pronouns: use they/them unless the person has stated theirs.
- **The owner's words:** quoted when recorded. Their words for things (statuses, labels) are used verbatim, and asked for before you build anything around them. *Why:* in HomeHunter "pass" meant accept, and the overview hid those homes for four days.
- **Dates are absolute** (2026-10-29), never "yesterday".
- **Layout:** bold lead-ins, tables for parallel items, fenced blocks for commands, mockups and data shapes.
- **Start minimal and reliable.** No clever tooling unless asked. *Why:* in the media-server project, a feature-rich certificate wrapper failed on its first run and was replaced by six lines.

## 15. Starting a new project

The owner has copied the standard into `agentic_docs/standard/`. Round 0 is questions only.

1. Read `profile.md` and this standard.
2. Create the skeleton from the appendix: `CLAUDE.md`, `agentic_docs/README.md`, `agentic_docs/questions.md`, `agentic_docs/rounds/000-intake.md`, and `agentic_docs/agents/notes.md` and `decisions.md`.
3. Write the intake questions into `questions.md`. Ask only what `profile.md` and the owner's first message don't answer, each with a suggestion prefilled from `profile.md`. At most about twelve, with three named under "Only 5 minutes?".
4. Stop and hand back.
5. After the answers, in round 1, record them: the answers in the round file, rules in `CLAUDE.md`, the owner's differences in `notes.md`, the choices in `decisions.md`. Then build.

**The intake questions:**

- **The goal**
  1. What is it for, who uses it, and on which devices? Is it private, for friends, or public later?
  2. What does "done" look like for the first run? Is it a one-off, or years of upkeep?
  3. Show one example of a result you'd like: a screenshot, a hand-made file, a link.
  4. What is out of scope, or "later"?
  5. Which limits are hard numbers, and which are preferences?
  6. What are your words for its things: statuses, labels, names?
- **Boundaries**
  7. Which real data, accounts and keys exist, and where do they live? What must I never read?
  8. What always needs your yes: deletes, money, messages sent, anything public?
  9. May I run live tests against third parties? How often, and from which network? Are paid services allowed?
- **Where and how**
  10. Is it laptop only, or deployed? Where, who deploys it, and what checks it?
  11. Which of your projects does it read from or feed, and who owns the data?
  12. Does anything here differ from the standard: git, checks, docs?

**On a fork:** copy the parent's docs and agent notes, as they were, into `agentic_docs/history/<parent>/`. Add a README saying what to keep, what to adapt and what to replace. `CLAUDE.md`'s read order points to it.

## Appendix: templates

**`CLAUDE.md`**

```markdown
# <Project>: rules for agents

Follows the owner's standard v0.3, copied at agentic_docs/standard/ (read its README.md first; never edit it). Differs from it in: <list, each with why; or "nothing">.

## Read first
1. agentic_docs/agents/notes.md: the State and the traps.
2. agentic_docs/questions.md: new answers.
3. The newest three files in agentic_docs/rounds/; agentic_docs/agents/decisions.md before changing behaviour.

## What this is
<three lines: what, for whom, stack, where it runs>

## Rules for this project
1. <rule>. Why: <one line>.

## Commands
<install, check (these must pass before a hand-back), run; what must never run here>

## Where it runs
<two to five lines; details in docs/deployment.md>

## Neighbours
<other projects, the contract's path, who owns the data>

## Flag these files when changed
<root-run and security files>
```

**`agentic_docs/questions.md`**

````markdown
# Questions and your steps

Updated 2026-10-29 (round 53). Write after `> **Answer:**`. "yes" takes the suggestion. A blank means you haven't answered: it stays here and nothing is built for it. Answered items move to agentic_docs/rounds/.

**Only 5 minutes?** Q44, Q46, S12.

## Now
<at most three; each says why now; or "Nothing.">

## Plans waiting on you
- [plans/search.md](plans/search.md): Q30–Q33.

## Questions
**Q44. Title.** … (asked 2026-10-29)

*Suggested:* …

> **Answer:**

## Your steps
### Before the next deploy
- [ ] **S12. Title.** **Where:** … <commands, Expect, Done>
### After deploying
### When you have time
````

**A round file, `agentic_docs/rounds/053-refunds-built.md`.** Created at the start with the placeholders, filled at the end. A quick ask keeps only the first four lines and "Did" and "Checked".

```markdown
# Round 53, 2026-10-29: refunds built

Model: Opus 5.5. Budget: "go", the session.

Asked: "<the owner's words, trimmed>" (with a screenshot of …).

Answers used:
- **Q44. Which dates by default?** Suggested (b), all time. Answer: "yes".
- **Q45. Show unlinked deposits?** Suggested no. Answer (in chat): "sure, and list …". Read as: a "To tidy" section.
Not answered, not built: Q46 (since 2026-10-27).

Did:
- **<thing>:** what changed, with file and function names.

Found on the way: …
Checked: pytest 626 passed; browser check 224 of 224. Not checked: the server. Not run: … because …
No root-run file changed.
Decisions: decisions.md, round 53. Steps created: S12, S13. Questions added: Q47.
Commit message: Round 53: <three to six things>
```

**A decision**

```markdown
## 2026-10-29, round 53: <title>

| Decision | Why | From |
|---|---|---|
| **A second path for version 2; version 1 unchanged** | Augury's client refuses any version but 1 | Q12 |
```

**The State in `agentic_docs/agents/notes.md`**

```markdown
## State on 2026-10-29 (round 53)

- **<area>:** what is true now, and the invariant a change must keep.
- **Waiting on the owner:** S12, Q44.
- **Next:** <one line>.
```

## Versions

- **0.3 (2026-11-08):** one file per round in `agentic_docs/rounds/`, replacing the single `rounds.md`; every round gets one, quick asks included. A blank answer means "not answered", not "left on purpose"; every hand-back re-lists all open questions with their dates. Answered questions move into the round file with the answer verbatim. The standard is copied into each project at `agentic_docs/standard/`, read-only, with a README on how to read it. Rule 3 now says `git mv`, so plain `mv` is allowed.
- **0.2 (2026-10-30):** the owner's review answers. `agentic_docs/` for the work files, `docs/` for the project's own pages. A blank answer is never built. Agents never commit, and always propose a commit message. The hand-back may be long, but links to each question and step. Profile: he/him, Docker on the laptop, a 24 GB cap, no project list.
- **0.1 (2026-10-29):** the first draft, merged from six projects.
