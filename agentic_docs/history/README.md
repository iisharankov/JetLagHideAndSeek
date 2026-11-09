# History

Built plans, retired docs, and the records from before the standard (adopted 2026-11-09, round 29). Nobody needs to read these unless searching.

| File | What it is |
|---|---|
| [rounds-before-the-standard.md](rounds-before-the-standard.md) | `docs/plan.md` as it was: phases 0–3, rounds 4–26 (commits to Round 28), what each did and its tests, what was left |
| [questions-before-the-standard.md](questions-before-the-standard.md) | `docs/questions.md` as it was: Q43–Q46 answered, Q47–Q50 open (now in `../questions.md`), the decisions list by round (now in `../agents/decisions.md`) |
| [audit-2026-10-17.md](audit-2026-10-17.md) | The sixth code audit; its open findings are in `../known-issues.md` |
| [plans/tutorial-revamp.md](plans/tutorial-revamp.md) | The tutorial plan of 2026-10-31, built in round 21 |

Deleted on 2026-11-09, content carried into `CLAUDE.md` and `../agents/notes.md`: `docs/agent-brief.md`. To get a deleted doc back:

```bash
git log --diff-filter=D --name-only -- docs
git show <commit>^:docs/agent-brief.md
```
