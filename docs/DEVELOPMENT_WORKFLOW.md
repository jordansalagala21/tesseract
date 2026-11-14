# Development Workflow

## First-time setup

```bash
git clone https://github.com/<owner>/tesseract.git
cd tesseract
npm ci
cp .env.example .env.local   # fill in values from the team vault (never commit)
# set COSTAR_KIT_DIR to your local unzipped sponsor kit
npm run dev                   # http://localhost:3000
npm run check                 # lint + typecheck + tests
```

Requirements:

- Node ≥ 20.9 (the team uses Node 22+)
- npm
- `gh` CLI, for issues and PRs

Once DATA-01 lands, build the local database with:

```bash
npm run db:build   # reads $COSTAR_KIT_DIR, writes $DUCKDB_PATH (gitignored)
```

## Daily loop

```bash
git switch main && git pull --rebase
gh issue list --assignee @me                 # or browse the Project board
gh issue view <n>
git switch -c feat/<ISSUE-ID>-short-name     # e.g. feat/DATA-01-costar-import
# ... work inside your owned directories ...
npm run check
git add -p && git commit -m "DATA-01: load listings into DuckDB"
git pull --rebase origin main                # resolve conflicts in YOUR files only
git push -u origin HEAD
gh pr create --fill --base main              # the template asks for issue, summary, files, tests, screenshots
```

Then move the card to **In Review** and ask a teammate to review it.

## Branches

| Prefix | Use |
|---|---|
| `feat/<ID>-…` | New functionality for an issue |
| `fix/<ID>-…` | Bug fix |
| `docs/…`, `chore/…` | Docs and tooling |
| `contracts/…` | Changes to `lib/contracts` (small, reviewed by all consumers) |

Keep branches short-lived (under about 6 h), one issue per branch.

## Pull requests

- Base branch: `main`. It is protected and needs 1 approving review plus green CI.
- Title format: `<ISSUE-ID>: <summary>`. Body: `Closes #<n>`.
- Include screenshots for UI changes and the commands you ran for tests.
- Reviewer checks:
  - stays within the author's owned directories
  - uses contract types
  - no secrets or sponsor data
  - no "vacant" wording
  - evidence attached to every claim
- Merge with **Squash and merge**. Delete the branch afterwards.

## Rules

- Never commit directly to `main` (initial setup excepted).
- Never force-push shared branches. Never rewrite others' commits.
- Never commit credentials, `.env.local`, sponsor JSONL, DuckDB files, imagery, or API response dumps.
- Avoid drive-by refactors and reformatting.
- Pull `main` frequently. Rebase before opening a PR.

## CI (`.github/workflows/ci.yml`)

On every PR and push to `main`, CI runs `npm ci` → `lint` → `typecheck` → `test` → `build`.

CI has no secrets and no sponsor data, so tests that need them must skip:

```ts
it.skipIf(!process.env.COSTAR_KIT_DIR)("finds 1018657", ...)
```

## Project board

Statuses:

- Backlog → Ready → In Progress → In Review → Done

Priorities:

- **P0** — essential for the working demo
- **P1** — important
- **P2** — optional

Move your own cards. If you're blocked, add the `blocked` label and comment with what you need and from whom.

## Using Claude Code on this repo

- Claude reads `CLAUDE.md` automatically. Start each session with: "Work on issue #<n>. Read CLAUDE.md, the issue, and the relevant docs and contracts first."
- Ask Claude to stay inside your owned directories and to stop if it needs another workstream's code.
- Let Claude run `npm run check` before you commit.
