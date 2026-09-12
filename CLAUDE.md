# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pet Health Tracker: a React Native (Expo) + Firebase mobile app for tracking a pet's vaccines, medications, vet visits, weight, and expenses, with real-time sharing across household members. Full rationale and MVP scope: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`. Current implementation plan (in progress): `docs/superpowers/plans/2026-09-11-pet-health-app-foundation.md` — read its "Revision log" section before touching `src/household/` or `firestore.rules`, since the join-household design changed twice after the original draft turned out not to work against real Firestore.

## Commands

- `npm test` / `npx jest` — run all Jest tests (unit tests only; see Testing below for what this does and doesn't cover)
- `npx jest <path>` — run a single test file, e.g. `npx jest __tests__/householdService.test.ts`
- `npx tsc --noEmit` — type-check the whole project
- `npm run android` / `npm run ios` — build and launch on a device/emulator (requires `npx expo prebuild` to have generated `android/`/`ios/` first, and a real Firebase project's config files in place — see Firebase setup below)
- `npm start` — start the Expo dev server
- `firebase emulators:exec --only firestore "npx jest __tests__/firestore.rules.test.ts"` — run the security-rules tests against a real local Firestore emulator (requires the Firebase CLI and a JRE; plain `npx jest` on this file will fail with `ECONNREFUSED` since nothing is listening on the emulator port)

## Firebase setup (one-time, per environment)

RNFB reads Firebase config from native files, not JS env vars or `.env`. See `.env.example` for the exact steps: download `google-services.json` and `GoogleService-Info.plist` from the Firebase console to the **project root** (not into `android/app/`/`ios/` directly — the Expo config plugin copies them there automatically on `expo prebuild`). Both are gitignored; a fake placeholder pair exists on disk so `expo prebuild` can run without a real Firebase project attached.

## Architecture

**Stack:** Expo using the prebuild/dev-client workflow (not Expo Go) + `@react-native-firebase` (native-bridge Firebase SDK, not the `firebase` web SDK) for the app itself, chosen specifically for genuine offline persistence that survives app restarts — the web SDK can't do this on React Native (no IndexedDB). This has one major consequence for how code must be written and tested (see below).

**`@react-native-firebase` is modular-only and native-bridge.** Two things every task in this codebase has to account for:
1. RNFB v22+ dropped the old namespaced API (`firestore().collection().doc()`, `auth().signIn...()`). Only the modular API exists (`collection(db, path)`, `doc(...)`, `getAuth(app)`, etc. — mirrors the Firebase JS SDK v9+ surface). `src/firebase/config.ts` exports already-initialized `auth`/`firestore` instances, not callables — do not write `auth()` or `firestore()`, just `auth`/`firestore`.
2. RNFB's JS API is a native bridge — it only runs inside a real native app process on a device/emulator, never inside Jest/Node under any API style. Code in `src/household/` that touches Firestore is unit-tested by **mocking** `@react-native-firebase/firestore`'s modular functions (see `__tests__/householdService.test.ts`), not by hitting a real emulator.

**Firestore security rules are tested differently, and are the layer that actually proves access control works.** `firestore.rules` is tested via `__tests__/firestore.rules.test.ts` using the **web** `firebase` package (pure JS, Jest-compatible) through `@firebase/rules-unit-testing` against the real Firestore emulator — this works because rules enforce identically regardless of which SDK wrote the request. This is a separate dependency from `@react-native-firebase/firestore`, only used in this one test file.

**Data model:** `households/{householdId}` documents hold a `members: HouseholdMember[]` array; everything else in the app will nest under a household. Access control lives entirely in `firestore.rules`'s `isMember()` check against that array — anyone building a new collection under a household must extend the existing `match /households/{householdId}` rules block rather than adding a separate top-level collection, unless there's a specific reason not to (see the `inviteCodes` exception below).

**Household join flow, and why it's shaped the way it is:** joining a household by invite code does NOT query `households` filtered by `inviteCode`. Firestore rejects a `list`/query request unless the security rule is provably true for every document the query could structurally match, not just the actual match — since membership can't be proven for arbitrary households, that query is rejected outright for any non-member. Instead, a separate `inviteCodes/{code} -> { householdId }` collection (readable by any signed-in user) resolves the code via a single-document `get()`, and `joinHousehold` updates the household using Firestore's server-side `arrayUnion(newMember)` rather than a client-computed array — the joining client never needs read access to the household document. The rules' `isJoining()` function additionally requires `.hasAll(existingMembers)` on any non-member update, so a write can only ever *add* the requester, never drop or replace an existing member. Do not "simplify" this back to a direct query or a client-computed members array — both were tried and found broken by review (full history in the plan's Revision log).

## Testing

- `__tests__/household.types.test.ts`, `__tests__/householdService.test.ts` — real Jest, run and pass normally; the latter mocks Firestore rather than using a real one (see Architecture above)
- `__tests__/firestore.rules.test.ts` — requires the Firebase Local Emulator Suite (`firebase emulators:exec --only firestore "..."`) and a JRE; running plain `npx jest` against it will fail on connection refused, not a code defect
