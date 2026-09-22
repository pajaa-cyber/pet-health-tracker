# Where we left off (2026-09-18)

Resume state only. Permanent rules live in `CLAUDE.md`; per-plan build and
verification history lives in `docs/history/` (`plan-log.md` is the index).

**Verify this against `git log` / `git branch -a` / `git status` before trusting
it** — this file is written by a session that may not have finished cleanly.

## In flight

**1. Colourful Reskin, Part A — device-verified, ready to merge.**
Worktree `C:\dev\colorful-reskin`, branch `colorful-reskin` (from `master`
`f52d47a`). Every on-device checklist item passed; last fixes in commit `8b503a5`.
Next step: delete the plan's SDD workspace
(`.superpowers/sdd/2026-09-16-colorful-reskin-part-a/`) and merge
`colorful-reskin` into `master`.
Detail: `docs/history/2026-09-18-colorful-reskin-part-a.md`.

**2. Plan 7 ("Vets directory and household members") — built, not merged.**
Worktree `C:\dev\vets-household`, branch `plan-7-vets-household`. A new Vets
directory (CRUD) plus household member-limit/removal. Fully built, reviewed,
fixed, and its Firestore rules already deployed to `pet-tracker-app-63512`.
Device verification is mostly done (Home, pet hub, Add sheet, single-device
household flows). Still blocked on:

- **second-device testing** (join / remove / recovery path) — waiting on a USB
  cable for a second phone;
- finishing the test-vet Firestore cleanup ("Corner Clinic", "Riverside Vet Clinic
  Renamed"), interrupted mid-session by a phone disconnect.

Plan doc: `docs/superpowers/plans/2026-09-15-vets-and-household-members.md`.

## Done and merged

Plans 1–6 are complete, device-verified and on `master`, along with the
Bolt-pushed purple theme. See `docs/history/plan-log.md`.

## After that

Phase 6 = Plan 8 ("Medical records, documents, passport"), Phase 7 = Plan 9
("Subscriptions and release"). Also unplanned: **Colourful Reskin Part B** (the
five record-list screens + Calendar) — not yet brainstormed.

Before starting new plan work, read `CLAUDE.md`'s Calendar and pet-selection
sections: reuse `usePetSelection()` / `<PetSelector>`, follow the
household-level-collection-with-a-`petIds`-array pattern that `events`
established, and use `addDays()` for any day-boundary arithmetic.

**Reviewed is not verified.** Every plan so far has had its final whole-branch
review find real user-visible bugs no single task review caught, and Plan 6's
device pass found eight more after code review and the full automated suite had
passed clean. Nothing is done until it has been seen working on the phone.

## Open gaps

Deliberately parked, roughly by weight.

1. **No in-app recovery** if a household document becomes unreadable — both
   `createHousehold` and `joinHousehold` fail permanently once a `users/{uid}`
   pointer exists.
2. **`generateInviteCode()` uses `Math.random()`**, not a CSPRNG. Not currently
   exploitable; a proper fix needs `expo-crypto` plus a prebuild/rebuild cycle.
3. **Listener fan-out** is duplicated across `HomeScreen` / `CalendarScreen` /
   `ReminderRescheduler` / `DayDetailScreen` — roughly 27 concurrent Firestore
   listeners for 3 pets with the Calendar tab open. Worth hoisting into a shared
   provider (same precedent as `PetSelectionContext`) when it next hurts.
4. **No error surface** on Done / Skip / toggle-complete on the reminders and
   Calendar screens, unlike `MedicationListScreen`'s established `ErrorText`
   pattern.
5. **No read-only display** for any of Plan 4's 15 new profile fields anywhere
   except the Add-Pet wizard's Review step.
6. **No query limit or pagination on the `events` collection** — fine at MVP
   scale, will matter once a household accumulates years of completed events.
7. **No client-side warning** as a vet visit's `documentUrls` approaches
   Firestore's 1 MiB/document limit.
8. `GuidedEmptyState`'s weight-log "Log weight" CTA is a **no-op button** — fix
   whenever that component is next touched.
9. **No Android notification channel** is created; notifications land in
   `expo-notifications`' generic fallback channel.
10. **Snooze entries are never pruned** — a re-dated vaccine inherits its old
    snooze under the same reminder id.
11. A **DST edge case in notification-time math** — worst case one calendar day
    early or late, twice a year.
12. `AddEventScreen` **dead-ends** with a disabled "Next" for a zero-pet household
    (wants a `GuidedEmptyState` pointing at Add a Pet).
13. `EditEventScreen` shows **"Loading…" forever** if the household's event list is
    genuinely empty on first snapshot — the "not found" fix only covers the case
    where other events exist but this one doesn't.
14. `EntryCard`'s per-pet-names row sets `accessibilityLabel` without
    `accessible={true}`, so a screen reader may not announce it as one label.
15. `events`' rules `allow delete` has **no test coverage** (matches the
    pre-existing `vetVisits` precedent, not a regression).
16. `HomeScreen`'s **duplicate "Add a pet"** affordance vs. the global "+" sheet —
    harmless, worth a keep/drop call.
17. Minor pre-existing: no positive-value validation beyond what exists;
    `MedicationListScreen`'s dose log has no filter UI.

## Housekeeping in the live Firestore project

No in-app cleanup path exists for any of these — remove them by hand in the
Firebase console whenever convenient.

- Two stray test pets: **"Zara"** (marked remembered) and **"TestPet12"**.
- Two test vets from Plan 7: **"Corner Clinic"**, **"Riverside Vet Clinic
  Renamed"**.
