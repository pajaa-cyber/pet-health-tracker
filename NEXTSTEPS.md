# Where we left off (2026-09-15)

Read this before doing anything else in this project. It's a handoff for
resuming work, not permanent documentation (see `CLAUDE.md` for that).
Assume the reader knows nothing about what happened in this session.

## ⚠️ TOP PRIORITY — Plan 5's on-device checklist still hasn't run (now blocked by a build failure, not adb)

Plan 5 ("Reminders and notifications") is **merged to `master` but not
device-verified.** Everything that could be checked without a phone
passed (`tsc` clean, 115 automated tests, a fresh independent
re-verification that the reminder calculation module is genuinely
Firebase/React-free, one real integration bug found by the final review
and fixed) — but nothing has confirmed the feature actually works on a
real phone.

**Session 1** was blocked by the phone's ADB Interface stuck in Windows'
"Unknown" USB status (`adb devices` returned nothing) — fixed itself once
the owner physically reconnected the phone (confirmed `adb devices` showed
it again).

**Session 2** (same day, phone reconnected) got past that but hit a new,
different, and so far unresolved problem: **the on-device build itself
fails**, every time, with a Gradle `Unable to delete directory
'...\node_modules\<module>\...\build\<folder>'` error — a different
module/folder each retry (tried 6 times: with/without `ANDROID_HOME` set,
after killing stray `java.exe`/Gradle daemons, after `gradlew --stop` +
deleting all the affected `build/` directories, and with Gradle's build
cache and daemon both explicitly disabled — none of it changed the
failure pattern). This looks like something on the machine (most likely
one of the four AV products CLAUDE.md documents, possibly compounded by
OneDrive syncing this folder live) briefly locking freshly-written build
output before Gradle can delete it. See CLAUDE.md's "Local device build
environment" section (the new entry right after the adb-flakiness one)
for the full diagnostic detail — don't re-run the same troubleshooting
that's already ruled out there.

**Do this before starting Plan 6:**

1. Confirm the phone is still connected: `adb devices` should show it. If
   not, unplug/replug the USB cable, unlock the phone's screen, or toggle
   USB debugging off/on in Developer Options.
2. **Before attempting another build**, try one of: (a) add a real-time-
   scanning exclusion for `C:\Users\PC\OneDrive\Desktop\app` (or at least
   its `node_modules` and `android\build` subfolders) in whichever AV
   product actually does real-time protection on this machine, or (b)
   pause OneDrive sync temporarily. Either needs the machine owner's
   action — not something a shell session can do on its own.
3. Run `npx expo run:android` from the repo root (no worktree needed —
   this is already on `master`; `ANDROID_HOME`/`ANDROID_SDK_ROOT` should
   be set to `C:\Android\Sdk` and platform-tools on `PATH` for the install
   step to find `adb`) to confirm the app builds and launches with the
   reminders feature included.
4. Run through this checklist on the phone (from Plan 5's Task 14 device
   step, with one wording correction — see the note after it):
   - Deny the notification permission deliberately. The app must stay
     usable; the permission bar (Calendar tab) must explain how to fix it,
     and tapping it must re-request.
   - Grant the permission. Add a vaccine with a due date a day or two out.
     Confirm it appears in the Calendar tab's reminders list, not overdue.
   - In Reminder Settings (now reachable via a persistent button on the
     Calendar tab, not just the empty state), set a lead time/time of day
     that puts the trigger a minute or two out, save, and confirm a real
     system notification arrives — **with the app in the foreground**,
     since that's the scenario `notificationSetup.ts`'s handler exists for.
   - Skip a medication dose from `MedicationListScreen`. Confirm "Last
     skipped" appears (not deleted, not styled as an error).
   - Mark a reminder Done from the Calendar tab. For a vaccine or vet-visit
     follow-up, confirm it disappears from the list. **For a medication,
     confirm it instead reappears with a new due date** — Done logs a
     dose and advances the schedule, it doesn't remove the reminder; the
     original checklist wording ("confirm it disappears") is wrong for
     medications specifically, caught by the final review.
   - Snooze a reminder. Confirm it disappears from the list immediately
     and does NOT still fire a notification later (this was Important
     finding #2 from the final review, now fixed — worth double-checking
     on-device since it's exactly the kind of thing only a phone catches).
   - With two phones/accounts in the same household (or one phone, checked
     before/after), add a vaccine on one and confirm the other's reminders
     list updates live.
5. Once the checklist passes, update this file's top section to say so
   and move on to Plan 6. If something fails, it's a real bug in already-
   merged `master` code — fix it directly on `master` (small, targeted
   commits, per the standing commit/push-freely authorization) rather than
   opening a new worktree for what should be a quick fix.

## What this is

Pet Health Tracker (React Native/Expo + Firebase), beating 11pets on price/
reliability/simplicity, built for/with a non-technical solo owner on a
Windows PC.

- Original design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Plans 1 ("Foundation & Auth"), 2 ("Pet Records Core"), 3 ("App shell and
  home screen"), and 4 ("Pet profile depth") — **all complete, device-
  verified, merged, on `master`.** Plan 5 ("Reminders and notifications")
  — **code complete and merged, device verification outstanding (see top
  of this file).**
- The owner's roadmap for Plans 3-9 lives in two docs at
  `docs/superpowers/specs/2026-09-13-build-plan.md` (analysis/reasoning)
  and `docs/superpowers/specs/2026-09-13-execution-pack.md` (locked
  decisions + per-phase planning/build prompts) — **treat these as the
  center/authoritative documents for all future plan work**, not just
  background reading. If only one, read the execution pack. Plan numbering
  follows the execution pack's Phase→Plan mapping: Phase 1 = Plan 3 (done),
  Phase 2 = Plan 4 (done), Phase 3 = Plan 5 (done, pending device check),
  Phase 4 = Plan 6 "Calendar" (**next, once Plan 5 is device-verified**),
  Phase 5 = Plan 7 "Vets directory and household members", Phase 6 =
  Plan 8 "Medical records, documents, passport", Phase 7 = Plan 9
  "Subscriptions and release."

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
at face value.

**The owner has explicitly authorized committing and pushing to `origin`
freely, without asking first, for this project** — given the incident
above. Applies to all future sessions on this project unless the owner
says otherwise.

## Plan 5 — code complete, merged to `master`, device verification outstanding

Built via `superpowers:subagent-driven-development`, 14 tasks, each with
its own task-scoped review, plus a final whole-branch review (opus,
"Ready to merge: With fixes" — 4 Important findings, 0 Critical) and one
fix wave (re-reviewed clean, all 4 plus 2 upgraded-Minor findings
confirmed fixed, no regressions). Merged via local fast-forward (no
conflicts — master hadn't moved since the branch forked) after full
verification: `tsc` clean, 80 unit tests, 35 firestore rules tests
against the real emulator. Plan doc:
`docs/superpowers/plans/2026-09-15-reminders-and-notifications.md`. See
`CLAUDE.md`'s "Reminders and notifications (Plan 5)" paragraph for the
permanent architecture reference.

**What it built:**
- `src/reminders/computeUpcoming.ts` — a pure calculation module (zero
  Firebase/React dependency, independently re-verified fresh by the final
  review, not just per-task) that works out every upcoming vaccine due
  date, medication dose, and vet-visit follow-up from existing records.
  Ascending-sort-by-due-date fixes the real Plan-3 bug documented below.
- Local notifications via a new `expo-notifications` dependency,
  recomputed and rescheduled whenever data or settings change
  (`ReminderRescheduler.tsx`, mounted once at the app root).
- Done/Skip/Snooze on every reminder. Skip reads as a normal action, not
  a failure (outline-styled button, "Last skipped" phrasing). Vaccine and
  vet-visit-follow-up Done/Skip deliberately collapse to the same effect
  (both clear the date) — intentional, flagged by three separate reviewers
  as the plan's most user-visible judgment call, worth the owner's eyes
  once it's actually on the phone.
- A permission bar, and a Reminder Settings screen (lead time, time of
  day, and the required honest line that reminders are scheduled on *this*
  phone from what *this* phone has seen) — reachable via a persistent
  button on the Calendar tab, not just the empty state (a real
  reachability bug the final review caught and the fix wave fixed).
  Settings/snoozes are stored locally per device via a new
  `@react-native-async-storage/async-storage` dependency, never Firestore.
- The reminders list currently lives in the `CalendarScreen` tab
  (replacing its old "coming soon" placeholder) rather than a new
  dedicated tab — Plan 6 is expected to grow real week/month views around
  it, not replace it.
- `firestore.rules`' vetVisits create allowlist gained one field
  (`followUpDate`) — the only rules change this plan needed.

**Four Important findings from the final review, all fixed in one wave
(commit `57625e8`) and re-reviewed clean, plus two Minor findings upgraded
to fix-now because they were cheap and related:**
1. Reminder Settings was only reachable via the empty state's action —
   unreachable the moment any reminder existed, which is the entire point
   of the feature. Fixed with a persistent button on the Calendar tab.
2. Snoozed reminders still got scheduled as notifications, contradicting
   the store's own documented contract. Fixed by filtering through
   `isSnoozed` before every `rescheduleNotifications` call.
3. No `Notifications.setNotificationHandler` anywhere, so notifications
   silently didn't display while the app was in the foreground — exactly
   the scenario the device checklist tests. Fixed via a new
   `notificationSetup.ts`, imported once in `App.tsx`.
4. `ReminderRescheduler`'s cancel-all-then-reschedule ran unserialized up
   to `1+3N` times per launch, including once with no pet data loaded
   (wiping prior-session notifications), with no guard against overlapping
   runs. Fixed with a `petsLoaded` gate and a `runToken` ref.
5. (upgraded Minor) `household` object-reference (not `.id`) as a
   dependency churned every per-pet listener on unrelated household-doc
   updates, in two hooks.
6. (upgraded Minor) A hardcoded `30`-day horizon was duplicated three
   ways — now one exported `REMINDERS_HORIZON_DAYS` constant.

**Parked, not fixed (real but out of scope for the fix wave, logged for a
future pass):** a `petsLoaded` flag that never resets if a household later
goes from present to absent (pre-existing behavior, no household-switching
feature exists yet to trigger it); `CalendarScreen`'s own separate pets
listener still depends on `household` not `household.id` (same churn
class as finding #5, but on an out-of-scope line). See `CLAUDE.md`'s
Known-gaps section for the rest of the logged Minors (notification
channel, snooze pruning, error surfacing on Done/Skip, listener
duplication across components).

## Plan 4 — complete, merged to `master`

Built via `superpowers:subagent-driven-development`, 12 tasks, plus a
final whole-branch review ("Ready to merge: With fixes" — 6 Important
findings, 0 Critical) and one fix wave (re-reviewed clean).

**What it built** (see `CLAUDE.md`'s "Pet profile depth (Plan 4)"
paragraph for the permanent reference):
- `Pet` widened to 23 fields, all optional/nullable, zero migration needed:
  8-species selection, a curated breed picker (Mixed/Stray/Don't-know
  pinned above the alphabetical list), graceful date precision for birth
  date and a separate arrival-date question, sex/neutered/colour/living-
  environment, microchip details, and free-tier-limited custom fields.
- `src/limits/limits.ts` — the one shared place every free-tier cap is
  read from.
- 9-step Add Pet wizard, a new Edit Pet screen, `Pet.status: 'active' |
  'remembered'` (reversible, no delete-pet feature anywhere by design).
- Guided empty states on the vaccine and weight-log screens.

**One thing parked, not fixed:** the weight-log empty-state's "Log
weight" button is a no-op when tapped (`GuidedEmptyState`'s action props
are required, widening the component was bigger than the fix wave) — fix
whenever that component is next touched.

**Test data left in the live Firestore project** (housekeeping, not a
code issue): a pet named "Zara" was marked remembered, and a "TestPet12"
was created, both during device testing. No in-app cleanup path exists —
clean up by hand in the Firebase console whenever convenient.

## Plan 3 — complete, merged to `master`

Built via `superpowers:subagent-driven-development`, 10 tasks, plus a
final whole-branch review and one fix wave.

**What it built** (see `CLAUDE.md`'s "UI/Design system" section):
- Bottom tab bar (Pets/Calendar/Vets/Household) + a raised "+" add sheet.
- Home screen rebuilt as one card per pet, filterable by a shared
  `usePetSelection()`/`<PetSelector>` primitive.
- Every pet has a `colorKey` identity colour — always read it via
  `petColor(pet)`, not `pet.colorKey` directly.
- Real `Ionicons` for the tab bar/add button; emoji for decorative glyphs.

**Resolved by Plan 5:** `src/pets/upcomingSummary.ts` (the placeholder
whose "nearest by absolute distance" due-date picking let a two-year-
overdue vaccine lose to one due next month) is deleted; `HomeScreen` now
uses the real `computeUpcoming`, which ranks overdue above upcoming by
construction.

**Resolved by Plan 4:** the stale-`selectedPetId`-on-delete concern is
handled via `reconcileSelection()`.

**Still open, minor:** `HomeScreen` still has its own local "Add a pet"
button *and* the global "+" sheet also offers "Add a Pet" — harmless
duplication, worth a keep/drop call whenever convenient.

## Windows path-length gotcha (durable — also in `CLAUDE.md`)

Building from a git worktree nested under `.claude/worktrees/<name>` can
fail with `ninja: error: ... Filename longer than 260 characters` during
the native CMake build of `react-native-safe-area-context`/
`react-native-screens` — Windows' MAX_PATH limit. **Fix: create SDD
worktrees at a short path outside OneDrive from the start — `C:\dev\<plan-name>`,
not `.claude/worktrees/<name>`.** Plans 3, 4, and 5 all used this pattern
with no build issues. Note: removing a worktree afterward can still fail
with the same "Filename too long" error on deeply-nested `node_modules`
paths even from a short base — this is harmless (the worktree is already
deregistered from git's perspective by that point) and the leftover
directory can be cleaned up separately with PowerShell's
`Remove-Item -LiteralPath "\\?\<path>" -Recurse -Force` long-path-safe
syntax.

## Other environment notes

- **Intermittent phone/adb disconnects — now the single biggest blocker
  in this project.** The connected Android phone (Honor, MagicOS 10) can
  get stuck with Windows Device Manager showing its "ADB Interface" USB
  device at status "Unknown" and `adb devices` returning nothing. This
  blocked Plan 5's entire device-verification pass (see the top of this
  file). Fixes in order: unplug/replug USB; unlock the phone's screen;
  toggle USB debugging off/on in Developer Options and re-accept the
  prompt. None of these can be done by an agent alone — they need a human
  hand on the physical cable/screen. A software-only PnP device
  disable/re-enable via PowerShell was tried once as a remote equivalent
  and failed ("Generic failure") — don't bother retrying that path.
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
- **A new native dependency added in a worktree needs `npm install` run
  again on the main checkout after merging** — `node_modules` is per
  checkout, not shared, so merging a branch that added a package into
  `package.json` leaves `tsc`/Jest failing with "Cannot find module"
  until `npm install` runs on `master` too. Bit both Plan 4 and Plan 5's
  merges; not a bug, just easy to forget.

## Known, deliberately-parked gaps

1. No in-app recovery if a household becomes unreadable (`createHousehold`/
   `joinHousehold` fail permanently once a `users/{uid}` pointer exists).
2. `generateInviteCode()` uses `Math.random()`, not a CSPRNG — parked,
   needs `expo-crypto` + a rebuild cycle.
3. No client-side warning as a vet visit's `documentUrls` approaches
   Firestore's 1 MiB/document limit.
4. Minor pre-existing gaps: no positive-value validation beyond what
   exists; `MedicationListScreen`'s dose log has no filter UI.
5. `GuidedEmptyState`'s weight-log CTA is a no-op button (Plan 4) — fix
   whenever that component is next touched.
6. No read-only display surface for any of Plan 4's 15 new profile fields
   anywhere in the app except the Add-Pet wizard's own Review step.
7. Two stray test pets ("Zara", "TestPet12") sit in the live Firestore
   project with no in-app way to remove them (Plan 4) — clean up by hand
   in the Firebase console.
8. `HomeScreen`'s duplicate "Add a pet" affordance vs. the global "+"
   sheet (Plan 3) — harmless, worth a keep/drop call whenever convenient.
9. Plan 5's logged-not-fixed Minors: no Android notification channel;
   snooze entries never pruned; Done/Skip has no error surface on the
   reminders screen; listener fan-out duplicated across 3 components
   (~27 concurrent Firestore listeners for 3 pets with Calendar open,
   worth a shared provider like `PetSelectionContext`'s precedent
   whenever it hurts); a DST edge case in notification-time math (worst
   case: one calendar day early/late, twice a year).
10. **Plan 5's device verification — see the top of this file. The
    single most important open item in the project right now.**

## If resuming with an SDD-style process again (e.g. for Plan 6)

**Do not start Plan 6 before Plan 5's device checklist (top of this file)
has actually run.** Once it has, same pattern as Plans 1-5: dedicated
worktree per plan at `C:\dev\<name>` (not `.claude/worktrees/<name>`),
executed via `superpowers:subagent-driven-development`, merged via
`superpowers:finishing-a-development-branch` once complete and **actually
seen working on the phone** — reviewed is not verified, per this
project's own repeated lesson (the join-household rules bug, the data-
loss incident, and every plan's final review so far catching real
user-visible bugs that no single task review had caught) all survived
confident claims until someone actually ran the thing or looked at the
whole branch at once. Plan 5 adds a new instance of this lesson: the
final review itself (not a task review) caught two bugs — unreachable
settings, silently-swallowed foreground notifications — that only a
five-minute phone session would otherwise have surfaced, and that phone
session still hasn't happened.

**Read `CLAUDE.md`'s "Reminders and notifications (Plan 5)" paragraph
before starting Plan 6** — the calendar's week/month views will read from
`computeUpcoming` and are expected to grow around the existing reminders
list in `CalendarScreen.tsx`, not replace it outright; reuse the shared
`usePetSelection()`/`<PetSelector>` primitive again, per the execution
pack's explicit requirement.
