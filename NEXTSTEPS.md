# Where we left off (2026-09-14)

Read this before doing anything else in this project. It's a handoff for
resuming work, not permanent documentation (see `CLAUDE.md` for that).
Assume the reader knows nothing about what happened in this session.
**This file was completely out of date until today's rewrite** — it
previously said "Plan 3 not written yet" while Plan 3 was actually
mid-implementation in a worktree nobody had pointed this file at. Don't
let that happen again: keep this file honest about what's actually
in-progress, not just what's merged to `master`.

## What this is

Pet Health Tracker (React Native/Expo + Firebase), beating 11pets on price/
reliability/simplicity, built for/with a non-technical solo owner on a
Windows PC.

- Original design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Plan 1 ("Foundation & Auth") and Plan 2 ("Pet Records Core") — **complete, merged, on `master`.**
- The owner's roadmap for Plans 3-9 lives in two docs, now at
  `docs/superpowers/specs/2026-09-13-build-plan.md` (analysis/reasoning)
  and `docs/superpowers/specs/2026-09-13-execution-pack.md` (locked
  decisions + per-phase planning/build prompts) — **treat these as the
  center/authoritative documents for all future plan work**, not just
  background reading. If only one, read the execution pack.
- **Plan 3 ("App shell and home screen") is IN PROGRESS RIGHT NOW**, not
  on `master` yet — see "Plan 3 status" below. Do not re-plan or re-start
  it; resume the existing worktree.

## ⚠️ Data-loss incident, 2026-09-14 — read this before starting any multi-task plan

An owner report of "Plan 3 and Plan 4, already built, tested, and pushed
in a previous session" turned out, after a full forensic check (complete
git reflog, GitHub remote, every worktree on the machine), to have **zero
trace anywhere**. The work was never committed. There is no backup device.
It's gone, full stop. See `CLAUDE.md`'s "Work durability" section (top of
the file) for the rules now in place to stop this happening again:
commit per task, push frequently, never delete an unmerged/unpushed
worktree, verify real repo state via `git log`/`git status` at the start
of every session rather than trusting this file or `CLAUDE.md` at face
value.

**The owner has explicitly authorized committing and pushing to `origin`
freely, without asking first, for this project** — given the incident
above. Applies to all future sessions on this project unless the owner
says otherwise.

## Plan 3 status: in progress, NOT on `master`

- **Worktree location: `C:\dev\plan-3-app-shell`** (NOT under
  `.claude/worktrees/` — see "Windows path-length gotcha" below for why).
  Branch: `worktree-plan-3-app-shell`. Pushed to `origin/worktree-plan-3-app-shell`
  — every commit so far is safely on GitHub even though the branch isn't
  merged to `master`.
- Plan document: `docs/superpowers/plans/2026-09-14-app-shell-and-home-screen.md`
  (10 tasks). Being executed via `superpowers:subagent-driven-development`.
- **SDD progress ledger (the authoritative task-by-task record — read this
  first when resuming):** `C:\dev\plan-3-app-shell\.superpowers\sdd\2026-09-14-app-shell-and-home-screen\progress.md`
  (this is git-ignored scratch, local to that worktree only — it does not
  exist anywhere else, so if that worktree is ever lost, reconstruct
  status from `git log` on the branch instead).
- **Status as of this write-up:**
  - Tasks 1-7: complete, reviewed (Approved), merged into the worktree branch.
  - Task 8 (bottom tab navigator + raised "+" button): code complete,
    committed (`fe6173d`), pushed, `tsc --noEmit` clean, and on-device
    confirmed the tab bar + button render and position correctly — BUT
    its task review has not been dispatched yet, and two behaviors are
    still unverified on-device: tab-switching preserving state, and the
    tab bar hiding when pushing into a screen from the Pets tab. A
    subagent got cut off mid-verification by a platform rate limit
    ("session limit, resets 12pm Europe/Budapest" — check whether that's
    still relevant when resuming; if not, it's fully lifted by now).
  - Tasks 9 (real `AddSheet` sheet + `ChoosePetForAddScreen`) and 10 (dev
    style guide screen) — **not started.**
  - Next action on resume: reconnect the phone, finish Task 8's remaining
    on-device checks, dispatch its task review, then continue task-by-task
    from Task 9 per the ledger.

## Windows path-length gotcha (new this session — durable, added to CLAUDE.md too)

Building from a git worktree nested under `.claude/worktrees/<name>` (the
pattern Plans 1-2 used) can fail with `ninja: error: ... Filename longer
than 260 characters` during the native CMake build of `react-native-safe-area-context`/
`react-native-screens` — Windows' MAX_PATH limit, hit by the combination
of this OneDrive-nested project path plus the worktree subdirectory plus
CMake/ninja's own long intermediate object filenames. Happened partway
through Plan 3's Task 1. **Fix used:** relocate the worktree to a short
path outside OneDrive entirely, e.g. `C:\dev\<plan-name>`, not under
`.claude/worktrees/`. `git worktree move` itself failed with a OneDrive
file-lock permission error — worked around via `git worktree remove --force`
(unregister only; the old nested directory may not fully delete, same
root cause, harmless leftover) + a fresh `git worktree add <short-path> <branch>`.
**Recommendation for future plans:** create worktrees under `C:\dev\`
from the start, skip the `.claude/worktrees/` default.

## Other environment notes from this session

- **Intermittent phone/adb disconnects.** The connected Android phone
  dropped off `adb devices` (empty list) three separate times this
  session, unrelated to any code change — confirmed via Windows Device
  Manager once that the "ADB Interface" USB device itself showed status
  "Unknown" even though the phone was otherwise recognized. Fixes that
  worked, in order of what to try: unplug/replug the USB cable first
  (resolved it twice); if that fails, unlock the phone's screen (it may
  have simply locked/slept); if still failing, toggle USB debugging off/on
  in Developer Options and re-accept the authorization prompt. Not
  something to spend long debugging — it's a recurring flake on this
  specific phone/cable/port combination, not a project bug.
- The rest of the environment (Java, Android SDK, `GRADLE_USER_HOME`,
  `google-services.json`/`GoogleService-Info.plist`, `android/local.properties`)
  all still apply exactly as documented in `CLAUDE.md`'s "Local device
  build environment" section — including that every new worktree needs
  its own copy of the two gitignored Firebase config files and its own
  `android/local.properties`, since none of that is git-tracked.

## Known, deliberately-parked gaps (unchanged from before this session)

1. No in-app recovery if a household becomes unreadable (`createHousehold`/
   `joinHousehold` fail permanently once a `users/{uid}` pointer exists).
2. `generateInviteCode()` uses `Math.random()`, not a CSPRNG — parked,
   needs `expo-crypto` + a rebuild cycle.
3. No client-side warning as a vet visit's `documentUrls` approaches
   Firestore's 1 MiB/document limit.
4. Minor pre-existing gaps: no positive-value validation beyond what
   exists; `MedicationListScreen`'s dose log has no filter UI.

## If resuming with an SDD-style process again

Same pattern as Plans 1-2: dedicated worktree per plan (now: use `C:\dev\<name>`,
not `.claude/worktrees/<name>` — see above), executed via
`superpowers:subagent-driven-development`, merged via
`superpowers:finishing-a-development-branch` once complete and **actually
seen working on the phone** — reviewed is not verified, per this project's
own repeated lesson (the join-household rules bug, and now this session's
data-loss incident, both survived confident claims until someone actually
ran the thing).
