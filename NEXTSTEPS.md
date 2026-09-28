# Where we left off (2026-09-28)

Resume state only. Permanent rules live in `CLAUDE.md`; per-plan build and
verification history lives in `docs/history/` (`plan-log.md` is the index).

**Verify this against `git log` / `git branch -a` / `git status` before trusting
it** — this file is written by a session that may not have finished cleanly.

## In flight

**Two new record-type features, 2026-09-28, not tied to any plan — owner-directed,
built off reference screenshots from another app, committed straight to
`master`. Both hit the same real constraint and handled it the same way: no
AI/vision service is safe to add (Cloud Functions on the free Spark plan can't
call non-Google APIs, and Blaze needs billing info the owner's personal account
can't supply — the same blocker `CLAUDE.md` already documents for Cloud
Storage), so both do the honest on-device/manual-entry version instead of
faking an AI feature.**

- **Scan Food** (`ScanFoodScreen.tsx`) — on-device OCR only
  (`@react-native-ml-kit/text-recognition`, a new native dependency — required
  a full `expo prebuild` + native rebuild, see below), checks the scanned
  label text against the pet's new **Allergies** profile field
  (`src/pets/foodScan.ts`'s `findAllergenMatches`, plain case-insensitive
  substring match, deliberately over-inclusive). No ingredient/calorie/protein
  breakdown — that needs the AI service this project can't safely add.
- **Blood Tests** (`BloodTestListScreen`/`AddBloodTestScreen`/
  `BloodTestDetailScreen`) — a new per-pet record type, manually entered (no
  auto-extraction from a photo — reference-range comparison on a health value
  is not something to get wrong via unverified OCR). Deliberately layered per
  the owner's own spec so the app never states a medical conclusion:
  mechanical reference-range comparison → static marker glossary (~25 common
  markers, `bloodMarkerGlossary.ts`) → generic templated vet-questions
  (`generateVetQuestions`) → per-marker trend across a pet's full history
  stated as a plain numbers-only direction (`describeTrend`), never a clinical
  read. New Firestore collection
  (`households/{id}/pets/{id}/bloodTests/{id}`) — **rules deployed** with the
  owner's explicit go-ahead after a real on-device permission-denied error
  confirmed it was needed.
- **Found and fixed mid-session:** `expo prebuild` deletes and regenerates
  the entire `android/` directory from scratch on every run — it doesn't
  respect `.gitignore`, it wipes everything untracked there first. This
  destroyed the just-generated release-signing keystore the moment prebuild
  ran again for the OCR module. Both the keystore and its properties file now
  live at the project root instead (see `CLAUDE.md`'s build-environment list,
  item 6, and `android/app/build.gradle`'s signing config comment).
- **Verified end-to-end on device, 2026-09-28 (Dona, a test pet).** Scan Food:
  both paths confirmed — a photo with no allergen text produces the green
  "No known allergens detected" card, and (after temporarily setting Dona's
  Allergies to "Chicken" for the test, then reverting it) a photo containing
  "Chicken" text produces the red "⚠️ Possible allergen match" card naming the
  matched allergen. Blood Tests: added one test (ALT 120 U/L, reference
  10–100) via `AddBloodTestScreen`; `BloodTestListScreen` showed the correct
  red out-of-range summary dot; `BloodTestDetailScreen` showed the right
  summary count, the notable-result card with its glossary description ("An
  enzyme associated with the liver") and status label, and the two
  auto-generated vet questions. Cross-test `markerTrend`/`describeTrend`
  (adding a second test with the same marker to see the trend sentence
  appear) was not reached this session — an adb/device-tool outage interrupted
  testing partway through entering the second test. The trend logic itself is
  unit-tested (`__tests__/bloodTestAnalysis.test.ts`) and code-reviewed; only
  the on-device rendering of the trend sentence in `BloodTestDetailScreen`
  remains unconfirmed. Do that next before considering Blood Tests fully done.

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

**Screenshots are now done too** (3, in `docs/release/screenshots/`: pet
profile hub, weight trend + expenses, calendar month view) — device-captured
2026-09-27. **Not yet done on C:** actually submitting anything, still
blocked on the Play Console/merchant account gap shared with sub-project B.

**Also done 2026-09-26/27/28, not tied to any specific plan — a large,
mostly owner-directed UI polish pass, all committed to `master` directly,
device-verified screen by screen as each landed:**
- `PetHomeScreen`: the 8-swatch identity-colour row replaced with one circle
  beside the avatar that opens a picker popup on tap; section tiles
  (Vaccines/Medications/etc.) shrunk ~15% and switched from icon-above-text
  to icon-left-text-right.
- `ScreenContainer` now pads scrollable content by `insets.bottom`, fixing
  on-screen nav bars (Honor and similar Android skins) overlapping the last
  bit of content on every scroll screen.
- `WeightTrendChart` labels now show day+month per entry instead of month
  only (five entries in the same month used to all read "Sep").
- **Household weight-unit preference (kg/lb) + weighing method + per-entry
  delete** — a one-time `WeightUnitSetupScreen` gate (now changeable later
  from Settings → Preferences), a "Just pet"/"Owner + pet" (subtract) entry
  toggle on `WeightLogScreen`, unit-aware display everywhere a weight shows.
  Full detail in `CLAUDE.md`'s Pet records section.
- **Delete added to every record-list screen** (vaccines, weight logs, vet
  visits, medications, expenses, documents, vets) — trash icon + Alert
  confirm, actually deletes from Firestore. Rules already allowed delete for
  household members on all of them; no UI had ever called it until now.
  `deleteDocument` also cleans up the `pages` subcollection and reconciles
  `documentsStorageBytes`.
- **New `SettingsScreen`**, reachable via `HomeScreen`'s header avatar
  (previously decorative), restructured into grouped sections matching a
  reference app the owner pointed to: My settings (Profile, Preferences,
  Notifications), Household (Pets, Users), Support (Share this app,
  Subscriptions), Log out. Closes open gap #18 below. Uncovered a real
  navigation gotcha, now in `CLAUDE.md`: reaching a nested-tab route from a
  screen mounted as a root-stack sibling of `"Main"` needs one nesting level
  deeper than the same pattern between two screens both already inside
  `MainTabs`.
- **Emergency nearest-vet finder** on `VetsScreen` — opens Google Maps'
  search for "emergency veterinarian" near the device's current location
  (Maps handles the location permission itself). Also fixed the "24h
  emergency" badge clipping off-screen for a long clinic name.
- **Pet identity-colour ring around the pet's photo**, in three places:
  `HomeScreen`'s list-card thumbnail, `PetHomeScreen`'s header avatar, and
  the shared `PetSelector` strip (now shown for every pet, not just the
  selected one). Needed a white separator layer in two of the three spots —
  a ring drawn directly in the pet's own colour is invisible either against
  a background that's already that same colour, or for a muted/dark shade
  (warm gray) with no contrast against the dark card otherwise.

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

Deliberately parked, roughly by weight. **Audited 2026-09-28** — several of
these had already been fixed by earlier work without this list being updated
(struck through below with when/where), and five more were fixed in that same
pass. Verified with `npx tsc --noEmit` (clean) and `npx jest` (157 passed, the
only failures are `firestore.rules.test.ts`'s pre-existing emulator-required
`ECONNREFUSED`s, not a regression).

1. **No in-app recovery for a household document that becomes unreadable for
   any reason other than being removed.** Plan 7 added a recovery path
   specifically for a *removed* member (their own `users/{uid}` pointer can be
   overwritten once they're no longer in that household's `memberIds`). Any
   other cause of an unreadable household — the household deleted, corrupted,
   etc. — still leaves `createHousehold`/`joinHousehold` failing permanently,
   since both require the pointer not to already exist. **Deliberately left
   open 2026-09-28**: fixing it means changing `isJoining()`/the pointer
   invariants CLAUDE.md documents at length as already hard-won through
   on-device failures — needs its own planned pass with device verification,
   not a quick patch alongside other gaps.
2. ~~`generateInviteCode()` uses `Math.random()`, not a CSPRNG~~ — already
   fixed (`householdService.ts`'s `secureRandomIndex`, prefers
   `crypto.getRandomValues` with a `Math.random()` fallback, no native
   dependency needed). Fixed before 2026-09-27; this list just wasn't updated.
3. **Listener fan-out** is duplicated across `HomeScreen` / `CalendarScreen` /
   `ReminderRescheduler` / `DayDetailScreen` — roughly 27 concurrent Firestore
   listeners for 3 pets with the Calendar tab open. Worth hoisting into a shared
   provider (same precedent as `PetSelectionContext`) when it next hurts.
   **Deliberately left open 2026-09-28**: a cross-cutting data-flow refactor
   touching four screens is real regression risk for a "nice to have,"
   without the device time to verify every screen afterward.
4. ~~No error surface on Done / Skip / toggle-complete on the reminders and
   Calendar screens~~ — already fixed: `useCalendarEntryActions.ts` (Colourful
   Reskin Part B) gives `CalendarScreen` and `DayDetailScreen` a shared
   `error` state rendered through `ErrorText`, covering both reminders and
   events. Fixed before 2026-09-27; this list just wasn't updated.
5. ~~No read-only display for any of Plan 4's 15 new profile fields~~ — fixed
   2026-09-28: `PetHomeScreen` had already grown `breed`/`neutered`/
   `livingEnvironment` chips at some point, but a new "About" card now also
   shows birth date and arrival date (via new `formatGracefulDate`/
   `formatArrivalDate` in `dateGrace.ts`, precision-aware — "Roughly", "~1 yr
   2 mo old", "Don't know" vs. "Not set" for a skipped question), sex,
   colour/markings, the four microchip fields (shown only if any are filled
   in), and custom fields (shown only if any exist).
6. **No query limit or pagination on the `events` collection** — fine at MVP
   scale, will matter once a household accumulates years of completed events.
   **Deliberately left open 2026-09-28**: `subscribeToEvents` has no
   `orderBy`, so a blind `limit()` would return an arbitrary N documents, not
   necessarily the ones the current Week/Month/day view needs — could make
   real events silently vanish from view instead of just being slow. A real
   fix needs `orderBy('date')` plus a date-range query per view, which is new
   query-shape work, not a one-line safety net.
7. ~~`GuidedEmptyState`'s weight-log "Log weight" CTA is a no-op button~~ —
   fixed 2026-09-27 (`actionLabel`/`onAction` are now optional; the Weight
   screen's empty state omits both since the log form is always visible
   right below it).
8. ~~No Android notification channel is created~~ — already fixed
   (`notificationSetup.ts` calls `setNotificationChannelAsync` with a named
   `REMINDERS_CHANNEL_ID` channel, Android-only). Fixed before 2026-09-27;
   this list just wasn't updated.
9. ~~Snooze entries are never pruned — a re-dated vaccine inherits its old
   snooze under the same reminder id~~ — fixed 2026-09-28: rather than a
   separate prune pass, `snoozeStore.ts`'s `SnoozeEntry` now records the
   `dueDate` a snooze was set against, and `isSnoozed()` self-invalidates a
   stale entry whose stored `dueDate` no longer matches the reminder's
   current one (id stays `${type}:${sourceId}` across a re-date, so the id
   alone can't tell old from new). All four call sites
   (`ReminderRescheduler`, `ReminderSettingsScreen`, `CalendarScreen`,
   `DayDetailScreen`) updated to pass the reminder's current `dueDate`.
10. ~~A DST edge case in notification-time math — worst case one calendar day
    early or late, twice a year~~ — fixed 2026-09-28:
    `notificationTiming.ts`'s `computeNotificationTime` used to subtract
    `leadDays * DAY_MS` in raw milliseconds before reading the target
    calendar day, the exact `+ n * DAY_MS` pattern CLAUDE.md already bans;
    now uses `calendarEntries.ts`'s DST-safe `addDays()` instead, same as
    every other day-boundary calculation in the app.
11. ~~`AddEventScreen` dead-ends with a disabled "Next" for a zero-pet
    household~~ — already fixed (commit `401a3ec`): step 0 already renders a
    `GuidedEmptyState` pointing at Add a Pet when `pets.length === 0`. Fixed
    before 2026-09-27; this list just wasn't updated.
12. ~~`EditEventScreen` shows "Loading…" forever if the household's event list
    is genuinely empty on first snapshot~~ — already fixed (commit `401a3ec`,
    same fix as #11): any first snapshot with no matching event now surfaces
    "Event not found" immediately, regardless of whether the household has
    other events. Fixed before 2026-09-27; this list just wasn't updated.
13. ~~`EntryCard`'s per-pet-names row sets `accessibilityLabel` without
    `accessible={true}`~~ — already fixed (commit `c194ae7`, the Colourful
    Reskin Part B EntryCard rewrite already added `accessible` alongside the
    label). Fixed 2026-09-21; this list just wasn't updated.
14. ~~`events`' rules `allow delete` has no test coverage~~ — already fixed
    (`firestore.rules.test.ts` covers both the member-succeeds and
    stranger-fails cases). Fixed 2026-09-23; this list just wasn't updated.
15. `HomeScreen`'s **duplicate "Add a pet"** affordance vs. the global "+" sheet —
    harmless, worth a keep/drop call. Left open 2026-09-28 — a UX call for the
    owner, not a defect to unilaterally fix.
16. Minor pre-existing: no positive-value validation beyond what exists;
    `MedicationListScreen`'s dose log has no filter UI.
17. ~~No loading-state guard on "Join household" / "Create household"~~ —
    fixed 2026-09-28: `Button`'s `loading` prop already maps to `disabled`,
    but that only takes effect on the next render, which isn't synchronous
    with the tap handler firing — a fast double-tap could call
    `handleCreate`/`handleJoin`/`handleRedeemSitterCode` a second time before
    that re-render landed. `HouseholdSetupScreen` now also checks a
    `submittingRef` at the top of each handler, closing the race regardless
    of render timing.
18. ~~No in-app sign-out UI anywhere~~ — fixed 2026-09-27: `HomeScreen`'s
    header avatar now opens a new `SettingsScreen` with a confirmed
    Sign out button and a Reminder settings link.

**None of #2, #4, #5, #7, #8, #9, #10, #11, #12, #18 above have been verified
on a real device yet** — all pass `tsc`/`jest`, but per this file's own
standing rule ("Reviewed is not verified"), that's necessary, not sufficient.

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
- **From tonight's (2026-09-28) Scan Food / Blood Tests device verification:**
  one test blood test on Dona ("City Vet Lab", 9/28/2026, ALT 120 U/L,
  reference 10–100) — delete via the Blood Tests screen's own trash icon
  whenever. Two Hygiene entries also got logged on Dona as a side effect of
  a misdirected tap while navigating between screens during testing (list
  showed "2 records" afterward where it should read 0) — harmless, delete
  from the Hygiene screen if it matters. On the physical device itself (not
  the repo): a copy of a Google-search screenshot was saved to
  `Pictures/Screenshots/allergen_test_chicken.png` to use as OCR test input —
  safe to delete from the phone's gallery whenever. Dona's `Allergies` field
  was temporarily set to "Chicken" for the red-path test and was reverted to
  empty before the session ended — confirmed back to "None known" in the UI.
