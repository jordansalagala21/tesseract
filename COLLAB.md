# Claude Code ↔ Codex collaboration

Updated 2026-11-14 after checking all eight open PRs. Claude Code is expected to be
available again at **5:20 PM**. This is a handoff plan, not a claim that the work
below is complete. Follow `CLAUDE.md` for ownership, contracts, data integrity,
and PR requirements, and read the relevant installed Next.js guides before coding.

## Roles and handoff protocol

The user requested **Claude Code for reasoning and Codex for execution**.

1. **Claude: reason.** Read the issue, existing implementation and review evidence.
   Return a bounded implementation brief: files, intended behavior, API/contract
   decisions, edge cases, acceptance checks, and dependencies. Resolve uncertainty
   from local docs or a small read-only probe; never invent data or API fields.
2. **Codex: execute.** Implement that brief in the assigned worktree, add meaningful
   regression tests, and run the required checks. Commit and push to the existing
   issue branch or open a separate PR for a new issue. Report the exact commit,
   changed behavior, test results, and unresolved questions to Claude.
3. **Claude: review.** Read the actual diff and evidence. Return `ACCEPT` or
   `REVISE`, with specific findings and the next bounded brief. Codex implements
   revisions and repeats the checks affected by them.
4. **Codex: deliver.** Update the PR description to match the final code and actual
   validation. Await the repository's required human approval. An AI review is not
   the required human approving review, and neither agent may bypass protection.

Only Codex edits product code during this loop. Claude supplies reasoning and
review; the agents must not independently implement the same issue. Use a new
task only after its predecessor has handed back a result. Keep durable summaries
in this file and relevant PR threads; do not put secrets or raw sponsor records
in prompts, logs, handoffs, PRs, or committed fixtures.

Use this handoff format:

```text
Task / issue:
From → To:
Branch / worktree / exact commit:
State: NEEDS_REASONING | READY_TO_EXECUTE | NEEDS_REVIEW | REVISE | READY_FOR_HUMAN
Files in scope:
Decision or implementation brief:
Acceptance checks / actual results:
Open questions / next owner:
```

## Verified starting point

- Latest fetched `origin/main`: **533a558**, including the narrow Matterport/Vexcel
  environment accessors in merged #67. #66's AI-03/AI-07 changes are also merged.
- This plan's first `npm run check` passed on base **4fc1b40**: lint and TypeScript clean,
  170 tests passed and 37 data-dependent tests skipped with no opt-in env loaded.
- The previous integration review used **a9efa0b** plus DATA-02/03/04/07.
  Its existing tests produced **260 passes and one failure**, with local data and
  live Matterport credentials loaded. Its production build and TypeScript passed.
  DATA-02/03/07's 48 tests passed. Recheck against the newer main when integrating.
- [DATA-04 #65](https://github.com/jordansalagala21/tesseract/pull/65): all six live
  tests actually ran; five passed and the missing-model test failed. The API
  returns GraphQL `not.found`; `queryModel()` currently throws instead of returning
  `null`. A separate regression reproduced stale CoStar associations: the cache
  is keyed only by model ID but caches the first caller's property ID/caption/suite.
- #65 also has a formal `CHANGES_REQUESTED` review. The reviewer requests:
  use `matterportEnv()` from merged #67 so unrelated missing keys do not block
  Matterport; use photo `resizeUrl(resolution: web)` instead of full-size originals;
  reserve a default image slot for a floorplan when available; and restrict
  floorplans offered to vision to PNG/JPG, excluding DXF. These are additional
  requirements, not replacements for the two independently reproduced defects.
- The live Suite 100 scan agrees with the handoff: approximately 8,878.9 scanned
  SF, 22 rooms, 76 panos, and 16 photos. Scanned SF is not advertised/leasable SF.
  Both Suite 100 and Suite 104 passed the existing live model/contract checks.
- Vexcel's collection lookup succeeds for the Travis point and includes
  `us-tx-houston-2026`. DATA-05's client and image proxy are still unimplemented.
- [DATA-02 #55](https://github.com/jordansalagala21/tesseract/pull/55) has an actual
  `CHANGES_REQUESTED` review. `2600 Travis St` succeeds, while `2600 Travis Street`,
  `2600 travis st, houston`, and `Travis 2600` fail. The reviewer requested address
  normalization, token matching, suffix/direction equivalence, literal wildcard
  handling, and tests.
- [DATA-03 #56](https://github.com/jordansalagala21/tesseract/pull/56) is stacked on
  #55. The contract change #53 is merged, but `getSpaces()` still filters to
  `caption_suite_match`. Of the 20 direct space links documented in the kit,
  seven overlap caption links; the review counted **13 distinct property/model
  links** absent from space responses. These are different denominators.
- [DATA-07 #58](https://github.com/jordansalagala21/tesseract/pull/58) now has a
  formal `CHANGES_REQUESTED` review. The reviewer found that tenant industries
  should prefer decoded `company-detail.profile.industryType`, falling back to
  occupancy industry, which requires a fix in `scripts/build-db.ts` and a rebuilt
  database. Nearby comparable rent statistics must be grouped by
  `serviceType` × `spaceUse`, exclude multifamily properties, and use a consistent
  low/high rate basis. Add import-coverage and grouped-rent regression tests.
  These are reviewer findings; Codex has not yet rerun their specific reproductions.
- [Handoff docs #63](https://github.com/jordansalagala21/tesseract/pull/63) contain
  the probe facts, but their current-state section incorrectly says AI-01…AI-07
  are unstarted. Several are merged. Replace that stale list with live status links
  or update it from GitHub.
- The current GitHub token already has `project` scope. Do not repeat
  `gh auth refresh -s project` without evidence that access is failing.
- Remote `feat/DATA-02-property-search` still exists. Check for unique work and
  dependent PRs before considering the previously requested cleanup.

## Review snapshot

| PR | Review status | CI on current PR head | Next requirement |
|---|---|---|---|
| #55 DATA-02 | Changes requested | Passed | Address matching and regression tests |
| #56 DATA-03 | No review submitted | No checks reported | Depends on #55; direct-link follow-up and review |
| #57 UI-09 | No review submitted | Passed | Review/approval by the owning workstream |
| #58 DATA-07 | Changes requested | Passed | Tenant industry import and comparable-rent grouping fixes |
| #60 UI-07 | No review submitted | Passed | Review/approval by the owning workstream |
| #63 handoff docs | No review submitted | Passed | Correct stale state text and obtain review |
| #65 DATA-04 | Changes requested | Passed | Formal review requests plus the two reproduced adapter defects |
| #68 this plan | No review submitted | Passed | Review/approval |

All eight are currently mergeable without Git conflicts. #56 targets the search
branch; GitHub showing it as `CLEAN` does not mean it has passed CI or received
approval. The other seven are blocked by their review requirements. Passing CI
does not clear requested changes, and no inline review threads were returned.

## Work queue

| Order | Work | Claude's reasoning/review brief | Codex execution and delivery |
|---|---|---|---|
| 1 | DATA-04 / #9 / PR #65 | Address the formal review (narrow env, resized photos, a floorplan slot, PNG/JPG only), missing-model error handling, and cache isolation; define behavior for small limits and missing assets. | Integrate main's merged #67 and fix only the adapter and its tests. Add deterministic regressions, rerun existing tests with all six live tests enabled, and update #65's validation and known-gap text. |
| 2 | DATA-05 / #10 / new PR | Specify exported functions, WKT bounds, XMP parsing, missing-metadata behavior, proxy input/error handling, and how callers receive metadata versus JPEG bytes using the existing contracts. | Implement `lib/data/vexcel.ts`, `app/api/imagery/vexcel/[kind]/route.ts`, and focused tests. Verify ortho and north oblique live and in a browser; preserve attribution; expose only internal proxy URLs. Open a PR closing #10. |
| 3 | DATA-07 / #12 / PR #58 | Resolve the company-versus-occupancy industry precedence and specify rent groups and rate basis without breaking AI-04 consumers. | Fix the import and nearby module/tests on #58's existing branch, rebuild the DB, verify industry coverage and separated non-multifamily rent groups, and update #58. |
| 4 | DATA-02 / #7 / PR #55 | Turn the reviewer's address-matching request into a precise normalization/token plan, retaining parameterized SQL. | Implement the requested matching behavior and tests on #55's existing branch; verify all four demo queries and literal `%`/`_`; rerun checks and update #55. |
| 5 | DATA-03 / #8 / PR #56 | Define precedence and deduplication for direct `floorPlan.videoKey` links versus caption matches. Confirm the imported schema before choosing a join. | Include direct links without duplicate spaces or cross-suite associations, with correct `linkMethod` and regression tests. Integrate the updated #55 safely, rerun against current main, and update #56. |
| 6 | DATA-06 / #11 / new PR | Review the completed DATA-03/04/05 interfaces and specify coordinate checks, coverage reporting, and honest handling of unmatched suites. Resolve standalone script execution with `server-only` imports. | Extend `lib/data/matching.ts`, add `scripts/verify-matches.ts` and focused tests; verify 1018657, 353482, and 5528958. Report distances and actual coverage; do not invent a suite match for 5528958. Open a PR closing #11. |
| 7 | Docs / review / cleanup | Review final evidence and the remaining review requirements. | Correct #63's stale status text, update board state when permitted, and safely clean up the obsolete branch after checking it. |

DATA-06 must use completed dependencies; it must not assume that opening a PR
means its implementation has landed on main. Prefer merged dependencies. If an
integration branch is necessary, list every exact dependency commit and PR base,
and recheck after those dependencies merge. Keep issues and PRs separate.

The rest of the team's UI, AI, and integration issues remain with their assigned
developers. Surface required interface changes through reviewed contracts; do
not expand into another workstream's files or duplicate its work.

## Worktree ownership

All paths below are local; they are not portable setup requirements.

| Purpose | Branch | Local directory |
|---|---|---|
| Shared collaboration plan | `chore/claude-codex-collab` | `C:/Users/ADMIN/tesseract` |
| Matterport execution | `feat/DATA-04-matterport` | `C:/Users/ADMIN/tesseract-worktrees/data-matterport` |
| Vexcel execution | `feat/DATA-05-vexcel` | `C:/Users/ADMIN/tesseract-worktrees/data-vexcel` |
| Search execution | `feat/DATA-02-search` | `C:/Users/ADMIN/tesseract-worktrees/data-search` |
| Detail execution | `feat/DATA-03-property-detail` | `C:/Users/ADMIN/tesseract-worktrees/data-detail` |
| Existing handoff docs | `chore/agents-md-codex-handoff` | `C:/Users/ADMIN/tesseract-worktrees/agents-handoff` |
| Disposable prior integration review | detached at `a9efa0b` | `C:/Users/ADMIN/tesseract-worktrees/review-current-main` |

The execution worktrees have been created but **no product fixes have been made**.
The disposable review checkout contains an uncommitted integration and a local
dependency-resolution adjustment; it is evidence only, not a branch to push.
Keep worktrees outside the app root so TypeScript and ESLint do not discover
other checkouts' source files. Install dependencies in each execution worktree
with `npm ci`; do not silently change application config just to share dependencies.

Before each task, fetch and inspect current branch status, PR feedback, and issue
ownership again. Preserve other developers' work. Prefer additive commits and
merges of dependencies; never force-push main or rewrite another developer's commits.

## Validation and secrets

- Keep credentials in gitignored `.env.local`. Resolve local kit/database paths
  for the execution worktree. Never print the file or a credential.
- Before every push, run `npm run check` as required by `CLAUDE.md`. Also build
  new/changed route integrations. Record skipped tests separately from passes.
- Vitest does not load `.env.local` automatically. For opted-in live Matterport
  checks, use this from a correctly configured worktree:

  ```powershell
  node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/data/matterport.test.ts
  ```

- CI must continue to work without sponsor data or live credentials. Add mocked
  error/cache regressions so these failures cannot hide behind skipped live tests.
- Vexcel browser verification must show JPEG responses from our own proxy for
  ortho and north oblique, retained attribution, and no key or upstream Vexcel URL
  in client URLs or response metadata. Do not commit downloaded images or API dumps.
- Existing API probes are not browser verification. Record the actual browser
  result, not an assumption based on a successful build.

## First handoff, ready for 5:20 PM

```text
Task / issue: DATA-04 / #9 / PR #65
From → To: Codex → Claude Code
Branch / worktree / exact commit:
  feat/DATA-04-matterport
  C:/Users/ADMIN/tesseract-worktrees/data-matterport
  2b3cb4e8f2dc78210debfefed1dc3d6f14347532
State: NEEDS_REASONING
Files in scope: lib/data/matterport.ts; tests/data/matterport.test.ts
Decision or implementation brief:
  Read COLLAB.md, the diff, and the formal review on #65. Main now contains #67's
  matterportEnv(). Include the scoped env change, web-resized photos, a floorplan
  slot and PNG/JPG-only image selection, missing-model error handling, and cache
  isolation. Return the bounded implementation brief to Codex; do not edit product
  code. Specify deterministic tests, including small limits and missing assets.
Acceptance checks / actual results:
  Existing Matterport tests: 16 pass, 1 fail, none skipped with env loaded.
  Failure: notamodelid throws a GraphQL not.found error instead of null.
  Additional reproduction: the second call for a cached model retains the first
  caller's propertyId/caption/matchedSuite instead of the second caller's values.
Open questions / next owner:
  Claude supplies reasoning; Codex implements, tests, commits, pushes, and returns
  the diff for Claude review. No Claude session has been launched by Codex yet.
```
