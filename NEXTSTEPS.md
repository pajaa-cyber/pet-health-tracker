# Where we left off (2026-09-12, Plans 1 & 2 complete and merged)

Read this before doing anything else in this project. It's a handoff for
resuming work, not permanent documentation (see `CLAUDE.md` for that —
it now documents the full data model/architecture, including the known
gaps below).

## What this is

Pet Health Tracker (React Native/Expo + Firebase), beating 11pets on price/
reliability/simplicity. Context:

- Design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Plan 1 ("Foundation & Auth"): `docs/superpowers/plans/2026-09-11-pet-health-app-foundation.md` — **COMPLETE, merged.**
- Plan 2 ("Pet Records Core"): `docs/superpowers/plans/2026-09-12-pet-records-core.md` — **COMPLETE, merged.**
- Plan 3 ("Reminders & Notifications") — **not written yet.**

Both plan documents contain some superseded code snippets from early
drafts, flagged inline with "⚠️ STALE — DO NOT COPY THIS SNIPPET" warnings
(added after the `.filter()` bug below was found) — always copy from the
current source files, never from plan text, when referencing prior work.

## Where the work is happening

There is **no separate worktree anymore** — the `pet-app-foundation`
branch was merged into `master` and both the branch and its worktree
were deleted after the merge. Everything now lives directly in the main
checkout: `C:\Users\PC\OneDrive\Desktop\app`, on `master`.

The SDD ledgers that recorded every task's outcome and every ruling made
during both plans' execution were git-ignored scratch space inside the
now-deleted worktree — they no longer exist on disk. The durable record
of everything that happened is the git commit history on `master`
(commit messages are descriptive; `git log --oneline` tells the story)
plus this file and `CLAUDE.md`, which were updated with the substance of
what mattered before that scratch space was removed.

## What actually happened (the short version)

All 22 tasks across both plans (7 in Plan 1, 15 in Plan 2) were
implemented and individually reviewed clean. The household join flow
(Plan 1) went through 3 security remediation rounds during its own
development. Plan 2 added pets, vaccines, medications, weight logs,
expenses, and vet visits (with Cloud Storage document attachments), each
with its own type/service/rules/screens, culminating in a pet-home
dashboard.

**Plan 2's final whole-branch review found a genuinely critical defect:**
the entire access-control model in `firestore.rules` and `storage.rules`
relied on `list.filter(m => m.userId == request.auth.uid)` — a construct
the Firestore Rules language does not support at all (no lambda/
anonymous-function syntax exists in that language). This had been the
foundation of every membership check since Plan 1 and survived three
prior "adversarial" security reviews, because none of them had a real
Firestore emulator available to actually deploy/run the rules — every
review hand-traced the LOGIC while implicitly assuming the SYNTAX was
valid. Left as-is, this would have either failed the ruleset at deploy
time or locked every user out of the entire app.

**Fix:** denormalized a `memberIds: string[]` array onto the household
document (kept in lockstep with the existing `members: HouseholdMember[]`
by `householdService.ts`'s atomic batches), and replaced every membership
check with `request.auth.uid in memberIds` — the `in` operator on a
string list is solid, unambiguous Firestore Rules syntax. The fix was
independently re-reviewed, which hand-traced both classic hijack attack
shapes against the new logic and confirmed no regressions, and also
caught a fourth `.filter()` site the original review had missed. See
`CLAUDE.md`'s "Data model" section for the resulting architecture.

The fix wave also added missing `onSnapshot` error handlers to all six
record-type subscription functions, error handling on the
mark-dose-given action, and made the medication dose log show *who* gave
a dose (not just when).

## The single highest-priority next action

**Run the Firestore rules test suite against a real emulator.** Nothing
in either plan has ever done this — every rules construct in this
codebase (`isMember`/`isJoining`/`isHouseholdMember`, the `diff()`/
`affectedKeys()` field-scoping, the `storage.rules` cross-service
`firestore.get()` form, and now `memberIds`/`in`) has only ever been
hand-traced. One real construct already turned out to be invalid syntax
and was caught only by luck of a sufficiently careful final review — the
remaining constructs deserve the same scrutiny a real compiler/emulator
run gives for free.

```bash
npm install -g firebase-tools   # if not already installed
firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"
```

Requires a JRE (Java) — none was available in the sandbox these two plans
were built in. If any test fails, treat it as a real bug in `firestore.rules`/
`storage.rules`, not a test artifact, and fix it with the same care the
`.filter()` bug got.

## Other known, deliberately-parked gaps (not silently dropped — real work, not yet scheduled)

1. **Vet-visit documents can be uploaded but never viewed.** `VetVisitDocumentsScreen.tsx` uploads to Cloud Storage and calls `addVetVisitDocument`, but no screen subscribes to a visit and renders its `documentUrls` back. This is a gap against the spec's "vet visits — timeline with notes and attached documents." Needs a proper follow-up task (subscribe + render an image list), not a quick patch.
2. **No date-picker UI anywhere.** Every date field (`birthDate`, `dateGiven`, `nextDueDate`, vet visit `date`, expense `date`, weight-log `date`) is hardcoded to `Date.now()` at entry time. `Vaccine.nextDueDate` can therefore never be set to a real future date — a gap against the spec's "vaccines — list with due dates," and it blocks Plan 3's reminder computation, which explicitly needs a real stored due date to work from. Needs a real date-picker component (a new dependency, e.g. `@react-native-community/datetimepicker`) across several screens.
3. **No in-app recovery if a household becomes unreadable.** If a household document's read ever fails (e.g. after a future "remove member" feature), both `createHousehold` and `joinHousehold` fail permanently for that user, because their `users/{uid}` pointer write is evaluated as a denied `update` once it already exists. Needs UX design for account recovery, not a patch.
4. Minor, all real but low-severity: `storage.rules`' content-type check is enforced against a value the upload screen never explicitly sets (should pass `{contentType: 'image/jpeg'}` to `putFile`); no client-side image compression before upload against the new 10MB cap; the `households` `allow create` rule no longer requires a `members` array to exist (only `memberIds`) — self-inflicted-only, not exploitable against others, but lost an implicit shape guarantee.
5. `MedicationListScreen`'s dose-log/`ExpenseListScreen`'s filter buttons have no visual selected-state; expense amounts have no positive-value validation; `generateInviteCode()` uses `Math.random()`, not a CSPRNG (not currently exploitable) — all pre-existing, low-severity, cosmetic-or-defensive-only items noted for whenever a polish pass happens.

## Known environment constraints (whatever sandbox built this so far)

- No Android SDK/`adb`/Java — every rules-test and device-run step across
  both plans was substituted with compile-only/hand-trace verification.
  This is the actual reason the emulator run above has never happened.
- No iOS prebuild on Windows (`expo prebuild` refuses iOS on this OS).
- Real Firebase project not yet created — root `google-services.json`/
  `GoogleService-Info.plist` are placeholders (safe fake values, no real
  secrets) that only unblock `expo prebuild`. See `.env.example`.
- If a session's Bash tool has no `git`/`node`/`npx` on PATH (this
  happened during both plans' builds), use PowerShell, or invoke Git for
  Windows's `bash.exe` directly for anything that specifically needs a
  POSIX shell.

## If resuming with an SDD-style process again (e.g. for Plan 3)

The two prior plans were executed via `superpowers:subagent-driven-development`
inside a dedicated git worktree (created via `superpowers:using-git-worktrees`),
merged back to `master` via `superpowers:finishing-a-development-branch`
once complete. That's a reasonable pattern to repeat for Plan 3 — set up
a fresh worktree/branch off current `master`, don't develop Plan 3
directly on `master`.
