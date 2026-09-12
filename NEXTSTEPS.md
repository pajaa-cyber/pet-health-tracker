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
  not written yet.

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
every ruling, including the full security history of the household
join-flow (three remediation rounds, each independently re-reviewed).

## Plan 1 (Foundation & Auth) is COMPLETE — all 7 tasks implemented and reviewed

| Task | What | Status |
|---|---|---|
| 1 | Expo/RNFB project scaffold | ✅ Done, reviewed, approved |
| 2 | Firebase client config | ✅ Done, reviewed, approved |
| 3 | Household/HouseholdMember types | ✅ Done, reviewed, approved |
| 4 | Household create/join service | ✅ Done, reviewed, approved (3 remediation rounds — see ledger) |
| 5 | Firestore security rules | ✅ Done, reviewed, approved (3 remediation rounds — see ledger) |
| 6 | Auth context | ✅ Done, reviewed, approved |
| 7 | Sign up/in + household setup screens | ✅ Done, reviewed, approved |

The household join flow (Tasks 4/5) went through an unusually deep review
history — the original design, and two subsequent "fixes," each looked
correct on the surface but had a real security hole found by adversarial
re-review (a join-permission bug, a member-eviction hijack, a Firestore
list-query rejection, an unrestricted `list` on the invite-code lookup
collection that let anyone enumerate every household and join without a
code, a field-smuggling gap, and finally a complete absence of any
invite-code-possession check at all). The final state (commit `18c3625`
onward) was confirmed by an adversarial re-review to have no bypass in
the invite-code check and no regression on any earlier finding. Full
blow-by-blow reasoning is in the ledger — read it before touching
`firestore.rules` or `src/household/householdService.ts` again.

## The one thing that MUST happen next

**Nothing is implemented wrong that's known about.** What's left is
verification that could only happen on a real machine, not more coding
in this sandbox. Whoever resumes should choose between:

**(a) Real-machine verification** (do this before trusting the app with
real data) — in priority order:
1. **Run the Firestore rules test suite for real**, on a machine with a
   JRE: `firebase emulators:exec --only firestore "npx jest
   __tests__/firestore.rules.test.ts"`. This is the highest-priority item
   — every rules-logic claim across three remediation rounds rests on
   hand-tracing plus a mocked business-logic suite, never the real rules
   engine. If this fails, treat it as a real bug in `firestore.rules`,
   not a test artifact.
2. Create a real Firebase project (Firestore + Auth enabled), download
   real `google-services.json`/`GoogleService-Info.plist` to the repo
   root (see `.env.example` and `CLAUDE.md`'s "Firebase setup" section for
   exact steps — current files on disk are safe placeholders).
3. Run `npx expo run:android` on a machine with Android Studio, sign up
   with a test email, confirm the Household Setup screen appears, create
   a household, and confirm in the Firebase console that a
   `households/{id}` document was created correctly.
4. Generate the iOS project (`npx expo prebuild`) on macOS or Linux —
   Windows can't do this — and verify there too if targeting iOS.

**(b) Start writing Plan 2 ("Pet Records Core")** — the next feature
plan, using `superpowers:writing-plans` against the design spec. Plan 1's
`households/{householdId}` root is now the foundation Plan 2's
`pets/{petId}` subcollections will nest under.

Ask the user which they'd rather do next if it's not obvious from context.

## Known environment constraints (this sandbox specifically)

Not project facts — facts about the machine this was built on so far.
Re-check on whatever machine resumes this:

- **No Android SDK / `adb` / Java** in this execution environment. Every
  "verify by actually running it" step across all 7 tasks was substituted
  with compile-only / manual-trace verification and explicitly flagged as
  needing real verification later (see "The one thing that MUST happen
  next" above).
- **No iOS prebuild on Windows** — `expo prebuild` refuses iOS outright on
  this OS. `ios/` doesn't exist in this worktree. Needs a macOS or Linux
  machine to generate it.
- A `winget install` attempt for a JRE (Temurin 21) did not resolve on
  this machine (likely stuck on an elevation prompt) and was killed. If
  resuming on this same machine, either install Java manually first, or
  accept the same deferred-verification pattern.
- Firebase project setup is NOT done — `google-services.json` /
  `GoogleService-Info.plist` at the repo root are placeholder/fake values
  (safe, no real secrets) just to unblock `expo prebuild`. See
  `.env.example` for the real setup steps before this app can talk to a
  real Firebase backend.
- **This session's shell environment had a broken Bash tool** (its `bash`
  had no `git`/`node`/`npx` on PATH — Windows PowerShell worked fine, and
  invoking Git for Windows's bash directly via
  `"C:\Program Files\Git\bin\bash.exe" <script>` worked for the SDD
  skill's helper scripts). If resuming with a similarly broken Bash tool,
  use PowerShell or the full bash.exe path instead of the default Bash
  tool.

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
- When a re-review comes back with new findings after a fix round, don't
  assume the NEXT fix closes everything either — this project's join flow
  had three consecutive rounds that each looked clean until adversarially
  re-reviewed. Keep dispatching fresh, skeptical re-reviews rather than
  taking an implementer's own confidence/self-report as sufficient,
  especially for `firestore.rules` changes specifically.
