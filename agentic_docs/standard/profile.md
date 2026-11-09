# The owner and the machines

Version 0.3, 2026-11-08. These facts hold for every project, so no project asks them again. They come from six projects' notes and the owner's corrections. A fact marked "(check)" is uncertain. Machine facts change: when one is wrong, say so in the hand-back under "For the standard", so the owner can fix this file in the original repo. Never edit this copy.

## The owner

- **Name:** Ivan (iisharankov on GitHub). Pronouns: he/him.
- **Where:** Switzerland, Europe/Zurich time, CHF as the base currency, ISO dates (2026-10-29). Writes in English. German and Swiss terms stay as the source uses them, with the English beside them.
- **Knows:** Python, Linux, Docker, nginx, DNS and git. Does not write JavaScript, and relies on the agent for the front end: verify UI work in a real browser and explain it plainly.
- **Tools:** VS Code with Claude Code. Switches models on purpose, mid-session: Fable for plans, architecture, big builds and reviews; Opus (sometimes Sonnet) for fixes, docs and polish. Credits are limited and have run out mid-run. Reads docs on a phone and in VS Code. Uses a password manager with long passwords: bcrypt tools fail past 72 characters with misleading errors, so say "64 characters or fewer" up front.

## How he works

- **Rounds:** he asks, then says "go", then leaves for an hour, a walk or the night. Expects one hand-back at the end.
- **Writes fast:** lowercase, typos, run-on sentences. Read for intent; never remark on typos. A comment inside an answer is an instruction.
- **Feedback** comes as numbered lists, often with screenshots, often after real use. Judges visual changes by screenshot ("juuust a bit").
- **Answers** come in the questions file, in batches, days later, often partly, and sometimes in chat or as a question back. He edits the file while agents run. **A blank answer means he hasn't answered, and may not have seen the question:** build nothing for it, keep it, and list it again in the hand-back. His words: "I might have forgotten to check for new questions".
- **Wants a suggestion with every question.** "yes" or "ok" takes it.
- **Wants few questions, few files and short text:** "too many .md files", "clogging up", "I'm so lost", "keep it short". Wants plain words: "no idea what the hell that was saying" came after one piece of jargon.
- **Wants options, not fixed choices:** settings with good defaults.
- **Prefers simple and reliable over clever.** Wants every command spelled out: "Don't be lazy, let me be lazy."
- **Changes his mind fast.** The latest message is the truth: apply it everywhere, without re-arguing it.
- **Delegates technical judgement** ("if it makes things better, go for it") and expects a plain explanation in return.
- **Gives budgets:** "quick", "finish in 5 mins", "6 hours of credits", "use most of the session". Gets annoyed when a quick ask is slow, but wants real work and research done when the ask needs it: a balance.
- **Relays between projects by hand,** pasting other agents' messages verbatim.
- **Strict on privacy and security.** Never reads or pastes secrets in chat, wants exposed secrets rotated, and wants agents walled off from real data.
- **Git and servers are his:** he makes every commit, pushes and deploys himself. Agents propose a commit message, and give the commands when it's more than one commit.
- **Copies the standard into each repo himself,** at `agentic_docs/standard/`, and refreshes it when the original changes.

## The laptop (development)

- Linux (Ubuntu, kernel 6.8), bash, GNOME. 32 GB of RAM. Heavy jobs may use at most 24 GB, in every project: the rest keeps the laptop usable.
- **Suspends after 20 minutes idle on AC.** Long runs need `systemd-inhibit --what=idle:sleep`, and the laptop plugged in.
- **No sudo for agents.** Docker is available on the laptop. Snap's Docker once needed root (check `docker ps` before relying on it).
- **Snap packages:** `uv` at `/snap/bin/uv` (it updates itself, so check `uv --version` before a lock file changes), Chromium (its `/tmp` is private, so use a fresh profile folder per run), Docker.
- **Other tools:** Node 22; `pnpm` in `~/.local/bin`; Python 3.12 through uv (some older venvs are 3.10); Playwright browsers installed per project; Mullvad VPN installed, kept off for anything that scrapes.
- **Folders:** repos under `~/Workspace/github/iisharankov/<project>`, Obsidian vaults under `~/Documents/Obsidian/<vault>`. The standard's original is at `~/Workspace/github/iisharankov/standardization`. The Workspace folder is no longer synced by Nextcloud (a sync once deleted files from a working copy; removed in October 2026).
- **The agent's shell:** `grep` may be a ugrep function, and `pkill -f` kills the shell itself. Find ports in use with `ss -ltnp`. Never take a port that's in use: the owner may have his own copy of a project running.
- **Systemd user units** need absolute paths, checked with `which`.

## The server ("myCloud")

- A Hetzner VPS: Ubuntu 24.04, 64 GB of RAM, in Switzerland, Europe/Zurich time. The owner works there as root. Agents there run under a managed policy (`/etc/claude-code/managed-settings.json`), often without a working shell. Docker is not always available to them.
- **Docker stacks** live under `/root/myServices/<stack>`. Projects with financial data live under `/money/<project>`, walled off. A sandboxed `/money` agent runs as the user `agent`, with group write on `/money`: anything root runs is installed outside the repo. Each project's `CLAUDE.md` says where it lives on the server.
- **Web:** host nginx terminates TLS. New sites go in `sites-available/` with an `ln -s` into `sites-enabled/`; older ones are in `conf.d/`. Get the truth from `nginx -T | grep server_name`, never by guessing. One Let's Encrypt certificate: a line in `certs/domains.txt`, then `main-cert`. Everything binds to `127.0.0.1`, because Docker's published ports bypass ufw. DNS is at Namecheap.
- **Shared services a new project plugs into:** Authelia (login, opt-in per site), Uptime Kuma, Beszel, ntfy (alerts), Homepage, Arcane, and restic (backups). Hostnames and the server map are in `/root/myServices/base_docs/` on the server; this file names no hosts.
- **Container logs can hold tokens:** agents don't read them. Ask the owner for the lines needed.
- **Other machines:** a T7 external drive, and a torrent and media machine (Syncthing).

Which project talks to which is written in each project's `CLAUDE.md` under Neighbours, not here.
