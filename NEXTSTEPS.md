# Where we left off (2026-09-21)

Read this before doing anything else in this project. It's a handoff for
resuming work, not permanent documentation (see `CLAUDE.md` for that).
Assume the reader knows nothing about what happened in this session.

## ✅ Colourful Reskin, Part B — device-verified (2026-09-22)

Continues Part A's dark-shell reskin onto the two areas its own README
explicitly parked for later: the five record-list screens (Vaccines,
Medications, Vet Visits, Weight, Expenses) and the whole Calendar tab
(`CalendarScreen.tsx`, `DayDetailScreen.tsx`, `WeekView.tsx`,
`MonthView.tsx`, `EntryCard.tsx`). Built via
`superpowers:subagent-driven-development` in a dedicated worktree at
`C:\dev\colorful-reskin-b` (branch `colorful-reskin-b`, off `master` at
`e7fe10a`) — 9 tasks, each reviewed clean or fixed and re-reviewed clean
(see `.superpowers/sdd/2026-09-21-colorful-reskin-part-b/progress.md` for
the full per-task ledger). Full architecture detail: CLAUDE.md's
"Colourful Reskin (Part B)" paragraph under UI/Design system.

**This task (Task 9) ran full local verification and it is all clean:**
`npx tsc --noEmit` — 0 errors. `npx jest __tests__
--testPathIgnorePatterns=firestore.rules` — 19 suites / 108 tests, all
passed. `firebase emulators:exec --only firestore,storage "npx jest
__tests__/firestore.rules.test.ts"` — 41/41 passed, the same count as
`master` (this plan touches no `firestore.rules`/`storage.rules`/rules-test
file — confirmed via `git diff master` on those paths, empty). `git diff
master -- package.json` is also empty — zero new dependencies, as planned.
A full re-read of `git diff master` found no data/logic change beyond the
two the plan explicitly sanctioned: `daysWithEntries()`'s richer
`Map<number, string[]>` return (Task 6, for multi-pet day dots) and the new
`useCalendarEntryActions` hook's toggle-based event Done/Skip (Tasks 5, 7 —
"Mark done"/"Not done" and "Skip"/"Bring back"). The five record-list
screens each gained a new `subscribeToPets` read (for the pet-colour rail)
that wasn't in the plan's two headline items, but it's a plan-authored,
display-only read (not a computed value or a write) that the SDD ledger
already logged as deliberate — not scope creep.

**On-device pass completed 2026-09-22**, on a second physical phone (Honor
`DNY-NX9`, distinct from the `MTN-NX1M` used for Part A/Plan 5/6), signed in
as the real account (`mpajevic7@gmail.com`) to reach real household data
(Macmac, Dona — 12 vaccines, 4 medications, 5 vet visits, 5 weight logs, 1
expense on Dona), driven via `adb`/`uiautomator` (bounds-based taps, not
screenshot-coordinate guessing) per this project's established practice.
Confirmed working correctly:

- **The Critical fix, specifically confirmed:** "View full day" (both Week
  and Month agenda headers) navigates to `DayDetailScreen` successfully —
  the screen that a whole-branch review found completely unreachable is
  reachable again. Its header (back button + date title) and its empty
  state both render correctly in the dark shell.
- **The Important contrast fix, specifically confirmed:** `GuidedEmptyState`'s
  dark variant — checked on 3 separate empty states (Calendar Week mode's
  "Nothing here", Overdue mode's "Nothing overdue", `DayDetailScreen`'s
  "Nothing this day") — all render with fully readable white/light-grey
  text on the dashed `shell.card` container, not the near-invisible
  light-theme text the review caught.
- Record lists: Vaccines, Medications (incl. the `Button` colour-override
  Skip/Mark-given pair — cosmetic note: "Mark dose as given"'s label wraps
  to 2 lines on this screen width, still fully legible/tappable, not a
  break), and Expenses (incl. tapping a category filter chip, which
  correctly re-filtered the list and updated the total) all render with
  the shared `RecordListHeader`/pet-colour-rail/`DashedAddButton` layout
  exactly as designed. Weight's chart-plus-form structure (no new list,
  per this plan's own explicit constraint) confirmed unchanged.
- Calendar: eyebrow/title/Reminders pill header, dark `PetSelector`,
  Week/Month/Overdue chips, the `‹ range ›` row, Week strip
  today/selected states all render correctly.
- **Multi-pet day dots confirmed working**: Month view showed two visually
  distinct pet-colour dots on a day both Macmac and Dona had entries on —
  the exact `daysWithEntries()`/`Map<number,string[]>` dedup behavior Task 6
  added.
- **The restored inline Month agenda confirmed working**: selecting a day
  in Month mode renders that day's real entry cards directly beneath the
  grid — no longer the "View full day"-only hint Plan 6 shipped.
- **A real Done action round-trip confirmed working end-to-end**: tapped
  "Done" on a real medication reminder, the Firestore write succeeded (no
  error surfaced), and the agenda list correctly re-rendered with the
  actioned item gone. This exercises `useCalendarEntryActions`'s hook on
  real hardware, not just in review.

**Not yet covered by this pass** (lower-risk than the above — none of these
were flagged by the final review, unlike the two Critical/Important items
above): the Vet Visits list screen specifically (not opened this session);
`DayDetailScreen` with real entries showing (only its empty state was seen
— reached via a day with 0 items); the event-card Done/Skip **toggle**
specifically ("Mark done"⇄"Not done", "Skip"⇄"Bring back") — this test
household's calendar entries were all reminders (medication doses), which
are correctly one-directional per design, not toggle-based, so the toggle
path itself wasn't exercised; the 5 record-list screens' "Add a ___" flows.
Worth a follow-up pass if a stricter completeness bar is wanted, but none
of these block the merge decision below.

**No new bugs found during this pass** — everything the final review fixed
held up on real hardware, and nothing else broke. This branch is now ready
for `superpowers:finishing-a-development-branch`.

## ✅ Colourful Reskin, Part A — device-verified, ready to merge (2026-09-18)

A full visual reskin of the onboarding-through-first-pet path (dark shell,
each pet's identity colour as the dominant accent) built from
`design_handoff_colorful_reskin/README.md`, a high-fidelity design handoff
covering six screen areas. Split into two plans by explicit owner choice:
**Part A** (this plan — theme foundation, tab bar/FAB/Add sheet, Pets home,
Pet health hub, Add-Pet wizard) is done; **Part B** (the five record-list
screens + Calendar) is deferred, not yet brainstormed or planned. Full
rationale, resolved open decisions (Tinted cards, system-default fonts, no
`react-native-reanimated`, wizard lands on the new pet's hub) and scope
boundary: `docs/superpowers/specs/2026-09-16-colorful-reskin-design.md`.
Implementation plan: `docs/superpowers/plans/2026-09-16-colorful-reskin-part-a.md`.

Built via `superpowers:subagent-driven-development` in a dedicated worktree
at `C:\dev\colorful-reskin` (branch `colorful-reskin`, from `master`
`f52d47a`) — 9 tasks, 2 of which needed one fix round each (a test-mock
scoping issue, and two self-caught bugs: a missing Expenses tile + a
dropped Edit-pet entry point), then a final whole-branch review (opus)
that found 1 Critical + 5 Important genuine regressions — all traced to
mistakes in this plan's own authored code snippets, not implementer error
— fixed in one wave and independently re-verified clean. Full detail:
`CLAUDE.md`'s "Colourful Reskin (Part A)" paragraph under UI/Design system.

**On-device checklist: every item passed**, including two rounds of real
bugs only the phone caught (safe-area padding lost under the new
`headerShown:false` screens, and a due-strip `FlatList` expanding to fill
its column — the same bug class as Plan 6's `PetSelector` fix — both fixed,
commit `8b503a5`), plus a full end-to-end Add-Pet wizard run confirming the
plan's key resolved decision: completing the wizard calls
`navigation.replace('PetHome', {petId})` and lands directly on the new
pet's own hub showing its freshly assigned identity colour, not back on
Home. Custom-field add/remove/free-tier-cap, review-step row-tap-to-jump,
graceful-date precision chips, and hardware-back step-not-exit behavior
were all also exercised and confirmed working.

**Next step:** the plan's SDD workspace
(`.superpowers/sdd/2026-09-16-colorful-reskin-part-a/`) is ready to delete
and `superpowers:finishing-a-development-branch` invoked to merge
`colorful-reskin` into `master`.

## Plan 7 ("Vets directory and household members") — built, not yet merged

Separate, earlier work this session, in its own still-open worktree at
`C:\dev\vets-household` (branch `plan-7-vets-household`) — a new Vets
directory (CRUD) plus household member-limit/removal. Fully built,
reviewed, fixed, and Firestore rules deployed to production
(`pet-tracker-app-63512`). **Not yet merged** — device verification is
mostly done (Home, pet hub, Add sheet, single-device household flows) but
still needs: **second-device testing** (join/remove/recovery-path — blocked
on the owner having a USB cable for a second phone) and finishing the
test-vet Firestore cleanup ("Corner Clinic", "Riverside Vet Clinic
Renamed") that was interrupted mid-session by a phone disconnect. Full
plan: `docs/superpowers/plans/2026-09-15-vets-and-household-members.md`.

## ✅ Bolt-connected purple theme merged and verified on-device (2026-09-15)

After Plan 6 merged, the owner connected this GitHub repo to Bolt
(bolt.new), which pushed three commits directly to `master` outside any
Claude Code session: a purple color-theme rebrand (`src/theme/theme.ts`),
an accessibility contrast fix (new `accentText` token so text on the
orange accent surface isn't hardcoded white), and a `.gitignore` addition
(`.env`). Merged cleanly into the Plan 6 branch with zero conflicts (the
one shared file, `AddSheet.tsx`, had non-overlapping changes). Full detail
in CLAUDE.md's "UI/Design system" section, "Palette (updated 2026-09-15)"
paragraph.

**Rebuilt from `master` and confirmed live on the real device**: purple
header/buttons/accents, orange Calendar-tab icon and "+" button unchanged,
all of Plan 6's layout fixes (no blank gap under the pet selector, "Add a
pet" at the bottom) still holding correctly with the new palette. No code
changes were needed beyond what Bolt already pushed — every screen reads
colors by token name, so the rebrand took effect automatically.

## ✅ Plan 6's on-device checklist passed in full (2026-09-15) — Plan 7 is next

Plan 6 ("Calendar") was built via `superpowers:subagent-driven-development`
in a dedicated worktree at `C:\dev\calendar` (branch `plan-6-calendar`),
11 tasks plus a final whole-branch review (opus, "Ready to merge: With
fixes" — 0 Critical, 4 Important) and one fix wave (re-reviewed clean).
Merged into `master` after the full on-device checklist passed. Full
build detail: CLAUDE.md's "Plan 6 device verification completed" note and
its "Calendar (Plan 6)" architecture paragraph.

**On-device checklist: every item passed**, most driven directly via `adb`
(uiautomator layout dumps + simulated taps) rather than relying on the
owner's eyes for each one — density (View full day gives a day its own
full screen), pet-filter toggling, empty Week/Month/Overdue states,
Skip/Done on real entries, "Add to Calendar" reaching the wizard from a
different tab, Week/Month/Today navigation across a year boundary
(Sept → Jan and back, confirmed correct leading/trailing dimmed days),
and — once the owner added a second pet (Macmac, a cat) specifically to
unblock this check — a real "Joint vet trip" event confirmed showing
under "All Pets" with two distinct coloured dots, and still present when
filtered to either pet individually.

**Eight real bugs found and fixed along the way** (all committed and
pushed before merge — see CLAUDE.md's "Plan 6 device verification
completed" note for full detail, this is the short version):

1. Week/Month grids and `entriesForDay` used fixed-millisecond day-offset
   math that desyncs across a DST transition — fixed with a new
   `addDays()` pure helper, calendar-field arithmetic instead, covered by
   a regression test pinned to a real transition date.
2. `EditEventScreen` re-synced its form from every Firestore snapshot, not
   just the first, silently discarding whatever the user had typed if any
   snapshot arrived while the form was open — fixed with a seed-once ref
   guard.
3. No way to navigate Week/Month to a different week/month — added
   `‹ / Today / ›` controls, verified correct across a year boundary.
4. `EntryCard` dropped the pet's name, showing only a colour dot —
   regressed Plan 5's display and the design spec's own annotation; fixed
   by rendering the name back in.
5. `PetSelector`'s horizontal `ScrollView` silently expanded to fill its
   flex column (a React Native default) — the real cause of a blank gap
   the owner spotted on both the Pets and Calendar tabs, found via a live
   `uiautomator` dump after a first, wrong theory (about the FlatLists
   below it) was tried and disproven the same way.
6. Month view's entries list rendered but was squeezed to zero visible
   height by the 6-row grid — confirmed via an on-device screenshot after
   selecting a day with a real entry; fixed with a "View full day" hint
   in Month mode instead of an inline list that has no room to render.
7. `AddPetScreen`'s hardware/gesture back button exited the whole wizard
   instead of stepping it backward like its own in-app Back button —
   fixed with a `BackHandler` listener, verified end-to-end on-device via
   `adb` (step 3 → 2 → 1 → exits, exactly as intended).
8. Reminder cards' three buttons (Done/Skip/Snooze) wrapped to two lines
   in the narrow layout — the owner asked to drop Snooze from the UI
   entirely rather than just fix the wrapping; the underlying snooze
   storage/filtering is untouched and easily re-wired later if wanted.
   The equivalent event-card crowding was fixed by moving completion to a
   small checkbox, leaving just Skip/Edit — closer to the original design
   spec anyway.

**Next:** start Plan 7 ("Vets directory and household members", Phase 5 of
the execution pack) — see "If resuming with an SDD-style process again"
near the bottom of this file for the standing process, and CLAUDE.md's
"Calendar (Plan 6)" paragraph for what already exists to build around
(the `usePetSelection()`/`<PetSelector>` primitive, the household-level
collection pattern `events` established, etc.).

## What this is

Pet Health Tracker (React Native/Expo + Firebase), beating 11pets on price/
reliability/simplicity, built for/with a non-technical solo owner on a
Windows PC.

- Original design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Plans 1 ("Foundation & Auth"), 2 ("Pet Records Core"), 3 ("App shell and
  home screen"), 4 ("Pet profile depth"), 5 ("Reminders and notifications"),
  and 6 ("Calendar") — **all complete, device-verified, merged, on
  `master`.**
- The owner's roadmap for Plans 3-9 lives in two docs at
  `docs/superpowers/specs/2026-09-13-build-plan.md` (analysis/reasoning)
  and `docs/superpowers/specs/2026-09-13-execution-pack.md` (locked
  decisions + per-phase planning/build prompts) — **treat these as the
  center/authoritative documents for all future plan work**, not just
  background reading. If only one, read the execution pack. Plan numbering
  follows the execution pack's Phase→Plan mapping: Phase 1 = Plan 3 (done),
  Phase 2 = Plan 4 (done), Phase 3 = Plan 5 (done), Phase 4 = Plan 6
  "Calendar" (done), Phase 5 = Plan 7 "Vets directory and household
  members" (**next**), Phase 6 = Plan 8 "Medical records, documents,
  passport", Phase 7 = Plan 9 "Subscriptions and release."

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

## Plan 6 — complete, merged to `master`, device-verified

Built via `superpowers:subagent-driven-development` in a dedicated
worktree (`C:\dev\calendar`, branch `plan-6-calendar`), 11 tasks (9
originally planned + Task 11 "DayDetailScreen" added mid-plan after
on-device testing surfaced the need for it), each with its own
task-scoped review, plus a final whole-branch review (opus, "Ready to
merge: With fixes" — 4 Important findings, 0 Critical) and one fix wave
(re-reviewed clean). Full detail, including the plan's own self-review
catching a real bug (a snooze-key mismatch) before the plan was even
committed: `docs/superpowers/plans/2026-09-15-calendar.md`. See
CLAUDE.md's "Calendar (Plan 6)" paragraph for the permanent architecture
reference, and this file's top section for the device-verification
summary and the eight bugs it found and fixed.

**What it built:** a real week/month calendar in the Calendar tab —
`calendarEntries.ts` (a second pure module, matching Plan 5's
`computeUpcoming.ts` discipline) merges reminders with a new hand-entered
`events` collection; hand-rolled `WeekView`/`MonthView` grids (no new
dependency); `EntryCard` as the one shared row component; a 3-step add
wizard and a flat edit screen for events; `DayDetailScreen` as a
full-day agenda reachable via "View full day"; Week/Month/Overdue filter
pills with `‹ / Today / ›` navigation.

**One thing parked, not fixed:** none blocking — see CLAUDE.md's Known
gaps for the full list of Minor items (event-collection pagination,
Done/Skip error surfacing, an `AddEventScreen` empty-household edge case,
etc.), all deliberately deferred as genuine future work, not defects.

## Plan 5 — complete, merged to `master`, device-verified

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
worktrees at a short path from the start — `C:\dev\<plan-name>`,
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
10. **RESOLVED (2026-09-15): Plan 5's device verification ran and passed
    in full — see the top of this file.**
11. Plan 6's logged-not-fixed Minors: no query limit/pagination on the
    `events` collection; `events`' rules `allow delete` has no test
    coverage (matches pre-existing `vetVisits`); Done/Skip/toggle-complete
    on the Calendar screens have no error surface (extends Plan 5's same
    gap to event writes); `AddEventScreen` dead-ends with a disabled
    "Next" for a zero-pet household; `EditEventScreen` still shows
    "Loading…" forever if the household's event list is genuinely empty
    on first snapshot; `EntryCard`'s pet-names row needs
    `accessible={true}` for its `accessibilityLabel` to work as intended;
    `DayDetailScreen` adds a 4th screen's worth of listeners to the
    already-logged fan-out gap (item 9 above).
12. **RESOLVED (2026-09-15): Plan 6's device verification ran and passed
    in full — see the top of this file.**

## If resuming with an SDD-style process again (e.g. for Plan 7)

Plan 7 ("Vets directory and household members") can now start — Plan 6's
device checklist (top of this file) has passed in full. Same pattern as
Plans 1-6: dedicated worktree per plan at `C:\dev\<name>` (not
`.claude/worktrees/<name>`), executed via
`superpowers:subagent-driven-development`, merged via
`superpowers:finishing-a-development-branch` once complete and **actually
seen working on the phone** — reviewed is not verified, per this
project's own repeated lesson (the join-household rules bug, the data-
loss incident, and every plan's final review so far catching real
user-visible bugs that no single task review had caught) all survived
confident claims until someone actually ran the thing or looked at the
whole branch at once. Plan 6's own device-verification session added the
most dramatic instance of this lesson yet: eight real bugs found via
on-device testing (several self-driven via `adb` uiautomator dumps, not
just asked of the owner) — code review and the full automated suite had
already passed clean on all of them.

**Read `CLAUDE.md`'s "Calendar (Plan 6)" paragraph before starting Plan
7** — reuse the shared `usePetSelection()`/`<PetSelector>` primitive
again, per the execution pack's explicit requirement, and follow the
household-level-collection-with-a-`petIds`/similar-array pattern
`events` established if vets need to reference multiple pets the same
way. Also worth reading: the `addDays()` pure helper in
`calendarEntries.ts` is the only DST-safe way to do day-boundary
arithmetic in this codebase now — reuse it rather than reintroducing
`+ n * DAY_MS` math anywhere new.
