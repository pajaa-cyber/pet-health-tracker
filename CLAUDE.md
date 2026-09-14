# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Work durability — read this before starting any multi-task plan

**On 2026-09-14, a full day of work (an entire "Plan 3" and "Plan 4" implementation, reported by the owner as built, tested, and verified) turned out to have no trace anywhere** — not in local git history/reflog, not in any dangling/unreachable git object, not on the GitHub remote (`origin`, the only remote, single `master` branch), not in any other worktree or clone on the machine. This machine has no backup device. Whatever happened, the working tree state was lost before it was ever committed and pushed, and there was no second copy anywhere to recover it from. **This must never happen again.** Concretely:

- **Commit after every individual task**, not just at the end of a plan — this repo's own history (Plans 1 & 2) shows this was the original practice; it must not lapse. A lost uncommitted task is a much smaller loss than a lost plan.
- **Push to `origin` frequently during a plan, not only at the very end.** A commit that only exists on local disk in this OneDrive-synced folder is not a backup — push work-in-progress branches too, not just finished `master` merges.
- **Never delete a worktree or its branch until you've confirmed (`git log <branch> ^origin/master`, or equivalent) that everything on it is merged into `master` AND `master` has been pushed.** Deleting a worktree whose branch was never merged/pushed is how work disappears with zero recoverable trace.
- **Never pass `isolation: "worktree"` to the Agent tool when a plan already has its own dedicated worktree** — this creates a second, disconnected throwaway worktree/branch that nothing tracks; a near-miss of exactly this already happened once in this project.
- **At the start of every session, verify actual repo state with `git log`/`git branch -a`/`git status` before trusting what CLAUDE.md/NEXTSTEPS.md claim was done** — those files are written by a session that may not have finished cleanly; git is the ground truth.

## Project

Pet Health Tracker: a React Native (Expo) + Firebase mobile app for tracking a pet's vaccines, medications, vet visits, weight, and expenses, with real-time sharing across household members. Full rationale and MVP scope: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`.

**Status:** Plan 1 ("Foundation & Auth", `docs/superpowers/plans/2026-09-11-pet-health-app-foundation.md`) and Plan 2 ("Pet Records Core", `docs/superpowers/plans/2026-09-12-pet-records-core.md`) are both **complete and merged into `master`**. Plan 3 ("Reminders & Notifications") is not written yet. See `NEXTSTEPS.md` for exact resume state and known gaps.

**As of 2026-09-13, this app has actually been run on a real device for the first time** — a real Firebase project exists (`pet-tracker-app-63512`), a real Android phone runs the app over USB, and the app has been used end-to-end (sign-up, household creation, adding pets/records, camera photo capture). This closes the "this app has never been seen running" gap that an earlier roadmap document (`ROADMAP-and-claude-code-playbook.md`, referenced in older notes but not present in this repo) opened with. That document has since been superseded by two current ones — `docs/superpowers/specs/2026-09-13-build-plan.md` (analysis/reasoning) and `docs/superpowers/specs/2026-09-13-execution-pack.md` (locked decisions + the seven concrete phases) — read both for the owner's plan for everything after this point (Plans 3–9); if only one, read the execution pack. The build plan references two spec files (`docs/superpowers/specs/2026-09-13-ux-and-feature-spec.md`, `docs/design/DESIGN-GUIDE.md`) that do not exist in the repo — and the execution pack explicitly says any future `DESIGN-GUIDE.md` is superseded by the redesign already in place (see "UI/Design system" below) and should not be applied.

The app also has a full visual redesign now (see "UI/Design system" below) and a from-scratch local Android build environment on the Windows machine this was developed on (see "Local device build environment" below) — read both before assuming either doesn't exist.

Read Plan 1's "Revision log" section before touching `src/household/` or `firestore.rules` — the join-household design changed twice after the original draft turned out not to work against real Firestore, and a subsequent whole-branch review found and fixed an invalid rules-syntax bug (see the Data model note below). Both plans' documents contain some superseded/stale code snippets flagged inline with "STALE — DO NOT COPY" warnings; always copy from the current source files, never from plan text.

## Commands

- `npm test` / `npx jest` — run all Jest tests (unit tests only; see Testing below for what this does and doesn't cover)
- `npx jest <path>` — run a single test file, e.g. `npx jest __tests__/householdService.test.ts`
- `npx tsc --noEmit` — type-check the whole project
- `npm run android` / `npm run ios` — build and launch on a device/emulator (requires `npx expo prebuild` to have generated `android/`/`ios/` first, and a real Firebase project's config files in place — see Firebase setup below)
- `npm start` — start the Expo dev server
- `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"` — run the security-rules tests against a real local Firestore/Storage emulator (requires the Firebase CLI and a JRE; plain `npx jest` on this file will fail with `ECONNREFUSED` since nothing is listening on the emulator port). **Emulators are free regardless of billing plan** — the Blaze/Storage restriction above only applies to the real cloud project, not local testing.
- `npx expo run:android` — build, install, and launch on a connected real device or emulator (this is what actually got the app running for the first time — see "Local device build environment" below for the non-trivial setup this needed on Windows)

## Firebase setup (one-time, per environment)

RNFB reads Firebase config from native files, not JS env vars or `.env`. See `.env.example` for the exact steps: download `google-services.json` and `GoogleService-Info.plist` from the Firebase console to the **project root** (not into `android/app/`/`ios/` directly — the Expo config plugin copies them there automatically on `expo prebuild`). Both are gitignored — on a fresh clone/environment they will not exist and must be created before `expo prebuild` can succeed. A real project (`pet-tracker-app-63512`) now exists and its real `google-services.json` has been used on the Windows dev machine this app was built on, but that file is machine-local and gitignored, not something a new environment inherits — see NEXTSTEPS.md's environment section if you need to recreate a working (even if fake/placeholder) pair to unblock `expo prebuild`.

**Cloud Storage is not usable on this project and the app does not use it.** Google requires the paid "Blaze" plan for Cloud Storage (a Sept 2024 policy change), which in turn requires a Google Cloud billing account — and Blaze setup for this project's owner (a personal, non-organization Google account) asks for tax/business information that a personal account cannot supply. `storage.rules` and `firebase.json`'s storage config are still present (harmless, unused) in case a future business-entity upgrade makes Storage viable, but **do not build any feature that assumes Cloud Storage will accept an upload** — it will fail with a 404/"terminated the upload session" error, not a permissions error. See "Photo storage" under Architecture below for what's used instead.

## Architecture

**Stack:** Expo using the prebuild/dev-client workflow (not Expo Go) + `@react-native-firebase` (native-bridge Firebase SDK, not the `firebase` web SDK) for the app itself, chosen specifically for genuine offline persistence that survives app restarts — the web SDK can't do this on React Native (no IndexedDB). This has one major consequence for how code must be written and tested (see below).

**`@react-native-firebase` is modular-only and native-bridge.** Two things every task in this codebase has to account for:
1. RNFB v22+ dropped the old namespaced API (`firestore().collection().doc()`, `auth().signIn...()`). Only the modular API exists (`collection(db, path)`, `doc(...)`, `getAuth(app)`, etc. — mirrors the Firebase JS SDK v9+ surface). `src/firebase/config.ts` exports already-initialized `auth`/`firestore` instances, not callables — do not write `auth()` or `firestore()`, just `auth`/`firestore`.
2. RNFB's JS API is a native bridge — it only runs inside a real native app process on a device/emulator, never inside Jest/Node under any API style. Code in `src/household/` that touches Firestore is unit-tested by **mocking** `@react-native-firebase/firestore`'s modular functions (see `__tests__/householdService.test.ts`), not by hitting a real emulator.

**Photo storage: base64-in-Firestore, not Cloud Storage.** Pet photos (`Pet.photoUrl`) and vet-visit document photos (`VetVisit.documentUrls`) are both plain Firestore `string`/`string[]` fields, but their VALUES are `data:image/jpeg;base64,...` data URIs, not download URLs — there is no Cloud Storage bucket behind them (see the Blaze/tax-info blocker above). `src/pets/imageUpload.ts`'s `pickAndProcessImage(source)` does the whole pipeline: launch camera or library picker (`expo-image-picker`, including `requestCameraPermissionsAsync()` for the camera path) → resize to 640px wide + compress at 0.5 quality via `expo-image-manipulator` (`manipulateAsync(..., { base64: true })`) → return the data URI directly. Callers (`AddPetScreen`, `PetHomeScreen`'s `AvatarPicker`, `VetVisitDocumentsScreen`) just write that string straight into Firestore via `updatePetPhoto`/`addVetVisitDocument` — there is no separate upload step. `@react-native-firebase/storage` has been **removed** from `package.json`; do not reintroduce Storage-based upload code without first confirming the Blaze/billing blocker has actually been resolved. The binding constraint is Firestore's 1 MiB per-document limit: a single pet photo is a non-issue, but a vet visit's `documentUrls` array lives on one document, so many photos on one visit will eventually approach the limit — resize/compression parameters in `imageUpload.ts` are tuned to keep each photo roughly 30-100KB for headroom, not arbitrarily changeable without re-checking that math.

**Firestore security rules are tested differently, and are the layer that actually proves access control works.** `firestore.rules` is tested via `__tests__/firestore.rules.test.ts` using the **web** `firebase` package (pure JS, Jest-compatible) through `@firebase/rules-unit-testing` against the real Firestore emulator — this works because rules enforce identically regardless of which SDK wrote the request. This is a separate dependency from `@react-native-firebase/firestore`, only used in this one test file.

**Data model:** `households/{householdId}` documents hold a `members: HouseholdMember[]` array (display data: userId + displayName + joinedAt) **and a denormalized `memberIds: string[]` mirror of just the user IDs**. Access control lives entirely in `firestore.rules`'s `isMember()`/`isHouseholdMember()` checks, which test `request.auth.uid in householdData.memberIds` — **never** against `members`. The rules language has no `filter()` and no lambdas, so membership simply cannot be tested against an array of objects; an earlier `members.filter(m => m.userId == request.auth.uid).size() > 0` spelling was invalid syntax that would have locked every user out of the app, and was caught only in Plan 2's final whole-branch review. Both arrays are written in lockstep inside `householdService.ts`'s atomic batches, and `isJoining()` enforces that lockstep for untrusted join writes. Anyone building a new collection under a household must extend the existing `match /households/{householdId}` rules block rather than adding a separate top-level collection, unless there's a specific reason not to (see the `inviteCodes` exception below).

**Household join flow, and why it's shaped the way it is:** joining a household by invite code does NOT query `households` filtered by `inviteCode`. Firestore rejects a `list`/query request unless the security rule is provably true for every document the query could structurally match, not just the actual match — since membership can't be proven for arbitrary households, that query is rejected outright for any non-member. Instead, a separate `inviteCodes/{code} -> { householdId }` collection (readable by any signed-in user) resolves the code via a single-document `get()`, and `joinHousehold` updates the household using Firestore's server-side `arrayUnion(newMember)` rather than a client-computed array — the joining client never needs read access to the household document. The rules' `isJoining()` function additionally requires `.hasAll(existingMembers)` on any non-member update, so a write can only ever *add* the requester, never drop or replace an existing member. Do not "simplify" this back to a direct query or a client-computed members array — both were tried and found broken by review (full history in the plan's Revision log).

## Testing

- `__tests__/household.types.test.ts`, `__tests__/householdService.test.ts` — real Jest, run and pass normally; the latter mocks Firestore rather than using a real one (see Architecture above)
- `__tests__/firestore.rules.test.ts` — requires the Firebase Local Emulator Suite (`firebase emulators:exec --only firestore,storage "..."`) and a JRE; running plain `npx jest` against it will fail on connection refused, not a code defect

## Pet records data model (Plan 2 — "Pet Records Core")

`households/{householdId}/pets/{petId}` holds each pet; `vaccines/`,
`medications/`, `vetVisits/`, `weightLogs/`, `expenses/` are subcollections
of each pet. Unlike the household join flow, no untrusted-write path exists
for any of these — only confirmed household members ever touch them — so
their `firestore.rules` blocks are a single `isHouseholdMember(householdId)`
check (a `get()` on the ancestor household doc) plus a `create`-time
`hasOnly([...])` field allowlist. Do not add `hasAll`/`diff()`-style hijack
protection to these blocks; that machinery exists only in `isJoining()` to
defend the household-join boundary and doesn't apply here.

`users/{userId} -> {householdId}` is a single-document pointer (mirroring
the `inviteCodes` pattern) letting the app find which household a signed-in
user belongs to without a query — `HouseholdContext.tsx`'s `useHousehold()`
resolves it via two chained `onSnapshot` listeners. It's create-once
(immutable) by rule, so a user already in a household can't overwrite it —
switching/leaving households isn't supported yet (parked as a future task).

Medication schedules use a simple custom struct (`{timesPerDay, intervalDays}`),
not RFC5545 RRULE — deliberate MVP scope, see the Pet Records Core plan's
task text for rationale. Expense amounts are stored as integer
`amountCents`, never a float, to avoid rounding drift in running totals;
the only place dollar/cents conversion happens is the expense screens.
`WeightTrendChart.tsx` is a hand-rolled bar chart (plain `View`s) rather
than a charting library, to avoid a new native dependency during MVP.

## UI/Design system

`src/theme/theme.ts` (colors, spacing, radii, typography, a shared `shadow` preset) plus `src/components/ui/` (`Button`, `Card`, `ScreenContainer`, `TextField`, `Chip`, `Typography` — `Title`/`Subtitle`/`BodyText`/`MutedText`/`ErrorText`, `AvatarPicker`) are the shared design system every screen is built from as of the 2026-09-13 redesign. Palette: teal/health-blue primary (`#0891B2`), warm orange accent (`#F97316`) for primary "add" actions, calm off-white background — chosen for a pet **health** app specifically (not generic "cute pets"), via the `ui-ux-pro-max` skill's design-system search. `MainNavigator`/`RootNavigator` apply consistent header styling via `screenOptions` (primary-colored header, white title text) rather than per-screen headers. New screens should compose from `src/components/ui/index.ts`'s exports rather than styling raw `View`/`Text`/`Button`/`TextInput` inline — that inconsistency (every screen hand-rolling its own `{ padding: 24, gap: 12 }`) is exactly what the redesign replaced. Species/section icons use plain emoji (🐶🐱💉💊 etc.) rather than an SVG icon set — a deliberate MVP call to avoid a new dependency, acceptable specifically because they're decorative pet/category glyphs, not functional UI-control icons.

## Local device build environment (Windows)

The app has been built and run on a real Android phone from this Windows machine — none of this was true before 2026-09-13, and reproducing it on a fresh environment needs all of the following, not just `npm install`:

- **Java:** Microsoft OpenJDK 21 via `winget install Microsoft.OpenJDK.21`, at `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`.
- **Android SDK:** installed manually via the standalone command-line tools (NOT Android Studio) at `C:\Android\Sdk` — `platform-tools`, `platforms;android-36`, `build-tools;36.0.0` via `sdkmanager`. `ANDROID_HOME`/`ANDROID_SDK_ROOT` point there.
- **`android/local.properties`** (gitignored) must contain `sdk.dir=C\:\\Android\\Sdk` — **`expo prebuild` deletes and regenerates the whole `android/` directory every time it runs, including this file**, so it has to be recreated after every prebuild, not just once.
- **`GRADLE_USER_HOME` is deliberately set to `C:\Android\gradle-home`**, NOT the default `~/.gradle`. Reason: VS Code's Gradle extension (`vscjava.vscode-gradle`) runs its own background Gradle daemon against this same project using a *different* Gradle version than the project's own wrapper, and the two daemons corrupt each other's shared content-addressable transforms cache mid-build — symptom is a hard-to-diagnose `Cannot snapshot ... not a regular file` or `... (The system cannot find the path specified)` `BUILD FAILED`, on a different cached file each retry, that looks like random flakiness but reliably resolves once each tool has its own isolated `GRADLE_USER_HOME`. (This was initially mistaken for antivirus interference — four AV products are genuinely registered on this machine at once, Windows Defender + Avast + 360 Total Security + Reason Cybersecurity, which is unusual and worth the owner's attention someday, but was NOT the actual cause here.)
- **This project folder lives inside an actively-syncing OneDrive folder** (`C:\Users\PC\OneDrive\Desktop\app`). Every file in it — hydrated or not — reports to Node.js as a reparse point that `fs.Dirent.isFile()` treats as a symlink rather than a regular file. This silently broke Jest (found zero tests despite `__tests__/` genuinely existing) until `jest.config.js` got `haste: { enableSymlinks: true }` + `watchman: false`. It is a real, reproducible Windows+OneDrive interaction, not a fluke — do not "fix" it back out under the assumption it was transient.
- **Both `jest.config.js` and `metro.config.js` exclude `android/`** from their file crawlers/watchers — after even a couple of on-device builds, `android/` holds 1000+ generated native build files (Gradle caches, compiled classes, resources) that were separately overwhelming both tools' default crawlers (Jest: silently found zero tests; Metro: `packager-status` never responds). `metro.config.js` did not exist before this was diagnosed — it now sets `resolver.blockList` for `android/`+`ios/`.
- **Metro can end up orphaned/unresponsive after `npx expo run:android` finishes** (`curl http://localhost:8081/status` hangs indefinitely) — seen repeatedly, not a one-off. Fix: kill the stray `node.exe` bound to port 8081, restart detached (`npx expo start --clear < /dev/null > metro.log 2>&1 &`), wait for `packager-status:running`, then `adb reverse tcp:8081 tcp:8081` again.
- Real device: a Honor phone (MagicOS 10, model `MTN-NX1M`) connects via USB debugging; `adb` lives at `C:\Android\Sdk\platform-tools\adb.exe`. It intermittently drops off `adb devices` for no code-related reason (seen repeatedly) — Windows Device Manager shows the "ADB Interface" USB device itself going to status "Unknown" while the phone is still otherwise recognized. Unplug/replug the USB cable first (usually fixes it); if not, unlock the phone's screen; if still not, toggle USB debugging off/on in Developer Options and re-accept the authorization prompt.
- **Git worktrees for SDD plans must use a short path outside OneDrive — e.g. `C:\dev\<plan-name>` — not the `.claude/worktrees/<name>` default.** A worktree nested under this OneDrive-synced project path plus `.claude/worktrees/<name>` is long enough that Windows' MAX_PATH (260 chars) gets hit by CMake/ninja's own long intermediate object filenames during the native build of `react-native-safe-area-context`/`react-native-screens`, failing with `ninja: error: ... Filename longer than 260 characters` — discovered partway through Plan 3. Neither pure-JS dependency installs nor `tsc` are affected, only `expo run:android`'s native build step. If already in a too-deep worktree when this hits: commit whatever's verified so far, then relocate via `git worktree remove --force` (the old directory may fail to fully delete with the same "filename too long" error — harmless leftover, no longer a registered worktree) + `git worktree add <short-path> <branch>`; `git worktree move` itself can fail with a OneDrive file-lock permission error, so prefer remove+add over move.

## Known gaps (see `NEXTSTEPS.md` for full detail)

- **RESOLVED (2026-09-12):** every rules construct in this codebase
  (`isMember`/`isJoining`/`isHouseholdMember`, the `diff()`/
  `affectedKeys()` field scoping, the `storage.rules` cross-service
  `firestore.get()` form) has now been run through a real Firestore
  rules compiler via `firebase emulators:exec --only firestore,storage
  "npx jest __tests__/firestore.rules.test.ts"` — 35/35 passed, no new
  defects found. (One real construct, `.filter()` with a lambda, had
  previously turned out to be invalid syntax and was only caught in
  Plan 2's final review — see NEXTSTEPS.md for that history.)
- **RESOLVED (2026-09-12):** `VetVisitDocumentsScreen.tsx` now renders
  `documentUrls` back as an image grid (previously write-only);
  uploads also now set `contentType: 'image/jpeg'` explicitly so
  `storage.rules`' content-type check is enforced against a real value.
- **RESOLVED (2026-09-12):** date fields are no longer hardcoded to
  `Date.now()`. A shared `src/components/DateField.tsx` (wrapping
  `@react-native-community/datetimepicker`, added as a new native
  dependency — `app.json`'s `plugins` array and `android/` were
  regenerated via `expo prebuild --platform android` to wire it in) is
  now used by every add/log screen: pet birth date, vaccine
  dateGiven/nextDueDate, medication startDate/endDate, vet visit date,
  expense date, and weight-log date. `Vaccine.nextDueDate` can now be
  set to a real future date, unblocking Plan 3's reminder computation.
  **RESOLVED/VERIFIED (2026-09-13):** now confirmed working on a real
  device, not just `tsc`/Jest.
- **RESOLVED (2026-09-13):** camera support added — `src/pets/imageUpload.ts`'s
  `pickAndProcessImage` offers both "Take Photo" (camera) and "Choose from
  Library" for pet photos (`AddPetScreen`, `PetHomeScreen`'s `AvatarPicker`)
  and vet-visit documents (`VetVisitDocumentsScreen`). See "Photo storage"
  under Architecture above — this pivoted to base64-in-Firestore rather
  than Cloud Storage partway through, because Storage turned out to be
  unusable for this project (Blaze plan requires billing/tax info a
  personal account can't supply). `@react-native-firebase/storage` was
  removed; `storage.rules` is unused but left in place.
- **RESOLVED (2026-09-13):** the whole app was visually redesigned — see
  "UI/Design system" above. Previously every screen hand-rolled its own
  inline `View`/`Button`/`TextInput` styling with no shared palette,
  spacing, or component set.
- A user whose household document becomes unreadable (e.g. a future
  "remove member" feature) has no in-app recovery path — both
  `createHousehold`/`joinHousehold` fail once their `users/{uid}` pointer
  already exists.
- `generateInviteCode()` in `householdService.ts` still uses `Math.random()`,
  not a CSPRNG — not currently exploitable, deliberately left alone since a
  proper fix needs a new native crypto dependency (e.g. `expo-crypto`) and
  another prebuild/rebuild cycle for a low-severity item.
