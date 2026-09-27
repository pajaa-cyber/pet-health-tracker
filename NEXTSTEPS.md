# Where we left off (2026-09-27)

Resume state only. Permanent rules live in `CLAUDE.md`; per-plan build and
verification history lives in `docs/history/` (`plan-log.md` is the index).

**Verify this against `git log` / `git branch -a` / `git status` before trusting
it** — this file is written by a session that may not have finished cleanly.

## In flight

**Plan 9, sub-project C (release prep) — started 2026-09-27, in progress.**
Plan 9 ("Subscriptions and release") is split into three sub-projects: **A**
= sitter access + trial wiring (done, merged — see below), **B** = real Play
Billing (blocked, not started — needs the owner's Play Console/merchant
setup, their own call), **C** = release prep — icon/store listing/privacy
policy (this one).

**Done so far on C:**
- **App icon replaced** — new purple-gradient dog/cat/heart artwork (owner-
  supplied) now wired through `app.json` for iOS icon, Android adaptive icon,
  and web favicon. Android's adaptive icon dropped the old separate
  background/monochrome layers in favor of a plain `backgroundColor`
  (`#7C3AED`) behind the foreground, since the new artwork bakes its own
  background in. Required a full `expo prebuild` to regenerate `android/`'s
  native mipmap resources (that diff looks huge in `git status` but is 34
  files of which only ~5 lines are real content — the rest is this checkout's
  autocrlf normalizing the prebuild tool's LF output back to CRLF, confirmed
  with `git diff -w`). Rebuilt, installed, and confirmed live on the home
  screen and app switcher on-device.
- **Store listing text drafted** — `docs/release/store-listing.md` (name,
  short/full description, category). Not yet submitted anywhere.
- **Privacy policy drafted and published live** —
  `docs/release/privacy-policy.md` is the source of truth,
  `docs/release/privacy-policy.html` is what's actually published at
  **https://claude.ai/artifact/RFYB2Zv9WJUvMuZn9XLCKw** (Play Store requires
  a public URL, not a repo file). Accurately describes what the app actually
  collects: email via Firebase Auth, pet/household/sitter data via Firestore,
  no ads, no analytics/crash-reporting SDK, no Cloud Storage. If the policy
  text ever changes, edit both the `.md` and `.html` and republish the same
  artifact file path to keep the URL stable.

**Not yet done on C:** app screenshots for the store listing, and actually
submitting anything — both blocked on the same Play Console/merchant account
gap as sub-project B.

**Also done 2026-09-26/27, not tied to any specific plan — small UI polish
pass, all committed to `master` directly:**
- `PetHomeScreen`: the 8-swatch identity-colour row replaced with one circle
  beside the avatar that opens a picker popup on tap; section tiles
  (Vaccines/Medications/etc.) shrunk ~15% and switched from icon-above-text
  to icon-left-text-right.
- `ScreenContainer` now pads scrollable content by `insets.bottom`, fixing
  on-screen nav bars (Honor and similar Android skins) overlapping the last
  bit of content on every scroll screen.
- `WeightTrendChart` labels now show day+month per entry instead of month
  only (five entries in the same month used to all read "Sep").
- `VaccineListScreen` gained a delete button per row (trash icon, confirm
  dialog, actually deletes from Firestore — rules already allowed it, no UI
  had ever called it).
- **Household weight-unit preference (kg/lb) + weighing method + per-entry
  delete**, device-verified same day: a one-time `WeightUnitSetupScreen`
  gate, a "Just pet"/"Owner + pet" (subtract) entry toggle on
  `WeightLogScreen`, unit-aware display everywhere a weight shows, and a
  delete button on `WeightTrendChart`'s selected bar. Full detail in
  `CLAUDE.md`'s Pet records section.
- **New `SettingsScreen`**, reachable via `HomeScreen`'s header avatar
  (previously decorative) — Sign out (confirmed) and a Reminder settings
  link. Closes open gap #18 below.

## Done and merged

Plans 1–9 sub-project A are complete, device-verified and on `master`, along
with the Bolt-pushed purple theme, and both halves of the Colourful Reskin
(Part A, Part B). See `docs/history/plan-log.md`. Plan 9 sub-project A
(sitter access + trial wiring) merged 2026-09-27 after on-device verification
found and fixed three real bugs across two sessions (2026-09-24, resumed
2026-09-26) that neither code review nor the emulator test suite caught —
stale deployed rules, a `collectionGroup()` query that a nested `match` block
can never authorize no matter how it's written, and an unfiltered pets list
for the sitter view. Full account:
`docs/history/2026-09-24-sitter-redemption-device-verification.md`; the
durable lesson (nested match blocks vs. collectionGroup queries) is in
`CLAUDE.md`'s Architecture invariants. Redemption, revoke, and expiry are all
confirmed working end-to-end against real production Firestore.

All feature worktrees and branches from Plans 6–9A (`sitter-access-and-trial`,
`documents-passport`, `colorful-reskin`, `colorful-reskin-b`,
`vets-household`, `plan-6-calendar`) have been merged, deleted, and pruned —
`master` is the only worktree left. Harmless real test data from sitter
testing is still sitting in the live Firestore project (Firestore console
cleanup, not urgent — see Housekeeping below).

## After that

Plan 9 sub-project C is in flight (see above). Sub-project B (real Google
Play Billing) comes after — still needs the owner's Play Console/merchant
setup to exist first (their own call, not yet started as of 2026-09-27).

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
7. ~~`GuidedEmptyState`'s weight-log "Log weight" CTA is a no-op button~~ —
   fixed 2026-09-27 (`actionLabel`/`onAction` are now optional; the Weight
   screen's empty state omits both since the log form is always visible
   right below it).
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
18. ~~No in-app sign-out UI anywhere~~ — fixed 2026-09-27: `HomeScreen`'s
    header avatar now opens a new `SettingsScreen` with a confirmed
    Sign out button and a Reminder settings link.

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
