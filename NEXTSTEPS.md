# Where we left off (2026-09-23)

Resume state only. Permanent rules live in `CLAUDE.md`; per-plan build and
verification history lives in `docs/history/` (`plan-log.md` is the index).

**Verify this against `git log` / `git branch -a` / `git status` before trusting
it** — this file is written by a session that may not have finished cleanly.

## In flight

**Plan 8 (medical records, documents, passport) is mid-execution**, in its own
worktree: `C:\dev\documents-passport`, branch `documents-passport`, fully
pushed to `origin/documents-passport` through commit `2f2aecd`.

- Design spec: `docs/superpowers/specs/2026-09-23-medical-records-documents-passport-design.md`
- Implementation plan (10 tasks): `docs/superpowers/plans/2026-09-23-medical-records-documents-passport.md`
- Progress ledger (what's done, rulings made, why): `C:\dev\documents-passport\.superpowers\sdd\2026-09-23-medical-records-documents-passport\progress.md` — read this first when resuming, it's the authoritative task-by-task record.

**Done (Tasks 1-6 of 10), all committed and pushed:** data model + Firestore
rules + free-tier photo cap; migration off the old `VetVisit.documentUrls`
field (with a fix round for a real duplicate-creation-on-retry bug);
`DocumentListScreen` + a Documents tile on the pet hub; `AddDocumentScreen`
(multi-page capture); `DocumentViewerScreen` (swipeable pager);
`expo-print`/`expo-sharing` installed + `pdfService.ts` (the shared
HTML-to-PDF-to-share helper both the passport and document-sharing use).

**Not started: Tasks 7-10.** Task 7 (passport generation + document sharing)
has its brief extracted and its brief's sample code pre-verified against real
source (`C:\dev\documents-passport\.superpowers\sdd\...\task-7-brief.md`) but
no code written yet — resume there. Tasks 8 (storage-size accounting), 9
(remove the old `documentUrls` field/screen — gated on Task 10's on-device
confirmation that migration worked), and 10 (on-device checklist +
**owner-gated** `firebase deploy --only firestore:rules`, then merge to
master) haven't been started.

**Process note for whoever resumes this:** partway through this plan's
execution (2026-09-23) the owner asked to stop dispatching subagents
(concern about the harness's lifetime "N agents" UI counter — verified via
`ListAgents`/`TaskStop` that nothing was actually running concurrently, but
asked to stop regardless). Tasks 4-6 were completed by the controller
working inline instead of the `subagent-driven-development` skill's normal
implementer+reviewer dispatch pattern. Continue inline (implement directly,
verify plan snippets against real source files yourself, `tsc`+`jest`,
self-review the diff, commit, push) for Task 7 onward unless the owner says
otherwise.

## Done and merged

Plans 1–7 are complete, device-verified and on `master`, along with the
Bolt-pushed purple theme, and both halves of the Colourful Reskin (Part A,
Part B). See `docs/history/plan-log.md`.

## After that

Phase 6 = Plan 8 ("Medical records, documents, passport"), Phase 7 = Plan 9
("Subscriptions and release").

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

1. **No in-app recovery for a household document that becomes unreadable for
   any reason other than being removed.** Plan 7 added a recovery path
   specifically for a *removed* member (their own `users/{uid}` pointer can be
   overwritten once they're no longer in that household's `memberIds`). Any
   other cause of an unreadable household — the household deleted, corrupted,
   etc. — still leaves `createHousehold`/`joinHousehold` failing permanently,
   since both require the pointer not to already exist.
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
18. **No loading-state guard on "Join household" / "Create household."** A
    double-tap while the first request is still in flight fires a second,
    redundant request that fails (the user is already a member by then) and
    briefly shows a raw `[firestore/permission-denied]` string, even though
    the first request already succeeded. Same class as #4 above. Found during
    Plan 7's device pass.

## Housekeeping in the live Firestore project

No in-app cleanup path exists for any of these — remove them by hand in the
Firebase console whenever convenient.

- Two stray test pets: **"Zara"** (marked remembered) and **"TestPet12"**.
- Two test vets from Plan 7: **"Corner Clinic"**, **"Riverside Vet Clinic
  Renamed"**.
