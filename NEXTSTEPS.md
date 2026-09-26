# Where we left off (2026-09-24)

Resume state only. Permanent rules live in `CLAUDE.md`; per-plan build and
verification history lives in `docs/history/` (`plan-log.md` is the index).

**Verify this against `git log` / `git branch -a` / `git status` before trusting
it** — this file is written by a session that may not have finished cleanly.

## In flight

**Plan 9, sub-project A ("sitter access + trial/limits wiring") — code done,
on-device checklist fully done, docs done. Ready to merge, pending the
owner's say-so.** Plan 9 ("Subscriptions and release") was brainstormed and
split into three sub-projects since real Google Play Billing can't be tested
until the owner's Play Console/merchant setup exists (owner's own call,
2026-09-23): **A** = sitter access + trial wiring (this one, done), **B** =
real Play Billing (later), **C** = release prep — icon/store listing/privacy
policy (later, close to publish).

- Design spec: `docs/superpowers/specs/2026-09-23-sitter-access-and-trial-design.md`
- Implementation plan (9 tasks): `docs/superpowers/plans/2026-09-23-sitter-access-and-trial.md`
- Full build + two-day device-verification account:
  `docs/history/2026-09-24-sitter-redemption-device-verification.md`
  (written in the `sitter-access-and-trial` worktree, not yet merged).
- Worktree: `C:\dev\sitter-access-and-trial`, branch `sitter-access-and-trial`,
  off `master` at `a58a875`, fully pushed through commit `80a1f4c`.

**What it built:** two new optional `Household` fields (`trialStartedAt`/
`trialEndsAt`), a `HouseholdContext` effect that auto-starts a 14-day trial
the first time any household (new or pre-existing) is seen with neither set;
`limits.ts`'s per-feature caps all gained a `household` parameter and return
unlimited while `isSubscriptionActive(household)`; a full sitter-access stack
— `sitterAccess`/`sitterInviteCodes` Firestore collections, an "Invite a
Sitter" screen, a sitters list + revoke on the Household screen, a third "I'm
a sitter" mode on household setup, and a dedicated read-only
`SitterViewScreen`. Full architecture detail is now in `CLAUDE.md`.

**On-device verification found and fixed three real bugs across two sessions
(2026-09-24, resumed 2026-09-26 after Metro/adb needed reconnecting) that
neither code review nor the emulator test suite caught** — stale deployed
rules, a `collectionGroup()` query that a nested `match` block can never
authorize no matter how it's written, and an unfiltered pets list for the
sitter view. Full account in the linked history file; the durable lesson
(nested match blocks vs. collectionGroup queries) is now in `CLAUDE.md`'s
Architecture invariants. **Redemption, revoke, and expiry are all confirmed
working end-to-end against real production Firestore** — sign up → redeem a
real invite code → see exactly the granted pet; revoking from the Household
screen immediately cuts off that account's access.

Harmless real test data left behind (Firestore console cleanup, not urgent —
also listed under Housekeeping below): a phantom empty household from a
misdirected tap during testing, and a since-revoked sitter grant tied to
`sittertest2.pethealthtracker@gmail.com`.

**Before merging:** same as every prior plan, both the merge and deleting the
worktree/branch afterward need the owner's explicit say-so.

The `documents-passport` worktree (`C:\dev\documents-passport`) and its
branch still exist — not deleted, since that needs the owner's explicit
say-so same as the merge did. Safe to remove whenever convenient
(`git log documents-passport ^origin/master` is empty — everything on it is
in `master` now).

## Done and merged

Plans 1–8 are complete, device-verified and on `master`, along with the
Bolt-pushed purple theme, and both halves of the Colourful Reskin (Part A,
Part B). See `docs/history/plan-log.md`. Plan 8 (medical records, documents,
passport) is the most recent: multi-page document storage replacing the old
`VetVisit.documentUrls` array, a one-page PDF pet passport, and document
sharing — full record at
`docs/history/2026-09-23-plan-8-medical-records-documents-passport.md`.

## After that

Plan 9 sub-project A is in flight (see above). Sub-project B (real Google
Play Billing) and sub-project C (release prep) come after A merges — B needs
the owner's Play Console/merchant setup to exist first (their own call, not
yet started as of 2026-09-24).

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
7. `GuidedEmptyState`'s weight-log "Log weight" CTA is a **no-op button** — fix
   whenever that component is next touched.
8. **No Android notification channel** is created; notifications land in
   `expo-notifications`' generic fallback channel.
9. **Snooze entries are never pruned** — a re-dated vaccine inherits its old
   snooze under the same reminder id.
10. A **DST edge case in notification-time math** — worst case one calendar day
    early or late, twice a year.
11. `AddEventScreen` **dead-ends** with a disabled "Next" for a zero-pet household
    (wants a `GuidedEmptyState` pointing at Add a Pet).
12. `EditEventScreen` shows **"Loading…" forever** if the household's event list is
    genuinely empty on first snapshot — the "not found" fix only covers the case
    where other events exist but this one doesn't.
13. `EntryCard`'s per-pet-names row sets `accessibilityLabel` without
    `accessible={true}`, so a screen reader may not announce it as one label.
14. `events`' rules `allow delete` has **no test coverage** (matches the
    pre-existing `vetVisits` precedent, not a regression).
15. `HomeScreen`'s **duplicate "Add a pet"** affordance vs. the global "+" sheet —
    harmless, worth a keep/drop call.
16. Minor pre-existing: no positive-value validation beyond what exists;
    `MedicationListScreen`'s dose log has no filter UI.
17. **No loading-state guard on "Join household" / "Create household."** A
    double-tap while the first request is still in flight fires a second,
    redundant request that fails (the user is already a member by then) and
    briefly shows a raw `[firestore/permission-denied]` string, even though
    the first request already succeeded. Same class as #4 above. Found during
    Plan 7's device pass.
18. **No in-app sign-out UI anywhere** — `AuthContext.tsx`'s `signOut()` works
    but nothing in the UI calls it. Found during Plan 9 sub-project A's
    on-device pass, when testing a second (sitter) account required
    `adb shell pm clear` on the test device instead. Worth adding a real
    "Sign out" button next time any settings-ish screen is touched.

## Housekeeping in the live Firestore project

No in-app cleanup path exists for any of these — remove them by hand in the
Firebase console whenever convenient.

- Two stray test pets: **"Zara"** (marked remembered) and **"TestPet12"**.
- Two test vets from Plan 7: **"Corner Clinic"**, **"Riverside Vet Clinic
  Renamed"**.
- One test document from Plan 8's device pass: **"LabResult"** on Dona
  (category "TestDocTask10", one page, a real family photo used as stand-in
  page content — not sensitive, but not a real lab result either).
- One sitter invite code from Plan 9 sub-project A's device pass: **`94T7TDUP`**
  (`sitterInviteCodes/94T7TDUP`), grants Dona, expires 9/30/2026 — testing is
  now done, so this can be deleted any time; leaving it live until then just
  means it's redeemable by anyone who has it.
- One revoked `sitterAccess` grant for `sittertest2.pethealthtracker@gmail.com`
  against the owner's real household — already inert (`revoked: true`,
  confirmed cutting off access on-device 2026-09-26), safe to delete whenever.
- One phantom empty household ("Sittertest.pethealthtracker", 0 pets) created
  by a misdirected tap during testing, and its own orphaned (never-redeemed)
  `sitterAccess` attempt — both harmless, tied to a disposable throwaway
  account.
