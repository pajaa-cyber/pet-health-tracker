# Pet Health Tracker — Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the app shell — project scaffold, Firebase wiring, household data model, and email/password auth with household create/join — so later plans can build pet records on top of a working, tested foundation.

**Architecture:** Expo-managed React Native app using the **prebuild** workflow (not Expo Go) so we can use `@react-native-firebase` (the native Firebase SDK wrapper) instead of the web `firebase` JS SDK. This is a deliberate choice: the spec requires reliable offline persistence that survives app restarts, which the web JS SDK cannot do on React Native (no IndexedDB); `@react-native-firebase` gives genuine native offline persistence. Consequence: local development uses `npx expo run:ios` / `npx expo run:android` (or EAS dev builds), not the Expo Go app.

**Tech Stack:** Expo (TypeScript, prebuild/dev-client workflow), `@react-native-firebase/app`, `/auth`, `/firestore`, React Navigation, Jest + `@firebase/rules-unit-testing` against the Firebase Local Emulator Suite.

**Spec:** [docs/superpowers/specs/2026-09-11-pet-health-app-design.md](../specs/2026-09-11-pet-health-app-design.md)

## Global Constraints

- Client: React Native via Expo, prebuild/dev-client workflow (spec: offline-first is a hard requirement)
- Backend: Firebase — Firestore, Auth, Cloud Functions, Cloud Storage, FCM (spec: Approach section)
- Data model root: `households/{householdId}` with `members: [userId, ...]`; all pet data nests under `households/{householdId}/pets/{petId}` (spec: Data model section)
- Access control: only users listed in a household's `members` array may read/write that household's data (spec: Data model section)
- Free tier must never lock users out of data they already entered (spec: Monetization — informs that auth/household code must not gate reads behind subscription checks)
- Language: TypeScript throughout (plan-level choice for type safety across the Firestore data model)

---

## File Structure

```
app/
  app.json
  package.json
  tsconfig.json
  firebase.json                    # emulator suite config
  firestore.rules
  firestore.indexes.json
  src/
    firebase/
      config.ts                   # RNFB module re-exports (auth(), firestore())
    types/
      household.ts                # Household, HouseholdMember types
    household/
      householdService.ts         # createHousehold, joinHousehold, getHousehold, generateInviteCode
    auth/
      AuthContext.tsx             # React context: user, initializing, signUp, signIn, signOut
      SignInScreen.tsx
      SignUpScreen.tsx
    navigation/
      RootNavigator.tsx           # Auth stack vs Main stack based on AuthContext state
      HouseholdSetupScreen.tsx    # shown post-signup: create household or join via code
  __tests__/
    householdService.test.ts
    firestore.rules.test.ts
```

---

### Task 1: Project scaffold with prebuild workflow

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `App.tsx`, `.gitignore`

**Interfaces:**
- Produces: a running Expo TypeScript project with `@react-native-firebase/app` installed and native projects generated, launchable via `npx expo run:android` (or `run:ios` on macOS).

- [ ] **Step 1: Create the Expo TypeScript project**

```bash
npx create-expo-app@latest . --template blank-typescript
```

Run inside `C:\Users\PC\OneDrive\Desktop\app` (already git-initialized — accept prompts to use the current directory).

- [ ] **Step 2: Install Firebase native SDK and navigation dependencies**

```bash
npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context
```

- [ ] **Step 3: Add the config plugin and prebuild**

Edit `app.json`, add to the `expo.plugins` array:

```json
["@react-native-firebase/app"]
```

Then run:

```bash
npx expo prebuild
```

This generates `android/` and `ios/` native project directories.

- [ ] **Step 4: Verify the app boots**

```bash
npx expo run:android
```

Expected: app builds and launches in an emulator/device showing the default Expo template screen.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo TypeScript project with RNFB prebuild"
```

---

### Task 2: Firebase project wiring

**Files:**
- Create: `src/firebase/config.ts`
- Modify: `android/app/google-services.json` (placeholder — real file supplied by user from Firebase console), `ios/GoogleService-Info.plist` (placeholder)
- Create: `.env.example`

**Interfaces:**
- Produces: `import { auth, firestore } from '../firebase/config'` — `auth` is the `@react-native-firebase/auth` module instance, `firestore` is the `@react-native-firebase/firestore` module instance, both pre-configured for offline persistence.

- [ ] **Step 1: Document the manual Firebase console step**

Create `.env.example` with a comment block (no secrets committed — RNFB reads config from the native `google-services.json` / `GoogleService-Info.plist` files, not JS env vars):

```
# RNFB reads Firebase config from native config files, not env vars.
# 1. Create a Firebase project at https://console.firebase.google.com
# 2. Add an Android app (package name must match app.json's android.package)
#    -> download google-services.json into android/app/
# 3. Add an iOS app (bundle id must match app.json's ios.bundleIdentifier)
#    -> download GoogleService-Info.plist into ios/
# 4. Enable Firestore, Authentication (Email/Password provider), Storage,
#    and Cloud Messaging in the Firebase console.
```

- [ ] **Step 2: Add placeholder native config files to .gitignore**

Add to `.gitignore`:

```
android/app/google-services.json
ios/GoogleService-Info.plist
```

(These contain per-environment project identifiers and should not be committed; each developer/CI environment supplies its own.)

- [ ] **Step 3: Write the Firestore offline persistence config**

```typescript
// src/firebase/config.ts
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

firestore().settings({
  persistence: true,
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
});

export { auth, firestore };
```

- [ ] **Step 4: Commit**

```bash
git add src/firebase/config.ts .env.example .gitignore
git commit -m "feat: wire Firebase client config with offline persistence"
```

Note: this task cannot be fully verified end-to-end until a real Firebase project's config files exist locally (Task 6 covers emulator-based testing, which does not require these). Flag to the user that they need to complete Step 1's console setup before running against production Firebase.

---

### Task 3: Household and member types

**Files:**
- Create: `src/types/household.ts`
- Test: `__tests__/household.types.test.ts` (compile-only smoke test)

**Interfaces:**
- Produces: `Household`, `HouseholdMember` types used by `householdService.ts` (Task 4) and all later plans.

- [ ] **Step 1: Write the types**

```typescript
// src/types/household.ts
export interface HouseholdMember {
  userId: string;
  displayName: string;
  joinedAt: number; // epoch millis
}

export interface Household {
  id: string;
  name: string;
  members: HouseholdMember[];
  inviteCode: string;
  createdAt: number;
}
```

- [ ] **Step 2: Write a compile-only smoke test**

```typescript
// __tests__/household.types.test.ts
import { Household, HouseholdMember } from '../src/types/household';

describe('household types', () => {
  it('constructs a valid Household object', () => {
    const member: HouseholdMember = {
      userId: 'u1',
      displayName: 'Ana',
      joinedAt: Date.now(),
    };
    const household: Household = {
      id: 'h1',
      name: "Ana's Household",
      members: [member],
      inviteCode: 'ABC123',
      createdAt: Date.now(),
    };
    expect(household.members).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx jest __tests__/household.types.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/types/household.ts __tests__/household.types.test.ts
git commit -m "feat: add Household and HouseholdMember types"
```

---

### Task 4: Household service (create/join) against mocked Firestore

**Files:**
- Create: `src/household/householdService.ts`
- Test: `__tests__/householdService.test.ts`

**Interfaces:**
- Consumes: `Household`, `HouseholdMember` from `src/types/household.ts` (Task 3); the `Firestore` type from `@react-native-firebase/firestore`
- Produces: `createHousehold(db: Firestore, userId: string, displayName: string, householdName: string): Promise<Household>`, `joinHousehold(db: Firestore, userId: string, displayName: string, inviteCode: string): Promise<Household>`, `getHousehold(db: Firestore, householdId: string): Promise<Household | null>` — all imported by `HouseholdSetupScreen.tsx` (Task 7).

**Testing-approach note (revision — see plan-wide ruling below Task 2's commit):** `@react-native-firebase/firestore` is a native-bridge module and cannot execute inside Jest/Node (there is no running native host to bridge to), so this task's tests mock the modular Firestore functions and assert `householdService.ts` calls them with the correct arguments and returns the correct shape, rather than hitting a real Firestore emulator. Task 5 separately verifies the actual `firestore.rules` security behavior against the real emulator using the Firebase **web** SDK (which is pure JS and runs fine in Jest) — that is the layer that proves access control actually works end-to-end. This task proves `householdService.ts`'s own logic (invite-code generation, member-list construction, correct Firestore call shape) is correct.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/householdService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockDocRef = { id: 'generated-id' };
const mockCollectionRef = {};
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: jest.fn((ref) => ref),
  where: jest.fn(),
  limit: jest.fn(),
}));

import { createHousehold, joinHousehold, getHousehold } from '../src/household/householdService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('householdService', () => {
  it('creates a household with the creator as its first member', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.members).toEqual([
      expect.objectContaining({ userId: 'user-1', displayName: 'Ana' }),
    ]);
    expect(household.inviteCode).toHaveLength(6);
    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, household);
  });

  it('lets a second user join via invite code', async () => {
    const existingHousehold = {
      id: 'h1',
      name: "Ana's Household",
      members: [{ userId: 'user-1', displayName: 'Ana', joinedAt: 0 }],
      inviteCode: 'ABC123',
      createdAt: 0,
    };
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ ref: mockDocRef, data: () => existingHousehold }],
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    const joined = await joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123');

    expect(joined.id).toBe('h1');
    expect(joined.members).toHaveLength(2);
    expect(joined.members.map((m) => m.userId)).toEqual(['user-1', 'user-2']);
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, { members: joined.members });
  });

  it('throws when the invite code does not match any household', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    await expect(
      joinHousehold(fakeDb, 'user-2', 'Marko', 'ZZZZZZ')
    ).rejects.toThrow('Invite code not found');
  });

  it('returns null from getHousehold when the document does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await getHousehold(fakeDb, 'missing-id');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/householdService.test.ts`
Expected: FAIL with "Cannot find module '../src/household/householdService'"

- [ ] **Step 3: Implement the service**

```typescript
// src/household/householdService.ts
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, limit, type Firestore } from '@react-native-firebase/firestore';
import { Household, HouseholdMember } from '../types/household';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createHousehold(
  db: Firestore,
  userId: string,
  displayName: string,
  householdName: string
): Promise<Household> {
  const member: HouseholdMember = { userId, displayName, joinedAt: Date.now() };
  const docRef = doc(collection(db, 'households'));
  const household: Household = {
    id: docRef.id,
    name: householdName,
    members: [member],
    inviteCode: generateInviteCode(),
    createdAt: Date.now(),
  };
  await setDoc(docRef, household);
  return household;
}

export async function joinHousehold(
  db: Firestore,
  userId: string,
  displayName: string,
  inviteCode: string
): Promise<Household> {
  const q = query(collection(db, 'households'), where('inviteCode', '==', inviteCode), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Invite code not found');
  }

  const docRef = snapshot.docs[0].ref;
  const household = snapshot.docs[0].data() as Household;
  const newMember: HouseholdMember = { userId, displayName, joinedAt: Date.now() };
  const updatedMembers = [...household.members, newMember];

  await updateDoc(docRef, { members: updatedMembers });
  return { ...household, members: updatedMembers };
}

export async function getHousehold(
  db: Firestore,
  householdId: string
): Promise<Household | null> {
  const docSnap = await getDoc(doc(db, 'households', householdId));
  return docSnap.exists() ? (docSnap.data() as Household) : null;
}
```

If the installed `@react-native-firebase/firestore` version names any of `collection`/`doc`/`setDoc`/`getDoc`/`getDocs`/`updateDoc`/`query`/`where`/`limit`/`Firestore` differently, check its type declarations under `node_modules/@react-native-firebase/firestore` for the actual export names before finalizing — the business logic and function signatures above are the requirement; only the exact import names are conditional on what's actually installed (Task 2's `config.ts` already imports `getFirestore`/`initializeFirestore` successfully from this same package, confirming this modular surface exists).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/householdService.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/household/householdService.ts __tests__/householdService.test.ts
git commit -m "feat: add household create/join service with mocked-Firestore unit tests"
```

---

### Task 5: Household security rules against the Firebase emulator

**Files:**
- Create: `firebase.json`, `firestore.rules`
- Test: `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Consumes: the `households/{householdId}` document shape from Task 4 (`members: HouseholdMember[]`)
- Produces: enforced access control that all later plans' pet-data rules build on (rules for `households/{householdId}/pets/**` will extend this file in Plan 2)

**Testing-approach note:** this test uses the Firebase **web** JS SDK (`firebase/firestore`) via `@firebase/rules-unit-testing`, a separate, additional dependency from `@react-native-firebase/firestore` (which the app itself uses and which cannot run in Jest/Node — see Task 4's note). Security rules are enforced server-side and behave identically no matter which client SDK wrote the request, so testing them with the Jest/Node-compatible web SDK is the standard, correct way to verify `firestore.rules` in isolation.

- [ ] **Step 1: Install the Firebase Local Emulator Suite and test dependencies**

```bash
npm install -g firebase-tools
npm install --save-dev @firebase/rules-unit-testing firebase jest ts-jest @types/jest
firebase init emulators
```

When prompted, select Firestore and Authentication emulators, use default ports.

Create/confirm `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": { "port": 8080 },
    "auth": { "port": 9099 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 2: Write a permissive placeholder rules file (tightened later in this task)**

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

- [ ] **Step 3: Write the failing rules test**

```typescript
// __tests__/firestore.rules.test.ts
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pet-health-test',
    firestore: {
      host: 'localhost',
      port: 8080,
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('household security rules', () => {
  const seedHousehold = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'households', 'h1'), {
        id: 'h1',
        name: 'Test Household',
        members: [{ userId: 'user-1', displayName: 'Ana', joinedAt: 0 }],
        inviteCode: 'ABC123',
        createdAt: 0,
      });
    });
  };

  it('allows a member to read their household', async () => {
    await seedHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'households', 'h1')));
  });

  it('denies a non-member from reading the household', async () => {
    await seedHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households', 'h1')));
  });

  it('denies unauthenticated reads', async () => {
    await seedHousehold();
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'households', 'h1')));
  });

  it('allows any authenticated user to create a household naming themselves as a member', async () => {
    const creatorDb = testEnv.authenticatedContext('user-3').firestore();
    await assertSucceeds(
      setDoc(doc(creatorDb, 'households', 'h2'), {
        id: 'h2',
        name: 'New Household',
        members: [{ userId: 'user-3', displayName: 'Marko', joinedAt: 0 }],
        inviteCode: 'ZZZ999',
        createdAt: 0,
      })
    );
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `firebase emulators:exec --only firestore "npx jest __tests__/firestore.rules.test.ts"`
Expected: FAIL (permissive placeholder rules allow the "denies" assertions to fail, since `assertFails` expects rejection but placeholder allows everything)

- [ ] **Step 5: Write the real rules**

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isMember(householdData) {
      return request.auth != null &&
        householdData.members.filter(m => m.userId == request.auth.uid).size() > 0;
    }

    match /households/{householdId} {
      allow read: if isMember(resource.data);
      allow create: if request.auth != null &&
        request.resource.data.members.filter(m => m.userId == request.auth.uid).size() > 0;
      allow update: if isMember(resource.data);
      allow delete: if false;
    }
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `firebase emulators:exec --only firestore "npx jest __tests__/firestore.rules.test.ts"`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add firebase.json firestore.rules __tests__/firestore.rules.test.ts package.json package-lock.json
git commit -m "feat: enforce household membership in Firestore security rules"
```

---

### Task 6: Auth context

**Files:**
- Create: `src/auth/AuthContext.tsx`

**Interfaces:**
- Consumes: `auth` (an already-initialized `Auth` instance) from `src/firebase/config.ts` (Task 2)
- Produces: `AuthProvider` component and `useAuth()` hook returning `{ user: AuthUser | null, initializing: boolean, signUp(email, password): Promise<void>, signIn(email, password): Promise<void>, signOut(): Promise<void> }` (`AuthUser` defined below) — consumed by `RootNavigator.tsx` and the screens in Task 7.

- [ ] **Step 1: Write the context**

```typescript
// src/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import { auth } from '../firebase/config';

// Derived structurally from createUserWithEmailAndPassword's own return type
// instead of importing a library type name by hand — this stays correct
// regardless of what the installed package happens to name its user type.
type AuthUser = Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'];

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    initializing,
    signUp: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signOut: async () => {
      await firebaseSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

If the installed `@react-native-firebase/auth` version names `onAuthStateChanged`/`createUserWithEmailAndPassword`/`signInWithEmailAndPassword`/`signOut` differently, check its type declarations under `node_modules/@react-native-firebase/auth` for the actual export names (Task 2's `config.ts` already imports `getAuth` successfully from this same package, confirming this modular surface exists) — the business logic above is the requirement; only exact import names are conditional on what's installed.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/auth/AuthContext.tsx
git commit -m "feat: add auth context wrapping RNFB modular email/password auth"
```

(No automated test here — this is a thin wrapper over RNFB's own tested auth methods; its behavior is exercised by the manual verification in Task 7 Step 5.)

---

### Task 7: Sign up, sign in, and household setup screens + navigation

**Files:**
- Create: `src/auth/SignInScreen.tsx`, `src/auth/SignUpScreen.tsx`
- Create: `src/navigation/HouseholdSetupScreen.tsx`, `src/navigation/RootNavigator.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 6; `createHousehold`, `joinHousehold`, `getHousehold` from Task 4; `firestore` (an already-initialized `Firestore` instance, not a callable) from Task 2
- Produces: `RootNavigator` default export mounted in `App.tsx` — the entry point later plans' "Main" stack will be added to.

- [ ] **Step 1: Sign-up screen**

```typescript
// src/auth/SignUpScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAuth } from './AuthContext';

export function SignUpScreen({ navigation }: any) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await signUp(email, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Sign Up" onPress={handleSubmit} />
      <Button title="Already have an account? Sign In" onPress={() => navigation.navigate('SignIn')} />
    </View>
  );
}
```

- [ ] **Step 2: Sign-in screen**

```typescript
// src/auth/SignInScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAuth } from './AuthContext';

export function SignInScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Sign In" onPress={handleSubmit} />
      <Button title="Need an account? Sign Up" onPress={() => navigation.navigate('SignUp')} />
    </View>
  );
}
```

- [ ] **Step 3: Household setup screen**

```typescript
// src/navigation/HouseholdSetupScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { createHousehold, joinHousehold } from '../household/householdService';
import { firestore } from '../firebase/config';

export function HouseholdSetupScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!user) return;
    setError(null);
    try {
      await createHousehold(firestore, user.uid, user.email ?? 'Owner', name);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleJoin = async () => {
    if (!user) return;
    setError(null);
    try {
      await joinHousehold(firestore, user.uid, user.email ?? 'Member', inviteCode);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Button title="Create a new household" onPress={() => setMode('create')} />
      <Button title="Join an existing household" onPress={() => setMode('join')} />
      {mode === 'create' ? (
        <>
          <TextInput placeholder="Household name" value={name} onChangeText={setName} />
          <Button title="Create" onPress={handleCreate} />
        </>
      ) : (
        <>
          <TextInput placeholder="Invite code" value={inviteCode} onChangeText={setInviteCode} />
          <Button title="Join" onPress={handleJoin} />
        </>
      )}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
```

Note: this screen does not yet navigate away on success — Plan 2 adds the "Main" stack (pet list) it should transition to once a household exists. For this plan, success is verified manually (Step 5) by confirming the household document appears in Firestore.

- [ ] **Step 4: Root navigator**

```typescript
// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { SignInScreen } from '../auth/SignInScreen';
import { SignUpScreen } from '../auth/SignUpScreen';
import { HouseholdSetupScreen } from './HouseholdSetupScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 5: Wire up App.tsx and verify manually**

```typescript
// App.tsx
import React from 'react';
import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
```

Run: `npx expo run:android` (against a real Firebase project — requires Task 2 Step 1's console setup to be complete). Manually: sign up with a test email, confirm the Household Setup screen appears, create a household, confirm in the Firebase console's Firestore tab that a `households/{id}` document was created with your user in `members`.

- [ ] **Step 6: Commit**

```bash
git add App.tsx src/auth/SignInScreen.tsx src/auth/SignUpScreen.tsx src/navigation/
git commit -m "feat: add sign up/in and household setup screens with root navigation"
```

---

## Self-Review Notes

- **Spec coverage:** This plan covers the spec's Approach (stack decision + rationale for RNFB over JS SDK), Data model's `households` root, and Non-goals are untouched. Pet-level collections (vaccines, medications, vetVisits, weightLogs, expenses), the 8 core screens beyond auth/household-setup, notifications, and monetization gating are explicitly **out of scope** for this plan — they are Plan 2 ("Pet Records Core") and Plan 3 ("Reminders & Notifications"), to be written after this plan is implemented and verified.
- **Type consistency:** `Household`/`HouseholdMember` (Task 3) are used identically by `householdService.ts` (Task 4), the rules test's seed data (Task 5), and `HouseholdSetupScreen.tsx` (Task 7).
- **No placeholders:** every step has runnable code; the one manual-verification step (Task 7 Step 5) is manual because it requires a real Firebase project's native config files, which cannot exist until the user completes the one-time console setup documented in Task 2.

### Revision log

**2026-09-11, after Task 2's implementation and review:** Tasks 4-7 were
rewritten from their original draft. Two problems surfaced once real
package versions were installed:

1. `@react-native-firebase` v26 (the version `expo install` resolved) ships
   only the **modular** API — the namespaced API these tasks originally
   assumed (`FirebaseFirestoreTypes.Module`, `FirebaseAuthTypes.User`,
   `db.collection().doc()` chaining, `auth().signIn...()`) does not exist
   in the installed package at all.
2. More fundamentally, `@react-native-firebase/*` is a **native-bridge**
   module — its JS API only works inside a running native app on a device
   or emulator. It cannot execute inside Jest/Node under any API style,
   which the original Task 4 draft's plan to test it against a real
   Firestore emulator from Jest did not account for.

Fix applied: Task 4's app code now uses the modular
`@react-native-firebase/firestore` API, and its tests mock that module
instead of hitting a real emulator (verifies call-shape and business logic,
not live Firestore behavior). Task 5 — which only needs to prove
`firestore.rules` itself is correct, independent of which SDK wrote the
data — now uses the Firebase **web** SDK (`firebase/firestore`, pure JS,
Jest-compatible) against the real emulator via `@firebase/rules-unit-testing`;
this is the layer that actually proves the household access-control
boundary works. Task 6 was rewritten to modular RNFB auth functions, with
the user type derived structurally from a function return type
(`Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user']`)
rather than importing a hand-guessed library type name, so it stays correct
even if the exact type export name isn't known in advance. Task 7's
`HouseholdSetupScreen` was updated to pass `firestore` as an instance
(`createHousehold(firestore, ...)`), not call it as a function
(`firestore()`), matching Task 2's actual export shape.
