# Where we left off (2026-09-24)

Resume state only. Permanent rules live in `CLAUDE.md`; per-plan build and
verification history lives in `docs/history/` (`plan-log.md` is the index).

**Verify this against `git log` / `git branch -a` / `git status` before trusting
it** — this file is written by a session that may not have finished cleanly.

## In flight

**Plan 9, sub-project A ("sitter access + trial/limits wiring") — all 9 tasks'
code is done, tested, committed, and pushed. On-device verification found and
fixed three real bugs on 2026-09-24 (see below); redemption end-to-end is now
confirmed working. Revoke and expiry are the only checklist items left.**
Plan 9 ("Subscriptions and release") was brainstormed and split into three
sub-projects since real Google Play Billing can't be tested until the owner's
Play Console/merchant setup exists (owner's own call, 2026-09-23): **A** =
sitter access + trial wiring (this one), **B** = real Play Billing (later),
**C** = release prep — icon/store listing/privacy policy (later, close to
publish).

**2026-09-24 device session — three real bugs found and fixed, full account
in `docs/history/2026-09-24-sitter-redemption-device-verification.md`
(written in the `sitter-access-and-trial` worktree, not yet merged):**

1. **Deployed Firestore rules were stale** — `master`'s `firestore.rules` has
   no trace of the sitter-access feature at all, and something had deployed
   rules from `master` (or an equivalent) after this branch's rules were last
   live, silently wiping the sitter-access block from production. Fixed by
   redeploying from the worktree. **Lesson: always deploy rules from the
   branch whose rules should be live — deploying from the wrong directory
   actively regresses production, it doesn't just fail to help.**
2. **`subscribeToMySitterGrants`'s collectionGroup query was structurally
   unauthorizable** — a nested `match /households/{householdId}/sitterAccess/{sitterUid}`
   block can never authorize a `collectionGroup()` query, no matter what its
   `allow list` says; that needs its own recursive wildcard block
   (`match /{path=**}/sitterAccess/{sitterUid}`). Also needed an explicit
   `COLLECTION_GROUP`-scoped index for `sitterUid` (new
   `firestore.indexes.json`, index builds took a few minutes even for two
   documents). Until this was fixed, a sitter's redemption could silently
   succeed in Firestore while the app could never detect it and route them
   to their view.
3. **`SitterViewScreen` fetched the whole household's pets and filtered
   client-side** — same class of bug as #2 (Firestore refuses to authorize a
   list whose unfiltered potential result set the rule can't prove for every
   document). Fixed with a new `subscribeToSitterPets` that queries
   `where(documentId(), 'in', petIds)` directly.

All three fixes are committed and pushed to `sitter-access-and-trial`
(commits `88de570`, `5bfbe4f`, `efc6336`) and deployed live. Confirmed
end-to-end on-device: sign up a throwaway account → redeem the real invite
code `94T7TDUP` → land on the sitter view → see exactly the granted pet
("Dona"), zero errors.

Two pieces of harmless real test data left behind this session (see that
file's Housekeeping section for detail): a phantom empty household from a
misdirected tap, and a second throwaway sitter account
(`sittertest2.pethealthtracker@gmail.com`) now holding a real active grant
against the owner's real household, expiring 2026-09-30 on its own.

- Design spec: `docs/superpowers/specs/2026-09-23-sitter-access-and-trial-design.md`
- Implementation plan (9 tasks): `docs/superpowers/plans/2026-09-23-sitter-access-and-trial.md`
- Worktree: `C:\dev\sitter-access-and-trial`, branch `sitter-access-and-trial`,
  off `master` at `a58a875`, fully pushed through commit `efc6336`.

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
Dona, expires 9/30/2026) from the owner's own account. Redemption from the
sitter's side is now also confirmed working end-to-end (see the three-bugs
account above and the linked history file) — signed up a throwaway account,
redeemed `94T7TDUP`, landed on `SitterViewScreen`, saw exactly the granted
pet ("Dona"), zero errors.

**Not yet done:** confirming revoke and expiry actually cut off a sitter's
access. There is **no in-app sign-out UI** (a real, pre-existing gap —
`AuthContext.tsx` has a working `signOut()` but nothing in the UI calls it),
so testing this used `adb shell pm clear com.pethealthtracker.app` to force
account switches on the owner's own test device, repeatedly. **The owner
needs to sign back into `mpajevic7@gmail.com` on that device** — `pm clear`
also wipes local-only state (reminder settings/snoozes are per-device
`AsyncStorage`, per `CLAUDE.md`), which just needs reconfiguring, not data
recovery. Resume by building from the `sitter-access-and-trial` worktree
(now at commit `efc6336`), signing back in as the owner, revoking the
existing `sittertest2.pethealthtracker@gmail.com` grant from the Household
screen, then confirming that account's `SitterViewScreen` goes back to "No
active sitter access." Expiry can't be tested by waiting (the code expires
2026-09-30) — either redeem a fresh code with a near-future `expiresAt`, or
inspect the `isValidSitterForPet`/`isValidSitterForAnyPet` rules logic and
the emulator test coverage for it directly instead.

**Remaining before merge:** finish the on-device checklist (revoke,
expiry), then Task 9 Step 4's docs (a `plan-log.md` line, a CLAUDE.md
architecture paragraph covering the `sitterAccess`/rules approach — including
the collection-group-query and list-provability lessons from this session —
and the trial fields), then the merge itself — both need the owner's say-so
same as every prior plan.

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
  (`sitterInviteCodes/94T7TDUP`), grants Dona, expires 9/30/2026 — since
  redeemed twice during 2026-09-24's session (see below), so leaving it live
  lets it be redeemed again by anyone who has it; delete the Firestore doc by
  hand once revoke/expiry testing no longer needs it.
- Two real `sitterAccess` grants against the owner's real household from
  2026-09-24's redemption testing, both expiring 2026-09-30 on their own:
  one for a throwaway account that ended up creating its own phantom
  household instead of staying a sitter (harmless, orphaned), one for
  `sittertest2.pethealthtracker@gmail.com` (this is the grant used to confirm
  the sitter view works — needed for revoke testing next, don't delete until
  that's done).
- One phantom empty household ("Sittertest.pethealthtracker", 0 pets) created
  by a misdirected tap during 2026-09-24's testing — harmless, tied to a
  disposable throwaway account.
