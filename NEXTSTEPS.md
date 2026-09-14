# Where we left off (2026-09-14)

Read this before doing anything else in this project. It's a handoff for
resuming work, not permanent documentation (see `CLAUDE.md` for that).
Assume the reader knows nothing about what happened in this session.

## What this is

Pet Health Tracker (React Native/Expo + Firebase), beating 11pets on price/
reliability/simplicity, built for/with a non-technical solo owner on a
Windows PC.

- Original design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Plans 1 ("Foundation & Auth"), 2 ("Pet Records Core"), and 3 ("App shell
  and home screen") — **all complete, merged, on `master`.**
- The owner's roadmap for Plans 3-9 lives in two docs at
  `docs/superpowers/specs/2026-09-13-build-plan.md` (analysis/reasoning)
  and `docs/superpowers/specs/2026-09-13-execution-pack.md` (locked
  decisions + per-phase planning/build prompts) — **treat these as the
  center/authoritative documents for all future plan work**, not just
  background reading. If only one, read the execution pack. Plan numbering
  follows the execution pack's Phase→Plan mapping: Phase 1 = Plan 3 (done),
  Phase 2 = Plan 4 "Pet profile depth" (**next, not started**), Phase 3 =
  Plan 5 "Reminders and notifications", Phase 4 = Plan 6 "Calendar", Phase 5
  = Plan 7 "Vets directory and household members", Phase 6 = Plan 8
  "Medical records, documents, passport", Phase 7 = Plan 9 "Subscriptions
  and release."

## ⚠️ Data-loss incident, 2026-09-14 — read this before starting any multi-task plan

Earlier this same session, an owner report of "Plan 3 and Plan 4, already
built, tested, and pushed in a previous session" turned out, after a full
forensic check (complete git reflog, GitHub remote, every worktree on the
machine), to have **zero trace anywhere**. The work was never committed.
There is no backup device. It's gone, full stop. See `CLAUDE.md`'s "Work
durability" section (top of the file) for the rules now in place to stop
this happening again: commit per task, push frequently, never delete an
unmerged/unpushed worktree, verify real repo state via `git log`/`git status`
at the start of every session rather than trusting this file or `CLAUDE.md`
at face value. Plan 3 (the actual, real one) was then built from scratch,
same session, task-by-task with a full SDD ledger and two full review
passes (per-task + final whole-branch) — see below.

**The owner has explicitly authorized committing and pushing to `origin`
freely, without asking first, for this project** — given the incident
above. Applies to all future sessions on this project unless the owner
says otherwise.

## Plan 3 — complete, merged to `master`

Built via `superpowers:subagent-driven-development`, 10 tasks, each with
its own task-scoped review, plus a final whole-branch review (opus,
"Ready to merge: With fixes") and one fix wave (re-reviewed clean). Full
history: `docs/superpowers/plans/2026-09-14-app-shell-and-home-screen.md`
(the plan) and its SDD ledger (see below — read this if you want the full
blow-by-blow, including two real environment blockers hit and fixed along
the way: a Windows worktree path-length build failure, and an intermittent
phone/adb USB disconnect).

**What it built** (see `CLAUDE.md`'s "UI/Design system" section for the
permanent record — this is the changelog, that's the reference):
- Bottom tab bar (Pets/Calendar/Vets/Household) + a raised "+" add sheet,
  replacing the old single flat stack.
- Home screen rebuilt as one card per pet (photo, name, species+age, a
  minimal "next due" line), filterable by a new shared
  `usePetSelection()`/`<PetSelector>` primitive every future list screen
  should reuse.
- Every pet now has a `colorKey` identity colour (`src/theme/petColors.ts`),
  shown as a card accent / selector ring — **always read it via `petColor(pet)`**,
  not `pet.colorKey` directly (a final-review fix added the fallback for
  pets that predate this field).
- A dev-only (`__DEV__`-gated) style guide screen.
- Real `Ionicons` for the tab bar/add button; emoji stay for decorative
  species/section glyphs only.

**SDD ledger (if you want the full detail — worth skimming once, not
required to resume work):** `C:\dev\plan-3-app-shell\.superpowers\sdd\2026-09-14-app-shell-and-home-screen\progress.md`.
This is git-ignored scratch, local to that worktree only. Once this plan
is fully merged and the worktree is deleted (per
`superpowers:finishing-a-development-branch`), this ledger stops existing
— its content isn't needed after merge, `git log` on `master` is the
permanent record from that point on.

**Two things the final review flagged for whoever picks up the next
plans — not bugs, just things to not accidentally regress:**
1. **Plan 5 ("Reminders and notifications") must delete
   `src/pets/upcomingSummary.ts`** and `HomeScreen`'s use of it, replacing
   both with the real `computeUpcoming` pure function. That temp module's
   `getNextDue` picks the *nearest* due date by absolute distance — so a
   vaccine overdue by two years currently loses to one due next month, and
   the overdue item disappears from the card entirely. This was
   deliberate/accepted for Plan 3's minimal scope (and is test-covered as
   designed), but **Plan 5's real implementation must not inherit this —
   overdue should always outrank upcoming.**
2. **Plan 4 (pet profile depth / editing / delete)** needs to reconcile a
   stale `selectedPetId`: if the currently-selected pet in
   `PetSelectionContext` gets deleted, nothing resets the selection today
   (no delete UI exists yet, so it's unreachable — but Plan 4 changes that).
3. Minor, worth a deliberate decision whenever convenient: `HomeScreen`
   still has its own local "Add a pet" button *and* the new global "+"
   sheet also offers "Add a Pet" — harmless duplication, not reconciled
   during Plan 3, flagged by the final review as worth a keep/drop call
   rather than leaving by accident.

## Windows path-length gotcha (durable — also in `CLAUDE.md`)

Building from a git worktree nested under `.claude/worktrees/<name>` (the
pattern Plans 1-2 used) can fail with `ninja: error: ... Filename longer
than 260 characters` during the native CMake build of `react-native-safe-area-context`/
`react-native-screens` — Windows' MAX_PATH limit, hit by the combination
of this OneDrive-nested project path plus the worktree subdirectory plus
CMake/ninja's own long intermediate object filenames. **Fix: create SDD
worktrees at a short path outside OneDrive from the start — `C:\dev\<plan-name>`,
not `.claude/worktrees/<name>`.** If already deep into a too-nested
worktree when this hits: commit whatever's verified so far, then relocate
via `git worktree remove --force` (the old directory may not fully
delete, same root cause, harmless leftover) + a fresh
`git worktree add <short-path> <branch>` — `git worktree move` itself can
fail with a OneDrive file-lock permission error, so prefer remove+add.

## Other environment notes

- **Intermittent phone/adb disconnects.** The connected Android phone
  drops off `adb devices` (empty list) periodically, unrelated to any code
  change — Windows Device Manager can show the "ADB Interface" USB device
  itself going to status "Unknown" while the phone is otherwise
  recognized. Fixes in order of what to try: unplug/replug the USB cable
  first (usually works); if not, unlock the phone's screen; if still not,
  toggle USB debugging off/on in Developer Options and re-accept the
  authorization prompt. Not worth debugging further — it's a recurring
  flake on this phone/cable/port, not a project bug.
- **For precise on-device UI taps (screenshots for visual QA are fine,
  but tapping a specific button by estimating its position from a
  screenshot is not reliable)** — screen-to-device pixel scaling wasn't a
  simple 1:1 ratio and led to real mis-taps during Plan 3. Use
  `adb shell uiautomator dump /sdcard/window_dump.xml`, pull it, and read
  the exact `bounds="[x1,y1][x2,y2]"` of the target element instead.
- The rest of the environment (Java, Android SDK, `GRADLE_USER_HOME`,
  `google-services.json`/`GoogleService-Info.plist`, `android/local.properties`)
  all still apply exactly as documented in `CLAUDE.md`'s "Local device
  build environment" section — including that every new worktree needs
  its own copy of the two gitignored Firebase config files and its own
  `android/local.properties`, since none of that is git-tracked.

## Known, deliberately-parked gaps

1. No in-app recovery if a household becomes unreadable (`createHousehold`/
   `joinHousehold` fail permanently once a `users/{uid}` pointer exists).
2. `generateInviteCode()` uses `Math.random()`, not a CSPRNG — parked,
   needs `expo-crypto` + a rebuild cycle.
3. No client-side warning as a vet visit's `documentUrls` approaches
   Firestore's 1 MiB/document limit.
4. Minor pre-existing gaps: no positive-value validation beyond what
   exists; `MedicationListScreen`'s dose log has no filter UI.
5. `petColors.ts`'s new `petColor()` fallback helper (added in Plan 3's
   final-review fix wave) has no direct unit test for the
   undefined-`colorKey` case specifically — the existing test file only
   covers `assignPetColor`. Low-risk (a one-line nullish-coalescing
   expression), worth a 2-line test case whenever `petColors.ts` is next
   touched (likely Plan 4).
6. See "Two things the final review flagged" above (Plan 5's
   `upcomingSummary.ts` replacement, Plan 4's stale-selection reconciliation,
   the duplicate "Add a pet" affordance) — not bugs, but real scope items
   for the plans that inherit this code.

## If resuming with an SDD-style process again (e.g. for Plan 4)

Same pattern as Plans 1-3: dedicated worktree per plan at `C:\dev\<name>`
(not `.claude/worktrees/<name>` — see above), executed via
`superpowers:subagent-driven-development`, merged via
`superpowers:finishing-a-development-branch` once complete and **actually
seen working on the phone** — reviewed is not verified, per this
project's own repeated lesson (the join-household rules bug, this
session's data-loss incident, and Plan 3's own final review catching a
real user-visible bug — the missing `colorKey` fallback — that every
individual task review had missed because no single task's diff showed
it) all survived confident claims until someone actually ran the thing or
looked at the whole branch at once.
