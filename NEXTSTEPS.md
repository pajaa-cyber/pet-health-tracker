# Where we left off (2026-09-12)

Read this before doing anything else in this project. It's a handoff for
resuming an in-progress build, not permanent documentation (see CLAUDE.md
for that).

## What this is

Building a Pet Health Tracker mobile app (React Native/Expo + Firebase),
chosen after a brainstorming session to beat an existing 3.3-star
competitor (11pets) on price, reliability, and simplicity. Full context:

- Idea/market research: earlier in this conversation (not written to a file)
- Design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Implementation plan (Plan 1 of 3 — "Foundation & Auth"):
  `docs/superpowers/plans/2026-09-11-pet-health-app-foundation.md`
  — **read its "Revision log" section at the bottom before touching
  `src/household/` or `firestore.rules`** — the join-household design
  changed twice after review found it didn't actually work.
- Plans 2 ("Pet Records Core") and 3 ("Reminders & Notifications") are
  not written yet — Plan 1 needs to finish and get merged first.

## Where the work is happening

Isolated git worktree, NOT the main checkout:
`C:\Users\PC\OneDrive\Desktop\app\.worktrees\pet-app-foundation`
branch `pet-app-foundation`. The main checkout at
`C:\Users\PC\OneDrive\Desktop\app` should stay on `master` with nothing
but the spec and plan docs committed — do not develop there.

Executing via the `superpowers:subagent-driven-development` process. Its
ledger — the authoritative record of what's done, what was ruled on, and
why — is at:
`.superpowers/sdd/2026-09-11-pet-health-app-foundation/progress.md`
(relative to the worktree above). **Read the whole ledger before resuming**
— this file summarizes it, but the ledger has the full reasoning behind
every ruling.

## Task status (Plan 1: Foundation & Auth, 7 tasks total)

| Task | What | Status |
|---|---|---|
| 1 | Expo/RNFB project scaffold | ✅ Done, reviewed, approved |
| 2 | Firebase client config | ✅ Done, reviewed, approved |
| 3 | Household/HouseholdMember types | ✅ Done, reviewed, approved (bundled into Task 4's commit as a prerequisite — see ledger) |
| 4 | Household create/join service | ✅ Implemented and rewritten twice — see below, NOT yet re-reviewed after the last rewrite |
| 5 | Firestore security rules | ✅ Implemented and rewritten twice — see below, NOT yet re-reviewed after the last rewrite |
| 6 | Auth context | ❌ Not started |
| 7 | Sign up/in + household setup screens | ❌ Not started |

## The one thing that MUST happen next

Tasks 4 and 5 went through a serious back-and-forth during review:

1. First pass: implemented and approved.
2. Review found the update-permission rule denied the household-join flow
   entirely (joining user isn't a member yet at the time of their own
   join-write). Fixed once (commit `37be082`) — re-review found this fix
   *introduced* a hijack: a non-member could evict an existing member
   while adding themselves.
3. Deeper investigation found a second, independent problem: the
   invite-code lookup used a Firestore query that real Firestore rejects
   outright for non-members (list-query rules must hold for every
   potential match, not just the actual one).
4. Both were fixed together in commit `a553b58`
   ("fix: resolve invite codes via lookup collection and close
   member-eviction hijack") — introduces an `inviteCodes/{code}` lookup
   collection + `arrayUnion` + `.hasAll()` in the rules. Full technical
   explanation in the plan's Revision log (second entry).

**Commit `a553b58` has NOT been reviewed.** The re-review agent was
dispatched and immediately failed with an API rate-limit error (session
limit, resets 00:40 Europe/Budapest — check current time before retrying)
before producing any output. Nothing about `a553b58`'s correctness has
been verified independently — treat it as unreviewed, not as approved.

### Exact next action

Re-dispatch the scoped re-review. Everything needed:

```bash
cd "C:\Users\PC\OneDrive\Desktop\app\.worktrees\pet-app-foundation"
bash "/c/Users/PC/.claude/plugins/cache/superpowers-marketplace/superpowers/6.3.0/skills/subagent-driven-development/scripts/review-package" \
  docs/superpowers/plans/2026-09-11-pet-health-app-foundation.md 609077cb26c8c61170171d61cc3e67a814a8119e a553b58
```

This regenerates the diff file at
`.superpowers/sdd/2026-09-11-pet-health-app-foundation/review-609077c..a553b58.diff`
(base and head commits are ancestors of the current worktree HEAD, so
this always works even after more commits land). Then dispatch a review
subagent reading:
- The plan's Task 4 + Task 5 sections + both "Revision log" entries
- `.superpowers/sdd/2026-09-11-pet-health-app-foundation/task-4-5-remediation-report.md`
- The regenerated diff file

Ask it specifically to be adversarial about: (a) whether `.hasAll()`
really closes the eviction hijack (trace a raw-array replacement attempt
by hand), (b) whether there's slack in `size()==old+1 && hasAll(old) &&
self-count==1` that would let a non-member add fabricated *extra* members
alongside themselves, (c) whether the `inviteCodes` lookup genuinely
avoids the list-query rejection (single-doc `get()`, not a query), (d)
whether the tests are real regression tests, not tautological against
their own mocks. (This is the same brief that was sent to the failed
agent — if you still have this conversation's history, the full text is
in the SendMessage that launched it; otherwise the paragraph above plus
the plan's Revision log has everything needed to reconstruct it.)

If that review comes back clean: mark Task 4/5 (remediation) complete in
the ledger, then proceed to Task 6 (`bash .../scripts/task-brief ... 6`).
If it finds new issues: another fix round, same pattern as before.

## Known environment constraints (this sandbox specifically)

Not project facts — facts about the machine this was built on so far.
Re-check on whatever machine resumes this:

- **No Android SDK / `adb` / Java** in this execution environment. Task 1's
  and Task 5's "verify by actually running it" steps were substituted with
  compile-only / manual-trace verification and explicitly flagged as
  needing real verification later. Before trusting this build:
  - Run `npx expo run:android` for real on a machine with Android Studio.
  - Run `firebase emulators:exec --only firestore "npx jest __tests__/firestore.rules.test.ts"`
    for real on a machine with a JRE — this is the security-rules test
    suite, and **nothing has verified it against a real Firestore emulator
    yet**, only hand-traced logic. Given how many rounds the rules logic
    went through, treat this as the highest-priority manual verification
    once Java is available.
- **No iOS prebuild on Windows** — `expo prebuild` refuses iOS outright on
  this OS. `ios/` doesn't exist in this worktree. Needs a macOS or Linux
  machine to generate it.
- A `winget install` attempt for a JRE (Temurin 21) did not resolve
  (likely stuck on an elevation prompt) and was killed. If resuming on
  this same machine, either install Java manually first, or accept the
  same deferred-verification pattern for Task 5's real run.
- Firebase project setup is NOT done — `google-services.json` /
  `GoogleService-Info.plist` at the repo root are placeholder/fake values
  (safe, no real secrets) just to unblock `expo prebuild`. See
  `.env.example` for the real setup steps before this app can talk to a
  real Firebase backend.

## Process notes for whoever resumes (mistakes already made, don't repeat)

- Don't pass `isolation: "worktree"` to the Agent tool when dispatching
  implementers/reviewers — the isolated worktree for this plan already
  exists (`.worktrees/pet-app-foundation`); passing that option spins up
  a SEPARATE, disconnected worktree and its commits land on the wrong
  branch. Just tell the dispatched agent the exact worktree path to `cd`
  into.
- Double check which checkout a Read/Edit/Write call is touching when the
  tracked working directory has been bouncing between the main repo root
  and the worktree — an absolute path typo landed one plan edit in the
  main checkout instead of the worktree once (caught via `git status`
  before committing, no harm done, but easy to repeat).
