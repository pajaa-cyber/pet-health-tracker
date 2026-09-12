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

**DONE (2026-09-12).** The Firestore rules test suite was run against a
real local Firestore/Storage emulator (Java/JRE installed via
`winget install Microsoft.OpenJDK.21` — none had been available in the
sandbox these two plans were built in):

```bash
firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"
```

Result: **35/35 tests passed.** Every rules construct in this codebase
(`isMember`/`isJoining`/`isHouseholdMember`, the `diff()`/
`affectedKeys()` field-scoping, the `storage.rules` cross-service
`firestore.get()` form, and `memberIds`/`in`) has now actually been
compiled and run by a real Firestore rules engine, not just hand-traced —
no further bugs found. (The `PERMISSION_DENIED` lines in the console
output during the run are expected noise: the SDK logs a warning every
time the test suite deliberately attempts an action the rules should
reject, to confirm it's correctly denied.)

## Other known, deliberately-parked gaps (not silently dropped — real work, not yet scheduled)

1. **FIXED (2026-09-12).** `VetVisitDocumentsScreen.tsx` now subscribes to the pet's vet visits (reusing the existing `subscribeToVetVisits` listener, same pattern as every other screen — no new service function needed), finds the current visit by `visitId`, and renders its `documentUrls` as a 2-column image grid below the upload button. No `firestore.rules`/`storage.rules` changes were needed — both already granted read access to household members. Type-check and the full unit-test suite (22/22) pass; this hasn't been visually verified on a device/emulator yet since none is set up in this environment (see "Known environment constraints" below) — do that before considering it fully done.
2. **FIXED (2026-09-12).** Added `@react-native-community/datetimepicker` (expo-installed, config plugin auto-added to `app.json`, `android/` regenerated via `npx expo prebuild --platform android` to autolink it — required creating placeholder `google-services.json`/`GoogleService-Info.plist` at the project root first, since this environment didn't have them yet despite `.env.example` describing them as already present; see "Known environment constraints" below, now updated). A new shared `src/components/DateField.tsx` wraps it (tap-to-open native picker, plus a "Clear" action for the two optional fields) and is wired into all six previously-hardcoded date fields: `AddPetScreen` (birthDate), `AddVaccineScreen` (dateGiven, nextDueDate), `AddMedicationScreen` (startDate, endDate), `AddVetVisitScreen` (date), `AddExpenseScreen` (date), `WeightLogScreen` (date). `Vaccine.nextDueDate` can now be set to a real future date, unblocking Plan 3's reminder computation. `tsc --noEmit` and the full Jest suite (22/22) pass. **Not yet visually verified on a device/emulator** — still no Android SDK/device connected in this environment; do that before trusting the picker's on-screen behavior.
3. **No in-app recovery if a household becomes unreadable.** If a household document's read ever fails (e.g. after a future "remove member" feature), both `createHousehold` and `joinHousehold` fail permanently for that user, because their `users/{uid}` pointer write is evaluated as a denied `update` once it already exists. Needs UX design for account recovery, not a patch.
4. **FIXED (2026-09-12):** `VetVisitDocumentsScreen.tsx` now passes `{contentType: 'image/jpeg'}` to `putFile`, so `storage.rules`' content-type check is enforced against a real value instead of an absent one; `firestore.rules`' `households` `allow create` rule now requires `members`/`memberIds` to both exist and stay equal in size, restoring the shape guarantee. Re-verified against the real emulator (still 35/35). Still open: no client-side image compression before upload against the 10MB cap.
5. **PARTIALLY FIXED (2026-09-12):** `ExpenseListScreen`'s filter buttons and `AddExpenseScreen`'s category picker now show a visual selected state; expense amounts now require a positive value (`AddExpenseScreen.tsx`). Still open: `generateInviteCode()` in `householdService.ts` uses `Math.random()`, not a CSPRNG (not currently exploitable — deliberately left alone rather than adding a new native crypto dependency, e.g. `expo-crypto`, that would need `expo prebuild` + a real device to verify, which isn't available in this environment yet).

## Known environment constraints (whatever sandbox built this so far)

- **UPDATED (2026-09-12):** Java (Microsoft OpenJDK 21, via `winget install Microsoft.OpenJDK.21`) is now installed on this machine, which is what unblocked the rules-emulator run above. Still no Android SDK/`adb`/physical device connected, so `npm run android` / an actual on-screen check of any UI still cannot happen here — that's the next real environment gap to close.
- No iOS prebuild on Windows (`expo prebuild` refuses iOS on this OS).
- Real Firebase project not yet created — root `google-services.json`/
  `GoogleService-Info.plist` are placeholders (safe fake values, no real
  secrets) that only unblock `expo prebuild`. See `.env.example`. **Note:**
  as of 2026-09-12 these two files did not actually exist on disk in this
  environment (despite being described here as already present) and had
  to be recreated from scratch to unblock `expo prebuild` for the
  date-picker dependency below — they're gitignored, so a fresh clone/
  environment will always need them recreated; don't assume they exist
  without checking.
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
