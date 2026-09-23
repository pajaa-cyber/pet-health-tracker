# Plan 7 — Vets directory and household members — build and device verification, 2026-09-23

Archived from `CLAUDE.md` / `NEXTSTEPS.md`. The durable architecture (the
`memberCount` denormalization, the `users/{userId}` recovery-path rule, the
`vets` collection shape) stays in CLAUDE.md.

## What it was

Phase 5 of the execution pack: a household-level `vets` directory (CRUD, one
clinic can serve several pets via `petIds`) plus household member-limit
enforcement and a remove-member flow, addressing the pre-existing "no way
back in for a removed member" gap. Built via
`superpowers:subagent-driven-development` in a dedicated worktree at
`C:\dev\vets-household` (branch `plan-7-vets-household`, off `master` at
`e73ddb5`), spec `docs/superpowers/specs/2026-09-13-execution-pack.md`
("Phase 5"), plan `docs/superpowers/plans/2026-09-15-vets-and-household-members.md`.

## Build record

8 implementation tasks, all reviewed clean or fixed and re-reviewed clean.
A final whole-branch review (opus) found 0 Critical, 8 Important issues, all
fixed in one wave and re-verified clean — most notably:

- **`memberCount` couldn't self-correct.** `removeMember` now writes the
  caller-supplied absolute remaining count instead of `increment(-1)`, and
  `HouseholdScreen` calls `reconcileMemberCount` on every load so any member
  opening the tab self-heals the stored value against the true
  `members.length` — a poisoned or drifted count could otherwise have
  permanently blocked future joins.
- **A vet saved with no pets selected vanished under a specific pet
  filter.** `AddVetScreen` now prefills `petIds` with the currently-selected
  pet when one is selected, rather than starting empty.
- **`Vet.petIds` was stored but never displayed.** `VetCard` now shows
  assigned-pet dots/names, matching `EntryCard`'s established pattern (same
  finding class as a Plan 6 review catch).
- ~20 lines of load-bearing Plan-1 rationale comments were accidentally
  deleted from `joinHousehold` during the member-limit rewrite — restored
  verbatim, merged with the new logic.

## Device verification (2026-09-23)

Full pass on two physical phones (`MTN-NX1M` the owner's, `DNY-NX9` for
throwaway test accounts), against the real "Pajevic Household", driven via
`adb`/`uiautomator`.

**Two real, previously undetected bugs found — neither the emulator's
web-SDK rules tests, code review, nor single-device testing could have
caught them:**

1. **RNFB's `increment()` fails the `inviteCodes` memberCount rule's `is
   int` check, server-side, on real hardware** — even though the identical
   rule against the identical `increment()` call passes cleanly under the
   Firestore emulator via the web `firebase` SDK. The two SDKs apparently
   serialize the increment field transform differently over the wire,
   and only RNFB's form trips the rule. Fixed: `joinHousehold` now writes a
   literal caller-computed number instead, matching the style
   `removeMember` already used for an unrelated reason.
2. **RNFB's `writeBatch()` fails with a bare, undiagnostic
   permission-denied as soon as a third write (a `set()`/create) joins two
   `update()`s in one atomic batch** — every pair of those three writes
   succeeds fine on its own or batched two at a time; only the specific
   three-way combination fails. Fixed: the `users/{uid}` pointer write no
   longer batches with the household+inviteCodes update; it runs as a
   separate call. It also had to move to run **before** that batch, not
   after — a second, related finding — because the recovery-path rule
   (`users/{userId}`'s `allow update`) only permits overwriting the pointer
   while the caller is still absent from the target household's
   `memberIds`; writing the household update first re-adds the caller to
   `memberIds` before the pointer write ever runs, permanently failing that
   check for the specific case of rejoining the SAME household a user was
   just removed from.

Both fixes are documented inline in `householdService.ts`; the emulator
rules tests never exercised the real three-way-batch shape, so a throwaway
repro against the emulator (since discarded) was used to isolate the second
finding precisely before fixing it.

**Full checklist, all items passing:**

- Vets: a full-detail vet (doctor, address, phone, hours, speciality,
  24h-emergency flag, 2 pets) and a minimal name-only vet both display
  correctly and filter correctly per-pet and under "All Pets"; tapping the
  address opens the phone's native Maps app; tapping the phone number opens
  the dialer pre-filled (not an actual call); editing a vet persists across
  a full app restart, confirming it wasn't only local state; "Add a Vet" is
  reachable from the global "+" sheet while on a different tab.
- Household: joined successfully from a second phone (with the fix in
  place, confirmed via a full app restart landing directly on the real
  household's data); removing a member shows the confirmation dialog and
  the member list/count update live; a removed member's own device
  correctly falls back to "Set up your household" rather than showing
  stale data; the recovery-path rule lets a removed member rejoin the SAME
  household immediately afterward; filled the household to exactly 4/4
  members and confirmed the friendly "The free plan includes up to 4
  household members. Upgrading lifts the limit." message on a 5th join
  attempt, with no 5th member actually added; the original owner's own
  membership was unaffected throughout all of this.

**One new minor UX gap found, not fixed:** the "Join household" / "Create
household" buttons have no loading-state guard — a double-tap while the
first request is still in flight fires a second, redundant request that
fails (the user is already a member by then) and briefly shows a raw
`[firestore/permission-denied]` string, even though the first request
already succeeded. Same class as the pre-existing "no error surface on
Done/Skip" gap already logged for Plans 5/6. Worth a proper loading
spinner + disabled state whenever this screen is next touched.

No new bugs found beyond the two RNFB findings above.
