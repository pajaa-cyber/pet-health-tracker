# Where we left off (2026-09-12, mid-Plan-2)

Read this before doing anything else in this project. It's a handoff for
resuming an in-progress build, not permanent documentation (see `CLAUDE.md`
for that — it now also documents Plan 2's data model/architecture).

## What this is

Pet Health Tracker (React Native/Expo + Firebase), beating 11pets on price/
reliability/simplicity. Context:

- Design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Plan 1 ("Foundation & Auth"): `docs/superpowers/plans/2026-09-11-pet-health-app-foundation.md`
  — **COMPLETE**, all 7 tasks implemented and reviewed (household create/
  join went through 3 security remediation rounds, all resolved).
- Plan 2 ("Pet Records Core"): `docs/superpowers/plans/2026-09-12-pet-records-core.md`
  — **IN PROGRESS, 13 of 15 tasks complete**, see exact status below.
- Plan 3 ("Reminders & Notifications") — not written yet.

## Where the work is happening

Isolated git worktree, NOT the main checkout:
`C:\Users\PC\OneDrive\Desktop\app\.worktrees\pet-app-foundation`
branch `pet-app-foundation`. The main checkout at
`C:\Users\PC\OneDrive\Desktop\app` should stay on `master` — do not develop there.

Executing via `superpowers:subagent-driven-development`. Its ledger — the
authoritative record of every task's outcome and every ruling — is at:
`.superpowers/sdd/2026-09-12-pet-records-core/progress.md`
(relative to the worktree above). **Read the whole ledger before resuming.**

## Plan 2 task status (13 of 15 complete, all reviewed clean)

| Task | What | Status |
|---|---|---|
| 1 | `users/{uid}` household pointer + `useHousehold()` context | ✅ Done, reviewed clean (1 fix round: added onSnapshot error handlers) |
| 2 | Pet type + petService + `isHouseholdMember()` rules helper | ✅ Done, reviewed clean |
| 3 | Pet list/add screens + RootNavigator 3-way branch | ✅ Done, reviewed clean |
| 4 | Vaccine type + service + rules | ✅ Done, reviewed clean |
| 5 | Vaccine list/add screens | ✅ Done, reviewed clean |
| 6 | Medication type (custom schedule) + service + rules | ✅ Done, reviewed clean |
| 7 | Medication list/add screens + mark-dose-given | ✅ Done, reviewed clean |
| 8 | WeightLog type + service + rules | ✅ Done, reviewed clean |
| 9 | Weight log screen + hand-rolled trend chart | ✅ Done, reviewed clean |
| 10 | Expense type + service + rules | ✅ Done, reviewed clean |
| 11 | Expense list/add screens (running total, category filter) | ✅ Done, reviewed clean |
| 12 | VetVisit type (notes-only) + service + rules | ✅ Done, reviewed clean |
| 13 | Vet visit list/add screens | ✅ Done, reviewed clean |
| 14 | Vet visit document attachments (Cloud Storage) | ❌ Not started — see below |
| 15 | Pet home dashboard (replaces incremental placeholder) | ❌ Not started |

Current HEAD on `pet-app-foundation`: commit `ecbe0b6` ("feat: add vet
visit list/add screens (notes-only)"). Working tree is clean.

## Exact next action

**Task 14 is the plan's flagged highest-uncertainty task** — first thing in
this codebase to touch Cloud Storage, using a newer Firebase feature
(Storage rules calling `firestore.get()`/`firestore.exists()` to check
household membership). Its brief is already generated at
`.superpowers/sdd/2026-09-12-pet-records-core/task-14-brief.md` (BASE
commit for its review package is `ecbe0b6`).

To resume:
1. Read the whole ledger (`progress.md` above) if picking this up in a new
   session — don't re-dispatch any of Tasks 1-13, they're done and reviewed.
2. Dispatch Task 14's implementer using the existing brief
   (`task-14-brief.md`) — read the plan's Task 14 section first for full
   context (installs `@react-native-firebase/storage` + `expo-image-picker`,
   writes `storage.rules`, a `VetVisitDocumentsScreen.tsx`). Give this task
   review the same rigor Plan 1's `firestore.rules` work got — the plan
   text itself says not to rubber-stamp the cross-service rules syntax.
3. Then Task 15 (pet home dashboard, straightforward — replaces the
   incrementally-built placeholder with the final version, all code already
   in the plan doc).
4. Then the final whole-branch review (dispatch on the most capable
   available model per the SDD skill's Model Selection section), one fix
   wave if needed, then `superpowers:finishing-a-development-branch`.

## Parked/deferred items to carry into the final whole-branch review

From the ledger's task-by-task notes — none are blocking, all should be
triaged at the final review:
- Task 7: `MedicationListScreen`'s mark-dose-given handler doesn't surface
  errors via state (unlike the Add* screens' pattern) — consistent with
  existing precedent, not a regression.
- Task 11: no visual selected-state on filter/category buttons; no
  positive-amount validation on expense entry — both consistent with the
  scaffold's existing minimalism.
- Standing, larger: `firestore.rules.test.ts` has NEVER been run against a
  real Firestore emulator through all of Plan 1 and Plan 2 so far (no JRE
  in this sandbox) — every rules-logic claim rests on hand-tracing plus a
  mocked suite. This is the single biggest outstanding risk before trusting
  this app with real data — run
  `firebase emulators:exec --only firestore "npx jest __tests__/firestore.rules.test.ts"`
  on a machine with Java before production use.
- `isMember` branch (existing household members) still has no field-level
  write scoping (can rewrite the whole household doc in one update) —
  flagged early in Plan 1's ledger as parked/non-blocking, still true.
- `generateInviteCode()` uses `Math.random()`, not a CSPRNG — noted, not
  currently exploitable.

## Known environment constraints (this sandbox specifically)

- No Android SDK/`adb`/Java — every rules-test and device-run step across
  both plans has been substituted with compile-only/hand-trace verification.
- No iOS prebuild on Windows.
- Real Firebase project not yet created — root `google-services.json`/
  `GoogleService-Info.plist` are placeholders.
- This session's Bash tool had a broken shell (no `git`/`node`/`npx` on
  PATH) — PowerShell plus Git for Windows's `bash.exe` directly
  (`"C:\Program Files\Git\bin\bash.exe" <script>`) was used instead for the
  SDD skill's helper scripts (`task-brief`, `review-package`,
  `sdd-workspace`). Re-check whether a fresh session's Bash tool works
  before assuming this workaround is still needed.

## Process notes for whoever resumes (don't repeat these mistakes)

- Don't pass `isolation: "worktree"` to the Agent tool when dispatching
  implementers/reviewers — the worktree for this work already exists
  (`.worktrees/pet-app-foundation`); that option spins up a separate,
  disconnected worktree.
- Every task in Plan 2 reuses the `isHouseholdMember(householdId)` rules
  helper (established in Task 2) — never redefine it, never add
  `hasAll`/`diff()` hijack-protection to pet-subcollection rules blocks
  (that machinery is specific to the household-join trust boundary and
  doesn't apply where every writer is already a confirmed member).
- `MainNavigator.tsx` and `PetHomeScreen.tsx` have been incrementally
  extended by Tasks 3, 5, 7, 9, 11, 13 (one Stack.Screen pair / one Button
  each) — Task 15 fully replaces `PetHomeScreen.tsx` at the end. Dispatch
  strictly in plan order; never parallelize implementers touching these
  files.
