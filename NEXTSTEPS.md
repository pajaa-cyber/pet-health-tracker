# Where we left off (2026-09-24)

Resume state only. Permanent rules live in `CLAUDE.md`; per-plan build and
verification history lives in `docs/history/` (`plan-log.md` is the index).

**Verify this against `git log` / `git branch -a` / `git status` before trusting
it** — this file is written by a session that may not have finished cleanly.

## In flight

**Plan 9, sub-project A ("sitter access + trial/limits wiring") — all 9 tasks'
code is done, tested, committed, and pushed. On-device verification is
partway through and paused mid-checklist.** Plan 9 ("Subscriptions and
release") was brainstormed and split into three sub-projects since real
Google Play Billing can't be tested until the owner's Play Console/merchant
setup exists (owner's own call, 2026-09-23): **A** = sitter access + trial
wiring (this one), **B** = real Play Billing (later), **C** = release prep —
icon/store listing/privacy policy (later, close to publish).

- Design spec: `docs/superpowers/specs/2026-09-23-sitter-access-and-trial-design.md`
- Implementation plan (9 tasks): `docs/superpowers/plans/2026-09-23-sitter-access-and-trial.md`
- Worktree: `C:\dev\sitter-access-and-trial`, branch `sitter-access-and-trial`,
  off `master` at `a58a875`, fully pushed through commit `8ac18cb`.

**What it built:** two new optional `Household` fields (`trialStartedAt`/
`trialEndsAt`), a `HouseholdContext` effect that auto-starts a 14-day trial
the first time any household (new or pre-existing) is seen with neither set;
`limits.ts`'s `canAddCustomField`/`canAddHouseholdMember`/`canAddDocumentPage`
all gained a `household` parameter and return unlimited while
`isSubscriptionActive(household)`; new `canGeneratePassport`/`canShareDocument`
gates on Plan 8's previously-ungated passport/sharing; a full sitter-access
stack — `sitterAccess`/`sitterInviteCodes` Firestore collections (keyed by the
sitter's own uid so rules can enforce expiry with a single `get()`), an
"Invite a Sitter" screen, a sitters list + revoke on the Household screen, a
third "I'm a sitter" mode on household setup to redeem a code, and a
dedicated read-only `SitterViewScreen` for a signed-in user with no household
of their own. Rules are deployed live (twice — see below).

**Two real bugs found during Task 9's on-device pass, both fixed and
re-verified before deploy:**
1. Firestore rules cannot compare a plain `int` (`expiresAt`, stored as epoch
   millis) directly against `request.time` (a `timestamp` type) — every
   sitter-validity check would have errored (denied) forever once deployed.
   Fixed with `.toMillis()`.
2. `HouseholdScreen`'s sitters list failed on-device with permission-denied —
   the rule only granted `list` to a sitter querying their own uid
   (`subscribeToMySitterGrants`), never to a household member listing their
   own household's `sitterAccess` collection (`subscribeToSitterGrants`).
   `allow get` never implies `allow list`. Fixed and redeployed.

**On-device checklist so far:** the owner's real, pre-existing household
correctly got "Free trial — 14 days left" on first load after this build
(confirms the auto-start effect works retroactively, not just for new
households). Generated a real sitter invite code (`94T7TDUP`, Macmac +
Dona, expires 9/30/2026) from the owner's own account — confirmed working
end-to-end against deployed rules.

**Not yet done — redemption was mid-test when the session paused:** testing
the *other* side (sign up as a throwaway sitter account, redeem the code,
confirm `SitterViewScreen` shows only the granted pet, confirm revoke and
expiry both actually cut off access) requires a second account on the test
device. There is **no in-app sign-out UI** (a real, pre-existing gap —
`AuthContext.tsx` has a working `signOut()` but nothing in the UI calls it),
so testing this ran `adb shell pm clear com.pethealthtracker.app` to force a
sign-out on the owner's own test device. **The owner needs to sign back into
`mpajevic7@gmail.com` on that device** — `pm clear` also wiped local-only
state (reminder settings/snoozes are per-device `AsyncStorage`, per
`CLAUDE.md`), which just needs reconfiguring, not data recovery. Resume by
building from the `sitter-access-and-trial` worktree, signing up a throwaway
sitter account, redeeming `94T7TDUP`, and working through the rest of Task
9 Step 3's checklist in the plan.

**Remaining before merge:** finish the on-device checklist (redemption,
revoke, expiry), then Task 9 Step 4's docs (a `docs/history/` entry, a
`plan-log.md` line, a CLAUDE.md architecture paragraph covering the
`sitterAccess`/rules approach and the trial fields), then the merge itself —
both need the owner's say-so same as every prior plan.

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
- One unredeemed sitter invite code from Plan 9 sub-project A's device pass:
  **`94T7TDUP`** (`sitterInviteCodes/94T7TDUP`), grants Macmac + Dona,
  expires 9/30/2026. Harmless if left alone (expires on its own; redeeming it
  doesn't touch the household's real membership at all), but delete the
  Firestore doc by hand if you'd rather not leave a live test code around.
