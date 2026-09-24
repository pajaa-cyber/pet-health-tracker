# Sitter redemption device verification — 2026-09-24

Archived from `NEXTSTEPS.md`. Resuming Plan 9 sub-project A's on-device
checklist, paused mid-test per `docs/history/plan-log.md`'s prior entry: the
owner's own real household and a real sitter invite code (`94T7TDUP`) had been
confirmed working from the *household* side, but redemption from the
*sitter's* side had never actually been exercised against deployed rules.

## What this session found

Redeeming the code as a throwaway sitter account surfaced **three separate,
previously undetected bugs**, each masking the next — fixing one just
revealed the next failure underneath. None of these were caught by the
`firestore.rules.test.ts` emulator suite; all three passed there both before
and after the fixes existed, because the emulator's rule evaluator is more
permissive than the real backend for exactly the constructs these bugs hinge
on.

### 1. Stale deployed rules (not a logic bug at all)

The very first redemption attempt failed with a bare `permission-denied` on
the `sitterAccess` document write, despite the write's data matching the
rule's requirements exactly (confirmed by temporarily logging the redeem
payload and replaying the identical values in an emulator test — it passed).
Diffing this branch's `firestore.rules` against `master`'s showed `master`
has *zero* trace of the sitter-access feature. Since a rules deploy is a
full-file replace, something had at some point deployed rules from `master`
(or an equivalent stale copy) *after* this branch's rules were last live,
silently wiping the entire sitter-access block from production. Confirmed via
the Firebase API directly: `firebase deploy --only firestore:rules` reported
"already up to date, skipping upload" but still needed to flip the *active
release* pointer — the correct ruleset content already existed, it just
wasn't released. Fixed by redeploying from this worktree (`8607e5e`'s parent
state, before the two rule-logic fixes below).

**Lesson:** `firebase deploy --only firestore:rules` must always be run from
the branch/worktree whose `firestore.rules` you intend to be live — running
it from the wrong directory doesn't just fail to help, it actively regresses
whatever branch's rules were live before.

### 2. Collection-group queries need a dedicated recursive match block

With the stale-deploy problem fixed, the redeem *write* started succeeding,
but the sitter's own `subscribeToMySitterGrants` listener — a
`collectionGroup(db, 'sitterAccess').where('sitterUid', '==', uid)` query —
kept failing with `permission-denied`, for every account, before and after
the fix, 100% reproducibly. Since `RootNavigator` only routes a signed-in,
household-less user to `SitterViewScreen` once this listener reports an
active grant, this meant **a sitter's redemption could succeed in Firestore
while the app permanently failed to detect it** — the user would be stuck on
"Set up your household" forever with a real, valid grant sitting unused in
the database.

Two fix attempts were needed:

- **First attempt (wrong):** the existing rule was one `allow list` line
  combining `isHouseholdMember(householdId) || (resource.data.sitterUid ==
  request.auth.uid)`. Theory: Firestore's list-query provability check
  couldn't verify the whole OR'd expression for a collectionGroup query
  (since `isHouseholdMember` needs a `get()` on a `householdId` that varies
  per matched document, unconstrained by the query). Split into two separate
  `allow list` statements on the theory that Firestore evaluates each
  independently. Deployed, retested: **still denied.** Theory disproven.
- **Second attempt (correct):** collection-group queries are **only ever
  authorized by a recursive wildcard match block**
  (`match /{path=**}/sitterAccess/{sitterUid}`), never by a nested match
  block (`match /households/{householdId}/sitterAccess/{sitterUid}`) no
  matter what that nested block's `allow list` says. This is a structural
  Firestore requirement, not a boolean-logic one. Added the dedicated block
  with just the `sitterUid`-equality condition (no `get()`); reverted the
  nested block's `allow list` to a plain `isHouseholdMember(householdId)`
  for `subscribeToSitterGrants`' plain (non-collectionGroup) query, which
  had been working correctly the whole time and was never the problem.

Even with the correct rule shape deployed, the query then failed a third way
with `failed-precondition` / "query requires an index" — a
`COLLECTION_GROUP`-scoped single-field index for `sitterAccess.sitterUid`
didn't exist. Firestore's automatic single-field indexes default to
per-collection scope only; collection-group scope must be requested
explicitly. Added via `firestore.indexes.json`'s `fieldOverrides` (new file —
`firebase.json` previously had no `indexes` key at all) and deployed with
`firebase deploy --only firestore:indexes`. The build took a few minutes
even for a two-document collection; polled by repeatedly relaunching the app
until the listener stopped erroring.

### 3. Sitter's pet list fetched the whole household, filtered client-side

With the listener finally working, `RootNavigator` correctly routed to
`SitterViewScreen` — which then showed "No active sitter access right now"
despite an active, correctly-loaded grant. `SitterViewScreen` was calling
`subscribeToPets(db, householdId, ...)` (the every pet in the household") and
filtering to `grant.petIds` client-side afterward. This is exactly the same
class of bug as #2: the rule (`isValidSitterForPet`) is only true for the
sitter's own granted pets, not every document the *unfiltered* query could
return, so Firestore refused the whole list rather than silently returning a
subset. Fixed with a new `subscribeToSitterPets(db, householdId, petIds,
callback)` in `petService.ts` that whose query itself is constrained via
`where(documentId(), 'in', petIds)` — provable the same way the
collection-group query became provable once its own `where` clause matched
the rule's condition directly.

## Current status

Confirmed working end-to-end on the real device, real production Firestore,
real invite code: sign up a throwaway account → redeem `94T7TDUP` → land on
`SitterViewScreen` → see exactly the granted pet ("Dona"), zero errors. All
three fixes are committed to `sitter-access-and-trial`
(`88de570`, `5bfbe4f`, `efc6336`; `8607e5e` is the disproven-theory commit,
kept rather than rewritten since it was already pushed) and deployed to
`pet-tracker-app-63512`.

**Not yet done:** the plan's checklist also calls for confirming revoke and
expiry actually cut off a sitter's access — not yet tested this session.
Task 9 Step 4's remaining docs (this file, a `plan-log.md` line, a
`CLAUDE.md` architecture paragraph) should be finished once that's done, not
before, per this project's own rule about writing durable docs once, when a
plan is actually complete.

## Housekeeping this session left behind

- A phantom empty household ("Sittertest.pethealthtracker", 0 pets) was
  accidentally created by a misdirected tap during testing (a Metro Fast
  Refresh silently reset a screen's local tab state between actions).
  Harmless — tied to a disposable throwaway account — but real Firestore
  data. Safe to delete by hand whenever convenient, same as this project's
  other stray test-data housekeeping items.
- A second throwaway sitter account (`sittertest2.pethealthtracker@gmail.com`)
  now holds a real, active sitter grant against the owner's real household,
  expiring 2026-09-30 same as the invite code. Also harmless (expires on its
  own), also real data.
- The owner's device was signed out (`pm clear`) multiple times during this
  session to switch test accounts, same pre-existing gap as Plan 9 sub-project
  A's first pass (`docs/history/plan-log.md`): there is still no in-app
  sign-out UI. The owner needs to sign back into `mpajevic7@gmail.com`.
