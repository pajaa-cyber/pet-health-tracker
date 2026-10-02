# Where we left off (2026-10-02)

Resume state only. Permanent rules live in `CLAUDE.md`; per-plan build and
verification history lives in `docs/history/` (`plan-log.md` is the index).

**Verify this against `git log` / `git branch -a` / `git status` before trusting
it** — this file is written by a session that may not have finished cleanly.

## In flight

**RESOLVED, device-verified 2026-10-02: 16 screens were rendering
content at roughly 2-3x the intended side margin.** Owner reported live
on the Calendar tab: "looks zoomed out, narrowed by about 1cm on each
side" vs. Pets/Vets/Household — and was right, confirmed by exact
on-device pixel measurement rather than guessing (Calendar's title sat
at x=156 instead of the x=52 baseline used everywhere else). Two
independent causes stacked:

1. **`ScreenContainer`'s `noPadding` prop, new this session** — the
   established way for a screen to manage its own padding,
   `style={{ padding: 0, ... }}`, silently stopped working the moment
   yesterday's insets.left/right fix (`b74c924`) added `paddingLeft`/
   `paddingRight`/`paddingBottom` as separate style keys ahead of the
   caller's own `style`: `padding: 0` and `paddingLeft` are different
   keys, both survived into the final flattened style, and Yoga prefers
   the more specific per-edge property over the generic shorthand
   regardless of array order — so the screen's own padding stacked on
   top of ScreenContainer's un-zeroed padding instead of replacing it.
   Fixed with an explicit `noPadding` boolean that skips
   `styles.content`/`edgeInsets` entirely (no key-collision possible),
   and every screen using the old pattern switched to it: `BloodTestListScreen`,
   `CalendarScreen`, `DayDetailScreen`, `DocumentListScreen`,
   `ExpenseListScreen`, `HygieneScreen`, `MedicationListScreen`,
   `PetHomeScreen`, `PreferencesScreen`, `ProfileScreen`, `ScanFoodScreen`,
   `SettingsScreen`, `SubscriptionsScreen`, `VaccineListScreen`,
   `VetVisitListScreen`, `WeightLogScreen`.
2. **`CalendarScreen` only, pre-existing, independent bug** — its
   `ListHeaderComponent` had its own `paddingHorizontal: spacing.md` on
   top of the FlatList's `contentContainerStyle`, which already applies
   that same padding to the whole scrollable area including the header.
   Removed the header's own copy.

Confirmed via exact bounds measurement at each step: 156px actual →
104px (fix 1 alone) → 52px (both fixes, exactly matching the app-wide
baseline) on Calendar specifically, plus a spot-check on PetHomeScreen's
header (Back/Edit land at the expected symmetric 59px/1142px, no
double-layer). `DayDetailScreen` structures its header as a FlatList
sibling, not a `ListHeaderComponent`, so it never had bug 2's shape —
fix 1 alone was sufficient there.

**RESOLVED, device-verified 2026-10-02 (`a6f6578`): focused fields
scrolled inconsistently — some clipped by the keyboard, some scrolled
clean off the top of the screen.** Owner reported live on EditPetScreen:
Allergies/Colour each slightly clipped by the keyboard on focus, while
Microchip provider/number scrolled themselves entirely off the TOP of
the screen, hidden behind the header. Root cause of the second part: an
earlier fix pass had put `scrollToEnd` on those two fields, which jumps
to the bottom of the WHOLE form regardless of where the focused field
sits — wrong for a field with several more fields still below it.
Removed `scrollToEnd` from every field in this section (the 280px bottom
spacer, not scrollToEnd, is what actually keeps content reachable).

Also replaced the base per-field scroll behavior app-wide: it used
`scrollResponderScrollNativeHandleToKeyboard` (positions relative to the
keyboard, inconsistent depending on where the field already sat — part
of why Allergies/Colour still clipped). Every focused `TextField`
without `scrollToEnd` now scrolls to a fixed, predictable position near
the TOP of the visible area (16px below the header) via `measureLayout`,
regardless of where it sits in the form. This is a shared hook
(`useScrollToInputOnFocus` in `ScrollToInputContext.ts`), so the change
applies to every form screen in the app, not just EditPetScreen — not
separately re-verified on other screens yet, but the mechanism itself is
now confirmed correct on-device across three fields at different form
depths. Hit and fixed one real bug getting there: `measureLayout`'s
`relativeTo` argument must be an actual ref to a native component under
the New Architecture — a derived node handle
(`ScrollView.getScrollableNode()`) was silently rejected with "ref.
measureLayout must be called with a ref to a native component" (seen
live as an on-device warning); passing the ScrollView ref directly
works.

**RESOLVED, device-verified 2026-10-02: Add/Edit Vet forms' lower fields
unreachable under keyboard.** Owner asked Claude to keep working through
the "keyboard covers a long form" risk flagged earlier — found it live
on `AddVetScreen` (Notes field hidden under the keyboard, same shape as
EditPetScreen). Applied the identical `<View style={{ height: 280 }} />`
spacer fix to both `AddVetScreen` and `EditVetScreen` (same field set).
Confirmed on-device: Notes fully visible while typing, rest of the form
(pet checkboxes, Add vet button) reachable via manual scroll with the
keyboard still open. `AddMedicationScreen` checked too (only 4
TextFields + 2 DateFields) — short enough that it's unlikely to share
this risk, left alone without evidence of a real problem. Other
Add/Edit screens (Event, Expense, Vaccine, VetVisit, Document) not yet
checked.

**RESOLVED, device-verified 2026-10-02 (`3836a33`): EditPetScreen's
Microchip/Custom fields section was unreachable under the keyboard.**
Reported live by the owner. First fix attempt (`scrollToEnd` on every
field in the cluster, the pattern already proven on Add a Blood Test /
Prepare for Vet) type-checked clean but did nothing on-device. Added
temporary debug logging to confirm `scrollToEnd()` was firing correctly
with a valid ref every time — the real cause: this form's content,
without a keyboard open, already fills almost exactly one screen with no
slack, so the ScrollView had no extra scrollable range to reveal once
the keyboard covered the tail. Same shape `AddBloodTestScreen.tsx`/
`PrepareForVetScreen.tsx` already fix with a fixed
`<View style={{ height: 280 }} />` spacer — EditPetScreen just never got
it. Applied the same spacer; confirmed on-device, Save button now fully
visible above the keyboard.

**RESOLVED 2026-10-02 (not device-verified, low risk): text-overflow
audit of the remaining flagged screens.** Owner asked for a full "what's
left before Play Store" punch list, then asked Claude to start on the
self-serviceable items. Audited Calendar, DayDetailScreen, AddSheet,
AddPetScreen, HouseholdSetupScreen, BloodTestDetailScreen, and
ExpenseListScreen for the real confirmed risk shape (unbounded user text
in a row pushing a sibling button off-screen — not the earlier,
disproven insets.left/right theory). Five of seven are fine: they use
static/fixed-length header text, not user data, so there's nothing to
overflow. `ExpenseListScreen` is already structurally safe (its delete
button's sibling content View has `flex: 1`, which caps row width
regardless of note length). Only `BloodTestDetailScreen` actually had
it — the marker label falls back to the raw user-typed/OCR'd string
(no length limit on manual entry) next to the status badge with no
flex protection. Fixed with the same `flexShrink`/`numberOfLines`
pattern already used on MedicationListScreen/VetsScreen (`e9c4237`).
Low severity (a user would need to type
an unusually long marker name to ever see it), so not device-verified —
code-level fix only.

**The "keyboard covers a long form with no scroll slack" risk flagged
above (EditPetScreen's root cause) was NOT re-audited across other long
forms this pass** — that's a separate, not-yet-done item, distinct from
the text-overflow audit just completed.

**RESOLVED, device-verified 2026-10-01 (`048a163`): joining an existing
household could leave the joiner permanently stuck on "Set up your
household."** Found while device-testing with a second disposable
account (`gaptest2.pethealthtracker@gmail.com`) joining the `gaptest`
household via its real invite code — the underlying join write actually
succeeded but the UI never recovered from it. Root cause, per
`householdService.ts`'s own comment on `joinHousehold`: the
`users/{uid}` pointer write resolves first, `HouseholdContext`'s listener
reactively tries to subscribe to `households/{id}` before the second
(member-adding) write has committed, gets a transient `permission-denied`,
and — contrary to that comment's claim that this is "recoverable by
reopening the app" — a normal force-stop + relaunch did NOT recover it
(confirmed twice); only a full `pm clear` did. A real user joining a
family member's household (a core, advertised use case) would've hit a
confusing generic `[firestore/permission-denied]` error with no obvious
way out.

**Fix:** `HouseholdContext`'s household-document listener now retries up
to 4 times with increasing backoff (500ms–2000ms) before settling on "no
household," instead of giving up on the very first error. `loading`
stays `true` throughout a retry, so `RootNavigator` renders nothing
rather than flashing the setup screen mid-retry. A genuinely-denied read
(an actually-removed member) still fails through every retry and
correctly lands on `null`. **Device-verified**: a fresh third disposable
account (`gaptest3.pethealthtracker@gmail.com`) signed up, joined the
`gaptest` household via invite code `S9UVTE`, and landed straight on
Home with full household/pet access immediately — no stuck screen, no
manual relaunch needed. One harmless, self-recovering transient toast
("subscribeToPets listener error") appeared during the same test but
didn't block anything — the pet data rendered correctly regardless; not
worth chasing further unless it recurs.

**Resolved red herring, 2026-10-01:** a `members` array on the `gaptest`
household briefly looked corrupted (showed "1 of 4 members" with only
the second test account listed, not the original) — explained by the
owner manually deleting the original test household via Firebase
Console mid-session, not an app bug.

**RESOLVED 2026-10-01, device-verified: HouseholdScreen title sat under
the status bar/camera cutout** (`96ddfd1`) — same missing
`paddingTop: spacing.md + insets.top` pattern gap as the earlier
Settings-avatar fix below, just on a different screen. `HouseholdScreen`
never adopted the pattern `HomeScreen` already had. Confirmed fixed
on-device. Given this and the Settings-avatar bug were two different
screens hitting the same root cause independently, other screens using
`ScreenContainer` without any `insets.top` handling likely share this
risk — **not yet audited**, flagged for a future pass, not done
2026-10-01 (scope deliberately cut short mid-session, see below).

**RESOLVED 2026-10-01, device-verified: Settings-avatar clipping —
real cause was flex overflow, not screen curvature.** Owner reported
live (real device) that the Home screen's purple Settings avatar
(top-right) was almost entirely cut off, barely visible/tappable. First
fix attempt (`b74c924`, `insets.left`/`insets.right` handling in
`ScreenContainer`/`PetHomeScreen`) deployed but **did not fix it** —
confirmed still broken on-device afterward. Real cause: `HomeScreen`'s
header row has no `flex`/`flexShrink` on its left text block, so a long
*unbroken* string with no spaces for RN's default word-wrap to break on
(an email-derived display name, e.g. `gaptest.pethealthtracker`) forces
the row wider than the screen, pushing the right-aligned avatar off
entirely — nothing to do with safe areas or physical screen curvature.
Fixed (`3935dd7`) with `flex: 1` + `flexShrink: 1` on the left block and
`flexShrink: 0` on the avatar; **confirmed on-device, avatar now fully
visible** with the same long name that broke it. Applied the identical
defensive pattern to `HouseholdScreen`'s member row (display name next
to a "Remove" button, same shape — a member's `displayName` is usually
their email) — text wrapping confirmed correct on-device, but the
Remove-button-specifically-clipped scenario wasn't confirmed since the
only account available to test with has no second household member.
`MedicationListScreen` and `VetsScreen` already had the same guard on
their equivalent rows, so weren't touched. The `insets.left/right`
handling from `b74c924` is left in place (harmless no-op elsewhere),
not reverted — wrong diagnosis for this bug, but not wrong to have.
Other screens with their own manual header padding (Calendar,
DayDetailScreen, AddSheet, AddPetScreen, HouseholdSetupScreen,
BloodTestDetailScreen's marker-name row, ExpenseListScreen's
category/note row) weren't audited further — flagged as the same risk
shape, not confirmed affected.

**RESOLVED 2026-10-01: adding a new pet was broken in production for
everyone, including the owner's real account — now fixed and deployed.**
Found while device-testing open gap #7 on the disposable `gaptest`
account: `AddPetScreen`'s wizard sends `allergies: ''` in every create
payload (added by `151d637`, 2026-09-28, the Allergies-field commit), but
the pets `create` rule's `hasOnly([...])` allowlist was never updated to
include `allergies` — every new-pet creation was silently rejected with
`firestore/permission-denied` from 2026-09-28 18:30 until the fix
deployed. Macmac and Dona (the owner's existing real pets) were
unaffected because their `allergies` value was set later via an
`updatePet()` call, which has no field restriction — only genuinely *new*
pets hit this. The existing `firestore.rules.test.ts` pet-creation tests
didn't catch it because their fixture predated the Allergies field and
never included it either — passed cleanly against the broken rule. Fixed
both the rule and the test fixture (now matches the real wizard payload);
verified via `firebase emulators:exec` (76/76 rules tests pass,
commit `5e4665d`) before the owner approved
`firebase deploy --only firestore:rules --project pet-tracker-app-63512`.
**Deploy confirmed working** — the owner added a real pet on the
`gaptest` account afterward with no error.

**2026-09-30/10-01 session — small fixes plus one new feature, all now
device-verified.**

- Five commits landed on `master` since the 2026-09-29 pass below (all
  code-reviewed/`tsc`+`jest`-clean, **all device-verified 2026-10-01** on
  Macmac, owner's real pet):
  - Auto-scroll focused fields above the keyboard app-wide (`0088935`) —
    confirmed on Add a Blood Test's "Laboratory" field: focusing it with
    the keyboard open scrolled the field fully into view above the
    keyboard instead of leaving it hidden.
  - Scroll-to-submit-button for clustered inputs (`02d2583`) — confirmed
    on Add a Blood Test's (only, so also last) marker row: focusing
    "Ref. high" scrolled the whole cluster so the Save button was visible
    above the keyboard, not just the focused field.
  - Hygiene cap at one record per category plus a Clear action
    (`be5fb3e`) — confirmed by tapping "Teeth" twice (stayed at "Hygiene
    · 1 record" on Macmac's hub tile, not 2) then tapping "Clear" (reverted
    to "Not logged yet"). No leftover data on Macmac.
  - Duplicate "Add a ___" button fix on empty Vaccine/Document/Blood Test
    lists, and the same fix for the Vets list (missed in the first pass) —
    device-verified 2026-10-01, see the OCR entry below for the Vets half.
  None of this session's device testing left any permanent data behind —
  every test (OCR scan, Hygiene log/clear) was either not saved or was
  cleared again before moving on.
- **New: OCR-assisted blood test entry** (`fcccb60`) — Add a Blood Test
  now has "Scan photo"/"Choose from library" buttons using the same
  on-device ML Kit text recognition Scan Food already uses (nothing
  uploaded anywhere), parsed line-by-line by the new `bloodTestOcr.ts`
  and pre-filled into the same marker-row fields manual entry uses — the
  owner still reviews/corrects/confirms every row before Save, and OCR
  never touches reference-range interpretation (still
  `computeMarkerStatus`'s job). 9 new unit tests
  (`__tests__/bloodTestOcr.test.ts`) cover common lab-report line shapes;
  `tsc`/`jest` clean. **Device-verified 2026-10-01** via "Choose from
  library" on Macmac (owner's real pet, real household) using a
  synthetic lab-report image (not from Dona/the owner's camera roll —
  generated locally and pushed to the device's Pictures folder, then
  deleted again after the test): all four markers (ALT, Glucose,
  Creatinine, Total Protein — value/unit/reference-range) parsed
  correctly into the form. Not saved (navigated back instead of tapping
  Save), so no test data was left on Macmac. `VetsScreen`'s duplicate-
  button fix (`060b9cc`) also confirmed on-device in the same pass: the
  empty Vets list now shows only one "Add a vet" button.
- **Two untracked, undecided files sitting in the working tree as of
  2026-10-01, deliberately left alone pending the owner's call:**
  `agent-audit.md` (a stale, unrelated 2026-09-22 audit report about
  this machine's skill/agent setup, not app code) and
  `design_handoff_colorful_reskin/` (an HTML prototype + screenshots —
  reference material for the Colourful Reskin, which is already merged).
  Neither is committed; decide whether to delete, `.gitignore`, or keep.

**Pre-Play-Store-submission pass, 2026-09-29 — session ended mid-task, resume
here first.**

- **Found and fixed a real bug while checking something unrelated:**
  `WeightTrendChart.tsx`'s bar heights were scaled to the tight min/max of
  just the visible entries, not to the actual values — so a small real
  change (e.g. a pet gaining 6%) could render as a bar several times
  taller, because it happened to be the biggest swing in a short log. Fixed
  to scale proportionally from a zero baseline instead (commit `e68c708`),
  which also fixed a separate gap: `WeightLogScreen` was missing the
  "+X.X% since last weigh-in" badge that `PetHomeScreen` already had —
  added the same badge there. **Device-verified 2026-09-29** on Macmac's two
  real weight entries (2026-09-11 → 2026-09-28): trend badge read "+25.0%",
  and the two bars' actual pixel heights (measured via `uiautomator dump`,
  not eyeballed) came out to 250px vs 312px against a shared baseline — a
  24.8% height difference, matching the value change almost exactly. Done.
- **Confirmed 2026-09-29: `gradlew bundleRelease` succeeds end-to-end** —
  `BUILD SUCCESSFUL`, `validateSigningRelease`/`signReleaseBundle` both ran
  clean using the real release keystore (`hasReleaseKeystore` true, not the
  debug fallback), producing a signed
  `android/app/build/outputs/bundle/release/app-release.aab` (~82 MB). This
  is the first time this had actually been attempted rather than just set
  up, and it's now a confirmed non-blocker for Play Store submission — the
  release-signing setup from earlier this week (item 6 in `CLAUDE.md`'s
  build-environment list) genuinely works. (Took ~7.5h wall-clock on this
  machine, first cold release build — most of that is plausibly the machine
  being idle/asleep between the two sessions that spanned it, not pure
  build time; a second release build should be much faster from Gradle's
  now-warm caches.)
- **Play Store timing question resolved with the owner:** confirmed it's
  not necessary to finish every open item (the 10 not-yet-device-verified
  gaps, Plan 9B real billing) before the first submission — Play Store
  updates are fast/routine once an app is live, so the plan is: submit a
  solid first version once the Play Console/merchant-account step is done,
  then iterate via normal updates. The `applicationId` and signing setup
  are the two things that are hard/impossible to change later, and both are
  already settled.
- **Payment/tax research this session (not app-code, but relevant to Plan
  9B):** confirmed Google Payments merchant registration supports Serbia
  (developer + merchant registration both ✔, wire transfer payout, $100
  minimum, per Google's own supported-locations page). Confirmed Serbia's
  "frilenser" self-taxation regime (a physical person, no registered
  business, quarterly self-assessment) legally covers receiving this kind
  of foreign income — Model A's 2026 non-taxable quarterly threshold is
  ~110,647 RSD (~$1,070 net of Google's cut, ~$1,260 gross, at ~103
  RSD/USD). Stripe/Paddle are **not usable as a substitute for Google Play
  Billing** for in-app Android subscriptions (Play Store policy requirement,
  not a Serbia-specific limitation) — they'd only be relevant for a
  hypothetical web-only checkout outside the app, which isn't in scope.

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
- **Fully verified end-to-end on device, 2026-09-28/29 (Dona, a test pet) —
  both features now considered done.** Scan Food: both paths confirmed — a
  photo with no allergen text produces the green "No known allergens
  detected" card, and (after temporarily setting Dona's Allergies to
  "Chicken" for the test, then reverting it) a photo containing "Chicken"
  text produces the red "⚠️ Possible allergen match" card naming the matched
  allergen. Blood Tests: added a first test (ALT 120 U/L, reference 10–100,
  9/28/2026) and confirmed `BloodTestListScreen`'s red out-of-range summary
  dot and `BloodTestDetailScreen`'s summary count, notable-result card
  (glossary description "An enzyme associated with the liver", status
  label), and the two auto-generated vet questions. Added a second test
  (ALT 60 U/L, same reference range, dated 9/20/2026 — before the first) and
  confirmed the cross-test `markerTrend`/`describeTrend` sentence renders
  correctly: "ALT has increased across the 2 recorded tests — the numbers
  alone, not a clinical read." That pass also caught and fixed a real,
  if minor, copy bug only visible once actually rendered — the sentence
  read "...recorded tests **for —** the numbers alone..." with a stray
  literal "for" next to the em dash (`BloodTestDetailScreen.tsx`, fixed same
  session, `d5a845c`). **Test data left on Dona from this pass** (both blood
  tests, "City Vet Lab") is real app data now, not a scratch artifact —
  delete via the Blood Tests screen's own trash icon if/when no longer
  wanted, no rush.
- **Device/tooling note, 2026-09-29:** resuming this session after an
  overnight gap needed `adb reverse tcp:8081 tcp:8081` re-run (the tunnel
  had dropped) and, once, a full `am force-stop` + relaunch rather than just
  the dev menu's own Reload — a plain Reload after fixing the port forward
  left the app on a blank screen with the RN instance in a stuck reload
  state (`ReactInstance task returned null` in logcat) more than once. If
  the app comes up blank after a break: check `adb reverse --list` first,
  then prefer force-stop + relaunch over Reload if a Reload alone doesn't
  recover it.
- **Second, worse tooling failure the same day, after the ~7.5h
  `gradlew bundleRelease` finished:** the app showed React Native's own
  "Unable to load script" error screen — a step past the usual blank-screen
  symptom above. This time `adb reverse` and force-stop/relaunch alone
  didn't fix it: the Metro `node` process itself was hung, silently, with
  **4h14m of accumulated CPU time** and not serving anything (`curl` against
  `/index.bundle` timed out completely at 60s, `HTTP 000`). Plausible cause:
  Metro's own process survived the whole multi-hour gap (including the
  concurrent heavy `bundleRelease` build) and got into a bad state, rather
  than just losing the USB tunnel. **Fix: kill the stuck Metro process
  outright (`taskkill /F /PID <node pid>`, found via `tasklist` — look for
  a `node.exe` with an unreasonable CPU-time column) and start a completely
  fresh one (`npx expo start`)**, then redo `adb reverse` and relaunch.
  Blank-screen (tunnel dropped) and "Unable to load script" (Metro itself
  hung) are two different failure modes needing two different fixes — check
  `curl -m 10 http://localhost:8081/status` and `tasklist` for `node.exe`
  CPU time before assuming a simple reverse/relaunch will fix either one.

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

**Device-verified 2026-09-29, on the owner's real household/pets (no scratch
data needed):**
- **#5** — Dona's "About" card shows Birth date ("Roughly 9/1/2026"),
  Arrival ("Roughly 9/28/2026"), Sex ("Don't know"), Colour/markings ("Not
  set"), Allergies ("None known"); microchip and custom-field rows correctly
  absent since neither pet has any set.
- **#8** — Android's own notification-channel settings for the app
  (Settings → Apps → Pet Health Tracker → Notifications) show a named
  "Reminders" channel, not just the generic default.
- **#18** — `SettingsScreen` has the confirmed "Log out" button (not tapped,
  to avoid disrupting the session — just visually confirmed present).

**Device-verified 2026-09-29, on a fresh disposable test account/household
(`gaptest.pethealthtracker@gmail.com`, "Gap Test Household") created
specifically to safely exercise zero-pet states without touching the
owner's real data:**
- **#11 confirmed working** — `AddEventScreen`'s step 0 ("Who is it for?")
  correctly shows a `GuidedEmptyState` ("No pets yet", calendar-specific
  message, working "Add a Pet" button) with "Next" greyed out, reached via
  the actual `topLevel`/`needsPet:false` "Add to Calendar" tile from the
  global "+" sheet.
- **Found and fixed a real, previously-undocumented dead-end in the same
  family:** `ChoosePetForAddScreen` (the "who is this for?" step for
  Vaccine/Medication/Vet Visit/Expense/Document/Vet — anything routed
  through it via `needsPet:true`) showed a plain, inert `"Add a pet
  first."` string for a zero-pet household, with no button and no way
  to act on it — worse than #11's screen, and a separate gap from it
  since it's a different component entirely. Fixed to use the same
  `GuidedEmptyState` pattern (commit `4daa1b5`) and confirmed on-device.
- Also incidentally re-confirmed `HouseholdSetupScreen`'s own real bug this
  same session: it had the identical keyboard-covers-the-button issue as
  `SignInScreen`/`SignUpScreen` (same copy-pasted `justifyContent:'center'`
  pattern) — found live while creating the disposable test household, fixed
  in the same pass as the auth screens (commit `78e5bb0`). Two other files
  share the same centering snippet (`InviteSitterScreen`,
  `WeightUnitSetupScreen`) but only on a button-only result screen with no
  text input, so they don't have the keyboard-clipping exposure — left
  alone.

**#2, #4, #9, #10, #12 — code-audited 2026-10-01, concluded not practically
device-testable on a single phone/session; #7 still open, see below.**
Attempted a device pass on all six (owner's request); five turned out to
structurally resist it:
- **#2** (`generateInviteCode`'s CSPRNG) — confirmed by reading
  `secureRandomIndex` (`householdService.ts`): correctly prefers
  `crypto.getRandomValues` (`Uint32Array` + modulo), falls back to
  `Math.random()` only if that's unavailable. The code's own comment
  already states this was deliberately written to not need device
  verification. Not device-observable — there's no UI surface that
  reveals which path ran.
- **#4** (error surface on Done/Skip) — read the full call chain
  (`useCalendarEntryActions.ts` → `reminderActions.ts`'s `markDone`/
  `skip`, which propagate rather than swallow): every `catch` sets
  `error`, both `CalendarScreen` and `DayDetailScreen` render it via
  `{error && <ErrorText>{error}</ErrorText>}`. Tried forcing a real
  failure via airplane mode first — doesn't work, Firestore's offline
  persistence queues the write and resolves the `await` successfully
  from local cache rather than throwing, so that would've been a false
  test either way. A genuine rejected write needs a second Firestore
  client racing a delete against this one's `await updateEvent(...)` —
  not reproducible solo.
- **#9** (stale snooze pruning) — `isSnoozed()`/`SnoozeEntry` logic read
  in full, matches the dueDate-based self-invalidation CLAUDE.md
  describes, and has dedicated passing unit tests
  (`__tests__/snoozeStore.test.ts`). Also genuinely unreachable from the
  UI at all right now — CLAUDE.md already documents that the snooze
  button is deliberately not wired to any screen.
- **#10** (DST edge case) — `computeNotificationTime` read in full, uses
  `addDays()` (the codebase's one DST-safe day-boundary helper) instead
  of raw millisecond math, with dedicated passing unit tests
  (`__tests__/notificationTiming.test.ts`). Only actually observable on
  a device within a day of a real DST transition, twice a year.
- **#12** (`EditEventScreen` stale "Loading…") — read the full
  `notFound`/`loaded` effect: a first snapshot without the event sets
  `notFound` immediately, matching #11's already-device-verified sibling
  fix. Reproducing it for real needs the same cross-client race as #4
  (open Edit on an event another client deletes before this screen's
  first snapshot arrives) — not reproducible solo, and forcing it via a
  single-device timing hack risked a flaky, misleading result rather
  than a real signal.

**#7 — device-verified 2026-10-01, on the `gaptest` account, after a
three-part detour.** Needed a pet with zero weight logs to see the empty
state (both of the owner's real pets already have entries, and the app
has no UI path to remove/forget a pet, so this had to happen on the
disposable `gaptest.pethealthtracker@gmail.com` account, not the real
household). Getting there took three blockers in sequence: the phone
locked mid-session (owner unlocked it), the app's email/password auth
meant Claude couldn't safely switch accounts solo (owner did the
login/logout themselves), and then adding the throwaway pet surfaced the
**critical `allergies` rules bug** documented earlier in this file — a
real production blocker on pet creation, unrelated to #7 itself, fixed
and deployed (`5e4665d`, confirmed via `firebase deploy`) before #7
could even be attempted. Once that landed, the owner added a pet, opened
its Weight screen, entered a value, and tapped "Log weight" — saved
successfully, confirming the empty-state form (not a dead button) is
what's actually there. **#7 closed.**

**Housekeeping note:** the `gaptest.pethealthtracker@gmail.com` /
`GapTest2026` test account's "Gap Test Household" now has one throwaway
pet (added for this check, species Dog, named during the wizard — breed
got accidentally set to Chihuahua mid-wizard, harmless) plus one weight
log entry — both safe to delete via Firebase console whenever convenient,
same as the other disposable test data already listed below. The device
itself was left signed into this test account, not the owner's real
one — sign back in as yourself next time you pick up the phone.

## Housekeeping in the live Firestore project

No in-app cleanup path exists for any of these — remove them by hand in the
Firebase console whenever convenient.

- **2026-10-01 session:** the owner deleted the original `gaptest` household
  ("household1") manually via Firebase Console mid-session. A second
  disposable account, **`gaptest2.pethealthtracker@gmail.com`** / password
  `GapTest2026`, was created and joined the `gaptest` household's invite
  code — both this account and whatever household state it's now attached
  to are safe to delete via Firebase Console whenever. The device itself
  was left signed into this account, not the owner's real one.
- One disposable test account/household from tonight's (2026-09-29) open-gaps
  device pass: **`gaptest.pethealthtracker@gmail.com`** / "Gap Test
  Household" (zero pets, created solely to test empty-state screens without
  touching the owner's real data) — safe to delete (Firebase Auth user +
  its household doc) whenever. The phone was left signed into this account,
  not the owner's.
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
