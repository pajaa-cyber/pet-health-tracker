# Plan 6 ("Calendar") — device verification, 2026-09-15

Archived from `CLAUDE.md` / `NEXTSTEPS.md`. Architecture reference for the
Calendar stays in CLAUDE.md.

## Outcome

Every checklist item passed on the real phone, most driven directly via `adb`
(uiautomator layout dumps + simulated taps, not just screenshots asked of the
owner). Covered: density ("View full day" gives a day its own full screen),
pet-filter toggling, empty Week/Month/Overdue states, Skip/Done on real entries,
"Add to Calendar" reaching the wizard from a different tab, Week/Month/Today
navigation across a year boundary (Sept → Jan and back, with correct
leading/trailing dimmed days), and — once the owner added a second pet (Macmac,
a cat) specifically to unblock this check — a real "Joint vet trip" event showing
under "All Pets" with two distinct coloured dots, still present when filtered to
either pet individually.

## Eight real issues found, all fixed and pushed before merge

1. **DST-unsafe date math** in the Week/Month grids and `entriesForDay` — day
   boundaries were computed via a fixed `+ n * DAY_MS` offset instead of
   calendar-field arithmetic, desyncing across a DST transition (duplicate date
   numbers, vanishing entry dots, wrong day highlighted). Fixed with a new
   `addDays()` pure helper in `calendarEntries.ts`, covered by a regression test
   pinned to a real DST transition date.
2. **`EditEventScreen` silently discarded in-progress edits** — its live Firestore
   subscription re-synced the form on every snapshot, not just the first, so any
   snapshot arriving while the form was open (another member's write, or simply a
   slow-network double delivery) overwrote what the user had typed. Fixed with a
   ref guard that seeds the form once.
3. **No way to navigate the Week/Month grids** to a different week or month —
   added a `‹ / Today / ›` control row, DST-safe and correctly handling year
   rollover (verified Dec→Jan and Sept→Jan on-device).
4. **`EntryCard` dropped the pet's name**, showing only a colour dot — regressed
   Plan 5's `{petName} — {label}` display and the build plan's own "coloured dot
   next to the pet's name" annotation. Fixed by rendering the name alongside each
   dot.
5. **`PetSelector`'s horizontal `ScrollView` silently expanded to fill its flex
   column** (React Native's default `flexGrow: 1` for an unstyled `ScrollView`) —
   the root cause of a large blank gap the owner spotted on both the Pets and
   Calendar tabs, confirmed via a live `uiautomator` dump. Not guesswork: a first,
   wrong theory about the FlatLists below it was tried and disproven the same way.
   Fixed with `style={{ flexGrow: 0 }}` at the source, since `PetSelector` is a
   shared `components/ui` primitive used by every screen with a pet filter.
6. **Month view's entries list rendered but was squeezed to zero visible height** —
   the 6-row grid plus the screen's other controls left no room, confirmed via an
   on-device screenshot after selecting a day with a real entry. Fixed by
   replacing the inline list with a hint pointing at "View full day" in Month mode
   only; Week mode has room to spare and keeps its inline list.
7. **`AddPetScreen`'s hardware/gesture back button exited the whole wizard**,
   discarding every answered step, instead of using the wizard's own working
   in-app Back button — a React Navigation default (hardware back pops the
   screen). Fixed with a `BackHandler` listener that steps the wizard backward
   while not on step 0; verified end-to-end via `adb` (step 3 → 2 → 1 → exits).
8. **Reminder cards' three action buttons (Done/Skip/Snooze) wrapped to two lines**
   in the narrow `flex: 1` layout. The owner asked to drop Snooze from the UI
   entirely (2 buttons: Done/Skip). The underlying snooze storage and filtering
   (`snoozeStore.ts`, `reminderActions.snooze`, `isSnoozed`) was deliberately left
   intact — only the button and its wiring were removed, so this is easily
   reversible. The analogous event-card crowding (a third "Mark done" button) was
   fixed by moving completion to a small checkbox next to the title, leaving just
   Skip/Edit — which also brought the card closer to the design spec's literal
   "two buttons, Skip and Edit".

## Build record

Built via `superpowers:subagent-driven-development` in a dedicated worktree at
`C:\dev\calendar` (branch `plan-6-calendar`), 11 tasks (9 planned + Task 11
"DayDetailScreen", added mid-plan after on-device testing surfaced the need),
each with its own task-scoped review, plus a final whole-branch review (opus,
"Ready to merge: With fixes" — 4 Important, 0 Critical) and one fix wave,
re-reviewed clean. The plan's own self-review caught a real bug (a snooze-key
mismatch) before the plan was even committed. Plan doc:
`docs/superpowers/plans/2026-09-15-calendar.md`.

**What it built:** `calendarEntries.ts` (a second pure module, matching Plan 5's
`computeUpcoming.ts` discipline) merging reminders with a new hand-entered
`events` collection; hand-rolled `WeekView`/`MonthView` grids (no new dependency);
`EntryCard` as the one shared row component; a 3-step add wizard and a flat edit
screen for events; `DayDetailScreen` as a full-day agenda; Week/Month/Overdue
filter pills with `‹ / Today / ›` navigation.
