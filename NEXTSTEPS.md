# Where we left off (2026-09-15)

Read this before doing anything else in this project. It's a handoff for
resuming work, not permanent documentation (see `CLAUDE.md` for that).
Assume the reader knows nothing about what happened in this session.

## What this is

Pet Health Tracker (React Native/Expo + Firebase), beating 11pets on price/
reliability/simplicity, built for/with a non-technical solo owner on a
Windows PC.

- Original design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Plans 1 ("Foundation & Auth"), 2 ("Pet Records Core"), 3 ("App shell and
  home screen"), and 4 ("Pet profile depth") — **all complete, merged, on
  `master`.**
- The owner's roadmap for Plans 3-9 lives in two docs at
  `docs/superpowers/specs/2026-09-13-build-plan.md` (analysis/reasoning)
  and `docs/superpowers/specs/2026-09-13-execution-pack.md` (locked
  decisions + per-phase planning/build prompts) — **treat these as the
  center/authoritative documents for all future plan work**, not just
  background reading. If only one, read the execution pack. Plan numbering
  follows the execution pack's Phase→Plan mapping: Phase 1 = Plan 3 (done),
  Phase 2 = Plan 4 (done), Phase 3 = Plan 5 "Reminders and notifications"
  (**next, not started**), Phase 4 = Plan 6 "Calendar", Phase 5 = Plan 7
  "Vets directory and household members", Phase 6 = Plan 8 "Medical
  records, documents, passport", Phase 7 = Plan 9 "Subscriptions and
  release."

## ⚠️ Data-loss incident, 2026-09-14 — read this before starting any multi-task plan

Earlier in this project, an owner report of "Plan 3 and Plan 4, already
built, tested, and pushed in a previous session" turned out, after a full
forensic check (complete git reflog, GitHub remote, every worktree on the
machine), to have **zero trace anywhere**. The work was never committed.
There is no backup device. It's gone, full stop. See `CLAUDE.md`'s "Work
durability" section (top of the file) for the rules now in place to stop
this happening again: commit per task, push frequently, never delete an
unmerged/unpushed worktree, verify real repo state via `git log`/`git status`
at the start of every session rather than trusting this file or `CLAUDE.md`
at face value. Plans 3 and 4 (the actual, real ones) were then built from
scratch, task-by-task with full SDD ledgers and two full review passes
each (per-task + final whole-branch) — see below.

**The owner has explicitly authorized committing and pushing to `origin`
freely, without asking first, for this project** — given the incident
above. Applies to all future sessions on this project unless the owner
says otherwise.

## Plan 4 — complete, merged to `master`

Built via `superpowers:subagent-driven-development`, 12 tasks, each with
its own task-scoped review, plus a final whole-branch review ("Ready to
merge: With fixes" — 6 Important findings, 0 Critical) and one fix wave
(re-reviewed clean, all 6 confirmed fixed, no regressions). Merged via PR-
equivalent local fast-forward merge (no conflicts — master hadn't moved
since the branch forked) after full verification: `tsc` clean, 41/41 unit
tests, 35/35 firestore rules tests against the real emulator. Plan doc:
`docs/superpowers/plans/2026-09-14-pet-profile-depth.md`. The SDD ledger
(`C:\dev\plan-4-pet-profile-depth\...\progress.md`) no longer exists — its
worktree was deleted after merge per `superpowers:finishing-a-development-branch`;
`git log` on `master` is the permanent record now.

**What it built** (see `CLAUDE.md`'s "UI/Design system" → "Pet profile
depth (Plan 4)" paragraph for the permanent reference — this is the
changelog):
- `Pet` widened to 23 fields, all optional/nullable, zero migration needed
  for pre-Plan-4 pets: 8-species selection, a curated breed picker (Mixed/
  Stray/Don't-know pinned above the alphabetical list), graceful date
  precision for birth date and a separate arrival-date question, sex/
  neutered/colour/living-environment, microchip details, and free-tier-
  limited custom fields.
- `src/limits/limits.ts` — the one shared place every free-tier cap is
  read from (3 custom fields/pet, 4 household members today; will read a
  real subscription from Plan 9 on with no other call site changing).
- 9-step Add Pet wizard replacing the old flat form, plus a new Edit Pet
  screen.
- `Pet.status: 'active' | 'remembered'` — a reversible toggle for a pet
  that has died. **No delete-pet feature exists anywhere in the app, by
  design.** `src/pets/petService.ts`'s `activePets()` is the one shared
  filter every pet-list screen reads through.
- Guided empty states (picture + one sentence + arrow to "+") on the
  vaccine and weight-log screens specifically, not all five record lists.

**Six Important findings from the final review, all fixed in one wave
(commit `78da185`) and re-reviewed clean:**
1. `EditPetScreen`'s birth-date precision had no `?? 'exact'` fallback —
   same bug class as Plan 3's `colorKey` miss, now fixed the same way.
2. `ChoosePetForAddScreen` (the global "+" sheet's pet chooser) still
   listed remembered pets — Task 11 had filtered `HomeScreen`/`PetSelector`
   but missed this third list. Fixed via the new shared `activePets()`.
3. Custom fields could be added but never removed — both the wizard and
   the new edit-screen section now have a Remove button per row.
4. The weight-log screen's guided empty-state button fired a doomed
   validation error on an empty field — now a no-op (see the one parked
   item below for why it's not a real fix).
5. The remembered/active toggle on the edit screen only touched local
   state and sat below Save, so it silently discarded on back-navigation
   — now commits immediately, like the photo picker beside it already did.
6. Neutered/living-environment couldn't be reset to "don't know"/unset on
   the edit screen (only in the wizard) — both now match the wizard's
   settable-or-unset pattern.

**One thing parked, not fixed (Minor, logged for a future pass):** the
weight-log empty-state's "Log weight" button (finding #4 above) is now a
literal no-op when tapped, because `GuidedEmptyState`'s `actionLabel`/
`onAction` props are both required (not optional) and widening that
shared component or wiring a real focus/submit action were both bigger
than a one-line fix-wave change. It's a dead control, not a broken one —
worth fixing whenever `GuidedEmptyState` is next touched, e.g. by Plan 5
or 6's own list screens.

**Known process note (already resolved, no action needed):** Task 9's
implementer ran `firebase deploy --only firestore:rules` against the live
project autonomously (extending the pets `create` allowlist from 8 to 23
fields) without asking first — a real process gap, since Firebase deploys
were never covered by the standing commit/push authorization. Investigated
and accepted (purely additive, required for the device testing that task
needed) but **a new standing rule is now in effect: no subagent runs
`firebase deploy` without asking the controller first, ever** — distinct
from the git commit/push authorization above. The live rules and this
branch's `firestore.rules` were reconfirmed in sync at merge time.

**Test data left in the live Firestore project** (not a code issue, just
housekeeping): a pet named "Zara" was marked remembered during device
testing, and a "TestPet12" was created during empty-state testing. Both
are stuck in the real household with no in-app cleanup path (no delete
feature, no "view remembered pets" screen) — offer to clean these up by
hand in the Firebase console next time you're in there, or mention it to
the owner.

## Plan 3 — complete, merged to `master`

Built via `superpowers:subagent-driven-development`, 10 tasks, plus a
final whole-branch review and one fix wave (re-reviewed clean).

**What it built** (see `CLAUDE.md`'s "UI/Design system" section for the
permanent record):
- Bottom tab bar (Pets/Calendar/Vets/Household) + a raised "+" add sheet,
  replacing the old single flat stack.
- Home screen rebuilt as one card per pet (photo, name, species+age, a
  minimal "next due" line), filterable by a shared `usePetSelection()`/
  `<PetSelector>` primitive every future list screen should reuse.
- Every pet has a `colorKey` identity colour — **always read it via
  `petColor(pet)`**, not `pet.colorKey` directly.
- A dev-only (`__DEV__`-gated) style guide screen.
- Real `Ionicons` for the tab bar/add button; emoji stay for decorative
  species/section glyphs only.

**One thing the final review flagged that's still open — for Plan 5:**
**Plan 5 ("Reminders and notifications") must delete
`src/pets/upcomingSummary.ts`** and `HomeScreen`'s use of it, replacing
both with the real `computeUpcoming` pure function. That temp module's
`getNextDue` picks the *nearest* due date by absolute distance — so a
vaccine overdue by two years currently loses to one due next month, and
the overdue item disappears from the card entirely. This was deliberate/
accepted for Plan 3's minimal scope, but **Plan 5's real implementation
must not inherit this — overdue should always outrank upcoming.**

**Resolved by Plan 4:** the stale-`selectedPetId`-on-delete concern noted
here previously is handled — Plan 4 has no delete, only "remembered", and
`reconcileSelection()` now resets the selection when the selected pet
stops being active.

**Still open, minor:** `HomeScreen` still has its own local "Add a pet"
button *and* the global "+" sheet also offers "Add a Pet" — harmless
duplication, worth a keep/drop call whenever convenient.

## Windows path-length gotcha (durable — also in `CLAUDE.md`)

Building from a git worktree nested under `.claude/worktrees/<name>` can
fail with `ninja: error: ... Filename longer than 260 characters` during
the native CMake build of `react-native-safe-area-context`/
`react-native-screens` — Windows' MAX_PATH limit. **Fix: create SDD
worktrees at a short path outside OneDrive from the start — `C:\dev\<plan-name>`,
not `.claude/worktrees/<name>`.** Plans 3 and 4 both used this pattern
with no build issues.

## Other environment notes

- **Intermittent phone/adb disconnects.** The connected Android phone
  drops off `adb devices` periodically, unrelated to any code change.
  Fixes in order: unplug/replug USB; unlock the phone's screen; toggle USB
  debugging off/on in Developer Options and re-accept the prompt.
- **For precise on-device UI taps**, use
  `adb shell uiautomator dump /sdcard/window_dump.xml`, pull it, and read
  the exact `bounds="[x1,y1][x2,y2]"` of the target element — screenshot-
  based coordinate estimation caused real mis-taps during Plan 3.
- The rest of the environment (Java, Android SDK, `GRADLE_USER_HOME`,
  `google-services.json`/`GoogleService-Info.plist`, `android/local.properties`)
  all still apply exactly as documented in `CLAUDE.md`'s "Local device
  build environment" section — including that every new worktree needs
  its own copy of the two gitignored Firebase config files and its own
  `android/local.properties`.
- `firebase emulators:exec` needs Java on `PATH` — if a plain shell
  reports "Could not spawn `java -version`", prepend
  `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin` to `PATH` for
  that command rather than assuming Java isn't installed.

## Known, deliberately-parked gaps

1. No in-app recovery if a household becomes unreadable (`createHousehold`/
   `joinHousehold` fail permanently once a `users/{uid}` pointer exists).
2. `generateInviteCode()` uses `Math.random()`, not a CSPRNG — parked,
   needs `expo-crypto` + a rebuild cycle.
3. No client-side warning as a vet visit's `documentUrls` approaches
   Firestore's 1 MiB/document limit.
4. Minor pre-existing gaps: no positive-value validation beyond what
   exists; `MedicationListScreen`'s dose log has no filter UI.
5. `GuidedEmptyState`'s weight-log CTA is a no-op button (see Plan 4
   section above) — fix whenever that component is next touched.
6. No read-only display surface for any of Plan 4's 15 new profile fields
   anywhere in the app except the Add-Pet wizard's own Review step — worth
   a small follow-up task before more fields pile onto a profile nothing
   shows.
7. Two stray test pets ("Zara", "TestPet12") sit in the live Firestore
   project with no in-app way to remove them (see Plan 4 section above).
8. `src/pets/upcomingSummary.ts`'s nearest-due-date bug — see Plan 3
   section above, **Plan 5 must not inherit this.**
9. `HomeScreen`'s duplicate "Add a pet" affordance vs. the global "+"
   sheet — see Plan 3 section above.

## If resuming with an SDD-style process again (e.g. for Plan 5)

Same pattern as Plans 1-4: dedicated worktree per plan at `C:\dev\<name>`
(not `.claude/worktrees/<name>`), executed via
`superpowers:subagent-driven-development`, merged via
`superpowers:finishing-a-development-branch` once complete and **actually
seen working on the phone** — reviewed is not verified, per this
project's own repeated lesson (the join-household rules bug, this
project's data-loss incident, and both Plan 3's and Plan 4's own final
reviews each catching real user-visible bugs that every individual task
review had missed because no single task's diff showed them) all survived
confident claims until someone actually ran the thing or looked at the
whole branch at once.

**Read `CLAUDE.md`'s "Pet profile depth (Plan 4)" paragraph before
starting Plan 5** — reminders/notifications will read `Pet.birthDate`
(now nullable) and the vaccine/medication due-date fields; know the
graceful-degradation date model before computing anything from it.
