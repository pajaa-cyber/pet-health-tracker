# Plan 5 ("Reminders and notifications") — device verification, 2026-09-15

Archived from `CLAUDE.md`. Architecture reference for Plan 5 stays in CLAUDE.md.

## Outcome

All 7 checklist items passed on the real phone, building from `C:\dev\pet-app`
(outside the OneDrive-synced checkout). The build succeeded cleanly with no
recurrence of the "Unable to delete directory" failure — evidence pointing at
OneDrive/AV interference specific to the synced path rather than anything
structural.

Checklist covered: permission deny/grant, a real notification actually arriving,
a skipped dose staying visible in history, Done clearing a vaccine/vet-visit
reminder vs. advancing a medication's schedule, snooze hiding a reminder and not
still notifying, and live cross-listener sync.

## Three real issues found, fixed and pushed to `master`

1. **Reminder due dates compared by exact millisecond instead of calendar day**
   (`src/reminders/computeUpcoming.ts`). A date-only field inherits whatever
   time-of-day it was picked at, not midnight, so a "due today" reminder flipped
   to overdue — and stopped being notifiable — within minutes of being set. Fixed
   by comparing day boundaries; covered by two new tests in
   `__tests__/computeUpcoming.test.ts`.

2. **Redundant notification-reschedule cycles could cancel a live, about-to-fire
   alarm** (`src/reminders/ReminderRescheduler.tsx`). Firestore listeners
   re-announce unchanged data on every reconnect — notably on app foreground,
   exactly when someone checks whether a notification fired — and each
   announcement triggered a full cancel-all-and-reschedule cycle. Confirmed via
   `adb shell dumpsys alarm` that a real alarm was cancelled 17 seconds after its
   own target time by one of these cycles and never rescheduled, since its
   recomputed trigger was already in the past. Fixed with a content-based guard
   that skips a cycle whose outcome would be identical to the last one actually
   scheduled.

3. **The live Firestore project's security rules were out of sync with the
   checked-in `firestore.rules`.** `vetVisits` update (used by the Calendar tab's
   Done/Skip on a follow-up reminder) failed with a real permission-denied error
   on-device despite the local rules file correctly allowing it, because the live
   rules had never been redeployed since some earlier point. Fixed by running
   `firebase deploy --only firestore:rules --project pet-tracker-app-63512`.
   → This is why CLAUDE.md carries a standing "redeploy rules by hand" rule.

## Confirmed not a bug

Real notification delivery can lag **~1–2 minutes past its target time**. This is
normal Android battery-optimization batching for the kind of alarm
`expo-notifications` schedules (not an exact alarm), not an app defect. Don't
mistake a short delay for a failure when re-testing.

## Build record

Built via `superpowers:subagent-driven-development`, 14 tasks, each with its own
task-scoped review, plus a final whole-branch review (opus, "Ready to merge: With
fixes" — 4 Important, 0 Critical) and one fix wave, re-reviewed clean. Merged via
local fast-forward after `tsc` clean, 80 unit tests, 35 firestore rules tests
against the real emulator. Plan doc:
`docs/superpowers/plans/2026-09-15-reminders-and-notifications.md`.

### The four Important findings (commit `57625e8`), plus two upgraded Minors

1. Reminder Settings was only reachable via the empty state's action —
   unreachable the moment any reminder existed, which is the entire point of the
   feature. Fixed with a persistent button on the Calendar tab.
2. Snoozed reminders still got scheduled as notifications, contradicting the
   store's own documented contract. Fixed by filtering through `isSnoozed` before
   every `rescheduleNotifications` call.
3. No `Notifications.setNotificationHandler` anywhere, so notifications silently
   didn't display while the app was in the foreground — exactly the scenario the
   device checklist tests. Fixed via a new `notificationSetup.ts`, imported once
   in `App.tsx`.
4. `ReminderRescheduler`'s cancel-all-then-reschedule ran unserialized up to
   `1+3N` times per launch, including once with no pet data loaded (wiping
   prior-session notifications), with no guard against overlapping runs. Fixed
   with a `petsLoaded` gate and a `runToken` ref.
5. (upgraded Minor) `household` object-reference — not `.id` — as a dependency
   churned every per-pet listener on unrelated household-doc updates, in two hooks.
6. (upgraded Minor) A hardcoded `30`-day horizon was duplicated three ways; now
   one exported `REMINDERS_HORIZON_DAYS` constant.

### Parked at the time (real, out of scope for the fix wave)

- A `petsLoaded` flag that never resets if a household goes from present to absent
  (pre-existing; no household-switching feature exists to trigger it).
- `CalendarScreen`'s own separate pets listener still depends on `household`, not
  `household.id` — same churn class as finding #5, on an out-of-scope line.
