# Pet Health Tracker — Pet Records Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the per-pet data model (pets, vaccines, medications, vet visits, weight logs, expenses) and the screens to view/add each, on top of Plan 1's household foundation — so a signed-in household member can add a pet and start logging real care data.

**Architecture:** Every pet-data collection nests under `households/{householdId}/pets/{petId}` per the spec's data model. Unlike Plan 1's household join flow (which had to defend against *non-members* writing to gain membership), every collection in this plan is only ever touched by users who are *already* verified household members — there is no analogous "untrusted write" path, so `firestore.rules` for this plan is much simpler: one `isHouseholdMember(householdId)` helper (a cross-document `get()` on the ancestor household doc) gates read/write on every pet subcollection, with per-type field allowlists to prevent schema drift. Real-time sharing (spec requirement: multiple household members see live updates) is implemented via Firestore `onSnapshot` listeners wrapped in small React hooks, mirroring the `onAuthStateChanged` subscription pattern already established in `AuthContext.tsx`. Reminder computation (Cloud Functions, push notifications) is explicitly out of scope — that's Plan 3.

**Tech Stack:** Same as Plan 1 (Expo prebuild/dev-client, `@react-native-firebase/firestore` modular API, React Navigation, Jest with mocked Firestore for service logic + `@firebase/rules-unit-testing` against the real emulator for rules). Task 14 additionally adds `@react-native-firebase/storage` and `expo-image-picker`.

**Spec:** [docs/superpowers/specs/2026-09-11-pet-health-app-design.md](../specs/2026-09-11-pet-health-app-design.md)

## Global Constraints

- Data model: `households/{householdId}/pets/{petId}`, with `vaccines/`, `medications/`, `vetVisits/`, `weightLogs/`, `expenses/` as subcollections of each pet (spec: Data model section; path nesting per Plan 1's Global Constraints, which this plan inherits).
- Access control: every pet subcollection is readable/writable only by users listed in the owning household's `members` array (spec: Data model section — "Access control").
- Offline-first: all writes go through the already-configured `firestore` instance from `src/firebase/config.ts` (Task 2 of Plan 1), which has offline persistence enabled — no additional wiring needed per task.
- Real-time family sharing: list/detail screens subscribe via `onSnapshot`, not one-shot `getDocs`, so every household member sees live updates (spec: Goals #2).
- Species beyond dogs/cats must not be hard-blocked (spec: Non-goals).
- Language: TypeScript throughout, matching Plan 1.
- Out of scope for this plan (deferred to Plan 3 — "Reminders & Notifications"): Cloud Functions, Cloud Scheduler, FCM push, and any server-computed due-date/reminder logic. Screens may display data already in Firestore (e.g. a vaccine's stored `nextDueDate`) but must not compute or push reminders themselves.
- Out of scope for this plan (deferred, non-goal per spec): subscription/monetization gating, grooming/training/behavior tracking, vet clinic integrations.

---

## File Structure

```
src/
  types/
    pet.ts
    vaccine.ts
    medication.ts
    vetVisit.ts
    weightLog.ts
    expense.ts
  household/
    householdService.ts        # MODIFIED: writes users/{uid} household pointer
    HouseholdContext.tsx        # NEW: useHousehold() hook
  pets/
    petService.ts
    vaccineService.ts
    medicationService.ts
    vetVisitService.ts
    weightLogService.ts
    expenseService.ts
    WeightTrendChart.tsx        # hand-rolled bar chart, no new dependency
  navigation/
    RootNavigator.tsx           # MODIFIED: branches on household membership too
    MainNavigator.tsx           # NEW: pet list -> pet home -> per-record screens
    PetListScreen.tsx
    AddPetScreen.tsx
    PetHomeScreen.tsx
    VaccineListScreen.tsx
    AddVaccineScreen.tsx
    MedicationListScreen.tsx
    AddMedicationScreen.tsx
    WeightLogScreen.tsx
    ExpenseListScreen.tsx
    AddExpenseScreen.tsx
    VetVisitListScreen.tsx
    AddVetVisitScreen.tsx
firestore.rules                 # MODIFIED: users/{uid} + pets/** rules added
storage.rules                   # NEW (Task 14)
__tests__/
  petService.test.ts
  vaccineService.test.ts
  medicationService.test.ts
  weightLogService.test.ts
  expenseService.test.ts
  vetVisitService.test.ts
  firestore.rules.test.ts       # MODIFIED: extended with new tests
```

---

### Task 1: Household membership pointer + `useHousehold()` context

**Files:**
- Modify: `src/household/householdService.ts`, `firestore.rules`, `__tests__/householdService.test.ts`, `__tests__/firestore.rules.test.ts`
- Create: `src/household/HouseholdContext.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `src/auth/AuthContext.tsx` (Plan 1 Task 6); `firestore` from `src/firebase/config.ts` (Plan 1 Task 2)
- Produces: `HouseholdProvider` component and `useHousehold()` hook returning `{ household: Household | null, loading: boolean }` — consumed by `RootNavigator.tsx` (Task 3) and any screen needing the current household's data.

**Why this task exists:** after Plan 1, there is no way for the app to know, on a fresh launch, which household a signed-in user belongs to — `createHousehold`/`joinHousehold` only return/update state for the current session. Firestore can't answer this with a query (a `where('members', 'array-contains', ...)` query would need to exact-match the whole member object including `joinedAt`, and even if it could, `isMember`-based list-query provability has the same "rejected for the whole potential result set" problem documented in Plan 1's revision log for the old invite-code lookup). Fix: the same pattern already used for invite codes — a single-document `get()` by known ID (`users/{uid}`), not a query.

- [ ] **Step 1: Write the failing test for the household-pointer write**

Add to `__tests__/householdService.test.ts` (extend the existing mock setup — add `mockUsersDocRef` and update the `doc` mock's routing, and switch `joinHousehold`'s test to expect a batch instead of a bare `updateDoc`):

```typescript
// __tests__/householdService.test.ts — replace the existing mock block and
// the two tests that reference joinHousehold/createHousehold's writes with:
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'generated-id' };
const mockInviteDocRef = { id: 'invite-ref' };
const mockHouseholdDocRef = { id: 'h1' };
const mockUsersDocRef = { id: 'users-ref' };
const mockCollectionRef = {};
const mockGetDoc = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn(() => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, path?: string) => {
    if (path === 'inviteCodes') return mockInviteDocRef;
    if (path === 'households') return mockHouseholdDocRef;
    if (path === 'users') return mockUsersDocRef;
    return mockCreatedDocRef;
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { createHousehold, joinHousehold } from '../src/household/householdService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
});

describe('householdService', () => {
  it('creates a household, its invite code, and a users/{uid} pointer in one batch', async () => {
    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedDocRef, household);
    expect(mockBatchSet).toHaveBeenCalledWith(mockInviteDocRef, { householdId: 'generated-id' });
    expect(mockBatchSet).toHaveBeenCalledWith(mockUsersDocRef, { householdId: 'generated-id' });
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('joins a household and writes the users/{uid} pointer in the same batch', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ householdId: 'h1' }) });

    await joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123');

    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, {
      members: { __arrayUnion: [expect.objectContaining({ userId: 'user-2' })] },
      joinCodeUsed: 'ABC123',
    });
    expect(mockBatchSet).toHaveBeenCalledWith(mockUsersDocRef, { householdId: 'h1' });
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('throws when the invite code does not match any household', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await expect(joinHousehold(fakeDb, 'user-2', 'Marko', 'ZZZZZZ')).rejects.toThrow(
      'Invite code not found'
    );
  });
});
```

(Leave `getHousehold`'s existing test untouched — it isn't affected by this change; if the current test file mocks `updateDoc` separately, remove that mock since `joinHousehold` no longer calls it directly.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/householdService.test.ts`
Expected: FAIL — `createHousehold`/`joinHousehold` don't yet write a `users/{uid}` doc.

- [ ] **Step 3: Update `householdService.ts`**

```typescript
// src/household/householdService.ts — add to createHousehold's batch (inside
// the existing retry loop, alongside the two existing batch.set calls):
    batch.set(doc(db, 'users', userId), { householdId: docRef.id });
```

```typescript
// src/household/householdService.ts — replace joinHousehold's body:
export async function joinHousehold(
  db: Firestore,
  userId: string,
  displayName: string,
  inviteCode: string
): Promise<void> {
  const inviteSnap = await getDoc(doc(db, 'inviteCodes', inviteCode));

  if (!inviteSnap.exists()) {
    throw new Error('Invite code not found');
  }

  const { householdId } = inviteSnap.data() as { householdId: string };
  const newMember: HouseholdMember = { userId, displayName, joinedAt: Date.now() };

  const batch = writeBatch(db);
  batch.update(doc(db, 'households', householdId), {
    members: arrayUnion(newMember),
    joinCodeUsed: inviteCode,
  });
  batch.set(doc(db, 'users', userId), { householdId });
  await batch.commit();
}
```

`writeBatch` is already imported in this file (used by `createHousehold`) — no new import needed.

**Important:** because `users/{uid}` is created with `allow create: if <doc doesn't already exist>` (Step 5 below), a user who is already in a household and tries to `createHousehold`/`joinHousehold` again will have the WHOLE batch rejected (the `users/{uid}` write is evaluated as an `update`, which is denied) — this is an intentional, free enforcement of "one household per user" for this plan's scope, not a bug. `RootNavigator` (Task 3) already prevents a user with a household from reaching `HouseholdSetupScreen` in normal use; this is a defense-in-depth backstop, not the primary UX gate. Document this in the commit message.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/householdService.test.ts`
Expected: PASS

- [ ] **Step 5: Extend `firestore.rules`**

```
// firestore.rules — add this match block (order doesn't matter, but placing
// it near the households block keeps related rules together):
    match /users/{userId} {
      // A single-document get() by known uid, not a query — mirrors the
      // inviteCodes pattern from Plan 1. Only the user themselves may ever
      // read their own pointer; list is explicitly denied so this can never
      // be enumerated to discover other users' household membership.
      allow get: if request.auth != null && request.auth.uid == userId;
      allow list: if false;
      // Only fires when the document does not yet exist (Firestore classifies
      // a write to an existing doc as `update`, not `create`) — so a user who
      // already belongs to a household cannot overwrite their pointer via this
      // rule. Changing households (leaving one, joining another) is out of
      // scope for this plan; that needs its own explicit "leave household"
      // design, parked as a future task.
      allow create: if request.auth != null && request.auth.uid == userId &&
        request.resource.data.keys().hasOnly(['householdId']);
      allow update, delete: if false;
    }
```

- [ ] **Step 6: Extend the rules test file**

Add to `__tests__/firestore.rules.test.ts`:

```typescript
  it('allows a user to create their own users/{uid} household pointer', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(userDb, 'users', 'user-1'), { householdId: 'h1' })
    );
  });

  it('denies a user from creating a household pointer for someone else', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(userDb, 'users', 'user-2'), { householdId: 'h1' })
    );
  });

  it('denies overwriting an existing users/{uid} pointer', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
    });
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(userDb, 'users', 'user-1'), { householdId: 'h2' })
    );
  });

  it('denies a user from reading someone else\'s household pointer', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'users', 'user-1')));
  });
```

As with every rules change in this project, this cannot be run in a sandbox without a JRE — run via `firebase emulators:exec --only firestore "npx jest __tests__/firestore.rules.test.ts"` on a machine with Java, per the standing constraint documented in `NEXTSTEPS.md`.

- [ ] **Step 7: Write `HouseholdContext.tsx`**

```typescript
// src/household/HouseholdContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from '@react-native-firebase/firestore';
import { firestore } from '../firebase/config';
import { useAuth } from '../auth/AuthContext';
import { Household } from '../types/household';

interface HouseholdContextValue {
  household: Household | null;
  loading: boolean;
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHouseholdId(null);
      setHousehold(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
      setHouseholdId(snap.exists() ? (snap.data() as { householdId: string }).householdId : null);
      if (!snap.exists()) setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!householdId) {
      setHousehold(null);
      return;
    }
    return onSnapshot(doc(firestore, 'households', householdId), (snap) => {
      setHousehold(snap.exists() ? (snap.data() as Household) : null);
      setLoading(false);
    });
  }, [householdId]);

  return (
    <HouseholdContext.Provider value={{ household, loading }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
}
```

Verify `onSnapshot`'s exact import name/signature against `node_modules/@react-native-firebase/firestore`'s type declarations before finalizing (same caveat as every RNFB import in this project — check, don't assume).

- [ ] **Step 8: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
git add src/household/householdService.ts src/household/HouseholdContext.tsx firestore.rules __tests__/householdService.test.ts __tests__/firestore.rules.test.ts
git commit -m "feat: add users/{uid} household pointer and useHousehold() context"
```

---

### Task 2: Pet type + pet service + Firestore rules for `households/{householdId}/pets/{petId}`

**Files:**
- Create: `src/types/pet.ts`, `src/pets/petService.ts`
- Test: `__tests__/petService.test.ts`
- Modify: `firestore.rules`, `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Consumes: `Firestore` type from `@react-native-firebase/firestore`
- Produces: `Pet` type; `createPet(db, householdId, name, species, breed, birthDate): Promise<Pet>`, `subscribeToPets(db, householdId, callback: (pets: Pet[]) => void): Unsubscribe`, `getPet(db, householdId, petId): Promise<Pet | null>` — consumed by `PetListScreen.tsx`/`AddPetScreen.tsx` (Task 3) and every later record-type service in this plan (they all take a `petId` alongside `householdId`).

**Rules approach for this and every remaining task in this plan:** unlike the household join flow, every pet subcollection is only ever touched by users already confirmed to be household members — there's no "untrusted non-member trying to gain access" path, so a single `isHouseholdMember(householdId)` helper (a `get()` on the ancestor household doc) is sufficient to gate read/write; no `hasAll`/`diff`-style hijack protection is needed here, since there's no asymmetric trust boundary to defend across.

- [ ] **Step 1: Write the pet type**

```typescript
// src/types/pet.ts
export type PetSpecies = 'dog' | 'cat' | 'other';

export interface Pet {
  id: string;
  householdId: string;
  name: string;
  species: PetSpecies;
  breed: string;
  birthDate: number; // epoch millis
  photoUrl: string | null;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/petService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'pet-1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockCreatedDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createPet, getPet, subscribeToPets } from '../src/pets/petService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('petService', () => {
  it('creates a pet under the household', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const pet = await createPet(fakeDb, 'h1', 'Rex', 'dog', 'Labrador', 1000);

    expect(pet).toEqual({
      id: 'pet-1',
      householdId: 'h1',
      name: 'Rex',
      species: 'dog',
      breed: 'Labrador',
      birthDate: 1000,
      photoUrl: null,
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, pet);
  });

  it('returns null from getPet when the document does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getPet(fakeDb, 'h1', 'missing');
    expect(result).toBeNull();
  });

  it('subscribes to the pets collection and maps snapshots to Pet[]', () => {
    const callback = jest.fn();
    const fakePet = { id: 'pet-1', householdId: 'h1', name: 'Rex' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakePet }] });
      return () => {};
    });

    subscribeToPets(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([fakePet]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/petService.test.ts`
Expected: FAIL with "Cannot find module '../src/pets/petService'"

- [ ] **Step 4: Implement the service**

```typescript
// src/pets/petService.ts
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Pet, PetSpecies } from '../types/pet';

export async function createPet(
  db: Firestore,
  householdId: string,
  name: string,
  species: PetSpecies,
  breed: string,
  birthDate: number
): Promise<Pet> {
  const docRef = doc(collection(db, 'households', householdId, 'pets'));
  const pet: Pet = { id: docRef.id, householdId, name, species, breed, birthDate, photoUrl: null };
  await setDoc(docRef, pet);
  return pet;
}

export async function getPet(db: Firestore, householdId: string, petId: string): Promise<Pet | null> {
  const snap = await getDoc(doc(db, 'households', householdId, 'pets', petId));
  return snap.exists() ? (snap.data() as Pet) : null;
}

export function subscribeToPets(
  db: Firestore,
  householdId: string,
  callback: (pets: Pet[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'households', householdId, 'pets'), (snap) => {
    callback(snap.docs.map((d) => d.data() as Pet));
  });
}
```

Verify `collection()`'s variadic multi-segment-path signature (`collection(db, 'households', householdId, 'pets')`) and `Unsubscribe`'s exact export name against `node_modules/@react-native-firebase/firestore`'s type declarations — `doc()` in `householdService.ts` already uses a similar multi-segment call successfully, confirming the pattern, but check exact names before finalizing.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/petService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Extend `firestore.rules`**

```
// firestore.rules — add near the top, alongside isMember/isJoining:
    function isHouseholdMember(householdId) {
      return request.auth != null &&
        exists(/databases/$(database)/documents/households/$(householdId)) &&
        get(/databases/$(database)/documents/households/$(householdId)).data.members
          .filter(m => m.userId == request.auth.uid).size() > 0;
    }

// add this match block:
    match /households/{householdId}/pets/{petId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'householdId', 'name', 'species', 'breed', 'birthDate', 'photoUrl']);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

- [ ] **Step 7: Extend the rules test file**

```typescript
  const seedPetHousehold = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1'), {
        id: 'h1',
        name: 'Test Household',
        members: [{ userId: 'user-1', displayName: 'Ana', joinedAt: 0 }],
        inviteCode: 'ABC123',
        createdAt: 0,
      });
    });
  };

  it('allows a household member to create a pet', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1'), {
        id: 'pet-1',
        householdId: 'h1',
        name: 'Rex',
        species: 'dog',
        breed: 'Labrador',
        birthDate: 0,
        photoUrl: null,
      })
    );
  });

  it('denies a non-member from creating a pet in someone else\'s household', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1'), {
        id: 'pet-1',
        householdId: 'h1',
        name: 'Rex',
        species: 'dog',
        breed: 'Labrador',
        birthDate: 0,
        photoUrl: null,
      })
    );
  });

  it('denies a non-member from reading a pet', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'pets', 'pet-1'), {
        id: 'pet-1', householdId: 'h1', name: 'Rex', species: 'dog', breed: 'Labrador', birthDate: 0, photoUrl: null,
      });
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1')));
  });
```

- [ ] **Step 8: Commit**

```bash
git add src/types/pet.ts src/pets/petService.ts __tests__/petService.test.ts firestore.rules __tests__/firestore.rules.test.ts
git commit -m "feat: add Pet type, petService, and household-scoped pet security rules"
```

---

### Task 3: Pet list, add-pet screen, and navigation rewire

**Files:**
- Create: `src/navigation/PetListScreen.tsx`, `src/navigation/AddPetScreen.tsx`, `src/navigation/MainNavigator.tsx`
- Modify: `src/navigation/RootNavigator.tsx`, `src/navigation/HouseholdSetupScreen.tsx`, `App.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Plan 1 Task 6), `useHousehold()` (Task 1), `createPet`/`subscribeToPets` (Task 2), `firestore` (Plan 1 Task 2)
- Produces: `MainNavigator` — mounted by `RootNavigator` once a household exists; every later screen task in this plan adds a screen to this navigator.

This closes Plan 1's deferred TODO: `HouseholdSetupScreen` finally navigates somewhere real once a household exists, and `RootNavigator` gains a third branch (auth'd + has household → `MainNavigator`).

- [ ] **Step 1: Pet list screen**

```typescript
// src/navigation/PetListScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';

export function PetListScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add a pet" onPress={() => navigation.navigate('AddPet')} />
      <FlatList
        data={pets}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Text onPress={() => navigation.navigate('PetHome', { petId: item.id })}>
            {item.name} ({item.species})
          </Text>
        )}
        ListEmptyComponent={<Text>No pets yet — add one to get started.</Text>}
      />
    </View>
  );
}
```

- [ ] **Step 2: Add-pet screen**

```typescript
// src/navigation/AddPetScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createPet } from '../pets/petService';
import { firestore } from '../firebase/config';
import { PetSpecies } from '../types/pet';

export function AddPetScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    try {
      await createPet(firestore, household.id, name, species, breed, Date.now());
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Name" value={name} onChangeText={setName} />
      <Button title="Dog" onPress={() => setSpecies('dog')} />
      <Button title="Cat" onPress={() => setSpecies('cat')} />
      <Button title="Other" onPress={() => setSpecies('other')} />
      <Text>Selected species: {species}</Text>
      <TextInput placeholder="Breed" value={breed} onChangeText={setBreed} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add pet" onPress={handleSubmit} />
    </View>
  );
}
```

- [ ] **Step 3: Main navigator**

```typescript
// src/navigation/MainNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PetListScreen } from './PetListScreen';
import { AddPetScreen } from './AddPetScreen';
import { PetHomeScreen } from './PetHomeScreen';

const Stack = createNativeStackNavigator();

export function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PetList" component={PetListScreen} />
      <Stack.Screen name="AddPet" component={AddPetScreen} />
      <Stack.Screen name="PetHome" component={PetHomeScreen} />
    </Stack.Navigator>
  );
}
```

(`PetHomeScreen` doesn't exist yet — Task 15 creates it. Add a minimal placeholder now so this compiles, which Task 15 will replace: create `src/navigation/PetHomeScreen.tsx` with a bare component that Task 15 fully replaces — see that task for the final version.)

```typescript
// src/navigation/PetHomeScreen.tsx (placeholder — replaced in Task 15)
import React from 'react';
import { View, Text } from 'react-native';

export function PetHomeScreen({ route }: any) {
  return (
    <View style={{ padding: 24 }}>
      <Text>Pet home for {route.params?.petId} — record screens added in later tasks.</Text>
    </View>
  );
}
```

- [ ] **Step 4: Rewire `RootNavigator.tsx`**

```typescript
// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { SignInScreen } from '../auth/SignInScreen';
import { SignUpScreen } from '../auth/SignUpScreen';
import { HouseholdSetupScreen } from './HouseholdSetupScreen';
import { MainNavigator } from './MainNavigator';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, initializing } = useAuth();
  const { household, loading: householdLoading } = useHousehold();

  if (initializing) return null;
  if (user && householdLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!user ? (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : household ? (
          <Stack.Screen name="Main" component={MainNavigator} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 5: Make `HouseholdSetupScreen` navigate away on success**

```typescript
// src/navigation/HouseholdSetupScreen.tsx — the create/join handlers no
// longer need to do anything special: RootNavigator now re-renders itself
// once useHousehold()'s onSnapshot listener picks up the new
// users/{uid} -> households/{id} chain, automatically swapping in
// MainNavigator. No navigation.navigate() call is needed here — remove the
// stale "does not yet navigate away" comment above handleCreate/handleJoin.
```

(No functional code change required in this file beyond removing the now-inaccurate comment — the navigation happens automatically because `RootNavigator` re-renders on `useHousehold()` state changes. Confirm by reading the current file that no code changes are otherwise needed.)

- [ ] **Step 6: Wire `HouseholdProvider` into `App.tsx`**

```typescript
// App.tsx
import React from 'react';
import { AuthProvider } from './src/auth/AuthContext';
import { HouseholdProvider } from './src/household/HouseholdContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <RootNavigator />
      </HouseholdProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/navigation/PetListScreen.tsx src/navigation/AddPetScreen.tsx src/navigation/MainNavigator.tsx src/navigation/PetHomeScreen.tsx src/navigation/RootNavigator.tsx src/navigation/HouseholdSetupScreen.tsx App.tsx
git commit -m "feat: add pet list/add screens and navigate into Main once a household exists"
```

---

### Task 4: Vaccine type + service + rules

**Files:**
- Create: `src/types/vaccine.ts`, `src/pets/vaccineService.ts`
- Test: `__tests__/vaccineService.test.ts`
- Modify: `firestore.rules`, `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Consumes: `Firestore` type
- Produces: `Vaccine` type; `createVaccine(db, householdId, petId, name, dateGiven, nextDueDate, vetName): Promise<Vaccine>`, `subscribeToVaccines(db, householdId, petId, callback): Unsubscribe` — consumed by `VaccineListScreen.tsx`/`AddVaccineScreen.tsx` (Task 5).

- [ ] **Step 1: Write the type**

```typescript
// src/types/vaccine.ts
export interface Vaccine {
  id: string;
  petId: string;
  name: string;
  dateGiven: number; // epoch millis
  nextDueDate: number | null; // epoch millis; null if not applicable
  vetName: string;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/vaccineService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'vax-1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockCreatedDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createVaccine, subscribeToVaccines } from '../src/pets/vaccineService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vaccineService', () => {
  it('creates a vaccine record under the pet', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const vaccine = await createVaccine(fakeDb, 'h1', 'pet-1', 'Rabies', 1000, 2000, 'Dr. Smith');

    expect(vaccine).toEqual({
      id: 'vax-1',
      petId: 'pet-1',
      name: 'Rabies',
      dateGiven: 1000,
      nextDueDate: 2000,
      vetName: 'Dr. Smith',
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, vaccine);
  });

  it('subscribes to a pet\'s vaccines and maps snapshots to Vaccine[]', () => {
    const callback = jest.fn();
    const fakeVaccine = { id: 'vax-1', petId: 'pet-1', name: 'Rabies' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeVaccine }] });
      return () => {};
    });

    subscribeToVaccines(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeVaccine]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/vaccineService.test.ts`
Expected: FAIL with "Cannot find module '../src/pets/vaccineService'"

- [ ] **Step 4: Implement the service**

```typescript
// src/pets/vaccineService.ts
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Vaccine } from '../types/vaccine';

export async function createVaccine(
  db: Firestore,
  householdId: string,
  petId: string,
  name: string,
  dateGiven: number,
  nextDueDate: number | null,
  vetName: string
): Promise<Vaccine> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'vaccines'));
  const vaccine: Vaccine = { id: docRef.id, petId, name, dateGiven, nextDueDate, vetName };
  await setDoc(docRef, vaccine);
  return vaccine;
}

export function subscribeToVaccines(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (vaccines: Vaccine[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'vaccines'),
    (snap) => callback(snap.docs.map((d) => d.data() as Vaccine))
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/vaccineService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Extend `firestore.rules`**

```
// firestore.rules — add:
    match /households/{householdId}/pets/{petId}/vaccines/{vaccineId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'petId', 'name', 'dateGiven', 'nextDueDate', 'vetName']);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

- [ ] **Step 7: Extend the rules test file**

```typescript
  it('allows a household member to create a vaccine record for their pet', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'vaccines', 'vax-1'), {
        id: 'vax-1', petId: 'pet-1', name: 'Rabies', dateGiven: 0, nextDueDate: 1000, vetName: 'Dr. Smith',
      })
    );
  });

  it('denies a non-member from creating a vaccine record', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'vaccines', 'vax-1'), {
        id: 'vax-1', petId: 'pet-1', name: 'Rabies', dateGiven: 0, nextDueDate: 1000, vetName: 'Dr. Smith',
      })
    );
  });
```

- [ ] **Step 8: Commit**

```bash
git add src/types/vaccine.ts src/pets/vaccineService.ts __tests__/vaccineService.test.ts firestore.rules __tests__/firestore.rules.test.ts
git commit -m "feat: add Vaccine type, vaccineService, and rules"
```

---

### Task 5: Vaccine list + add screens

**Files:**
- Create: `src/navigation/VaccineListScreen.tsx`, `src/navigation/AddVaccineScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`, `src/navigation/PetHomeScreen.tsx`

**Interfaces:**
- Consumes: `useHousehold()` (Task 1), `subscribeToVaccines`/`createVaccine` (Task 4), `firestore`

- [ ] **Step 1: Vaccine list screen**

```typescript
// src/navigation/VaccineListScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVaccines } from '../pets/vaccineService';
import { firestore } from '../firebase/config';
import { Vaccine } from '../types/vaccine';

export function VaccineListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVaccines(firestore, household.id, petId, setVaccines);
  }, [household, petId]);

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add vaccine" onPress={() => navigation.navigate('AddVaccine', { petId })} />
      <FlatList
        data={vaccines}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <Text>
            {item.name} — given {new Date(item.dateGiven).toLocaleDateString()}
            {item.nextDueDate ? `, due ${new Date(item.nextDueDate).toLocaleDateString()}` : ''}
          </Text>
        )}
        ListEmptyComponent={<Text>No vaccine records yet.</Text>}
      />
    </View>
  );
}
```

- [ ] **Step 2: Add-vaccine screen**

```typescript
// src/navigation/AddVaccineScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createVaccine } from '../pets/vaccineService';
import { firestore } from '../firebase/config';

export function AddVaccineScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [vetName, setVetName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    try {
      await createVaccine(firestore, household.id, petId, name, Date.now(), null, vetName);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Vaccine name" value={name} onChangeText={setName} />
      <TextInput placeholder="Vet name" value={vetName} onChangeText={setVetName} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add vaccine" onPress={handleSubmit} />
    </View>
  );
}
```

- [ ] **Step 3: Register the screens**

```typescript
// src/navigation/MainNavigator.tsx — add these two imports and Stack.Screen entries:
import { VaccineListScreen } from './VaccineListScreen';
import { AddVaccineScreen } from './AddVaccineScreen';
// ...inside <Stack.Navigator>, after the existing screens:
      <Stack.Screen name="VaccineList" component={VaccineListScreen} />
      <Stack.Screen name="AddVaccine" component={AddVaccineScreen} />
```

```typescript
// src/navigation/PetHomeScreen.tsx — add a link to the vaccine list (this
// file is fully replaced in Task 15, so this is an incremental addition):
import { Button } from 'react-native';
// ...inside the component's returned View, add:
      <Button title="Vaccines" onPress={() => navigation.navigate('VaccineList', { petId: route.params?.petId })} />
```

(`PetHomeScreen`'s function signature needs `navigation` alongside the existing `route` param: `export function PetHomeScreen({ route, navigation }: any) { ... }`.)

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/navigation/VaccineListScreen.tsx src/navigation/AddVaccineScreen.tsx src/navigation/MainNavigator.tsx src/navigation/PetHomeScreen.tsx
git commit -m "feat: add vaccine list/add screens"
```

---

### Task 6: Medication type (custom recurring schedule) + service + rules

**Files:**
- Create: `src/types/medication.ts`, `src/pets/medicationService.ts`
- Test: `__tests__/medicationService.test.ts`
- Modify: `firestore.rules`, `__tests__/firestore.rules.test.ts`

**Design decision (resolves the spec's open question on recurring-schedule format):** use a simple custom struct — `{ timesPerDay: number; intervalDays: number }` — instead of an RFC5545 RRULE. MVP only needs "N times a day, every M days" (daily, every-other-day, etc.); RRULE's generality (day-of-week rules, exceptions, until-dates) isn't needed yet and would add a parsing dependency for no current benefit. Due-date/next-dose computation logic is isolated to whichever function reads `schedule` later (Plan 3), so migrating to RRULE later — if a real need for weekday-specific schedules emerges — would only touch that one function, not this data model.

**Interfaces:**
- Consumes: `Firestore` type
- Produces: `Medication`, `MedicationSchedule`, `MedicationDoseLog` types; `createMedication(db, householdId, petId, name, dosage, schedule, startDate, endDate): Promise<Medication>`, `subscribeToMedications(db, householdId, petId, callback): Unsubscribe`, `logMedicationDose(db, householdId, petId, medicationId, givenBy): Promise<void>` — consumed by `MedicationListScreen.tsx`/`AddMedicationScreen.tsx` (Task 7).

- [ ] **Step 1: Write the types**

```typescript
// src/types/medication.ts
export interface MedicationSchedule {
  timesPerDay: number;
  intervalDays: number; // 1 = daily, 2 = every other day, etc.
}

export interface MedicationDoseLog {
  givenBy: string; // userId
  givenAt: number; // epoch millis
}

export interface Medication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  schedule: MedicationSchedule;
  startDate: number; // epoch millis
  endDate: number | null;
  log: MedicationDoseLog[];
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/medicationService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'med-1' };
const mockMedDocRef = { id: 'med-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'med-1-existing' ? mockMedDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
}));

import { createMedication, subscribeToMedications, logMedicationDose } from '../src/pets/medicationService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('medicationService', () => {
  it('creates a medication with an empty dose log', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const med = await createMedication(
      fakeDb, 'h1', 'pet-1', 'Amoxicillin', '250mg',
      { timesPerDay: 2, intervalDays: 1 }, 1000, null
    );

    expect(med).toEqual({
      id: 'med-1',
      petId: 'pet-1',
      name: 'Amoxicillin',
      dosage: '250mg',
      schedule: { timesPerDay: 2, intervalDays: 1 },
      startDate: 1000,
      endDate: null,
      log: [],
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, med);
  });

  it('subscribes to a pet\'s medications and maps snapshots to Medication[]', () => {
    const callback = jest.fn();
    const fakeMed = { id: 'med-1', petId: 'pet-1', name: 'Amoxicillin' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeMed }] });
      return () => {};
    });

    subscribeToMedications(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeMed]);
  });

  it('logs a dose via arrayUnion on the log field', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await logMedicationDose(fakeDb, 'h1', 'pet-1', 'med-1-existing', 'user-1');

    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({ givenBy: 'user-1' })
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockMedDocRef, {
      log: { __arrayUnion: [expect.objectContaining({ givenBy: 'user-1' })] },
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/medicationService.test.ts`
Expected: FAIL with "Cannot find module '../src/pets/medicationService'"

- [ ] **Step 4: Implement the service**

```typescript
// src/pets/medicationService.ts
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Medication, MedicationSchedule } from '../types/medication';

export async function createMedication(
  db: Firestore,
  householdId: string,
  petId: string,
  name: string,
  dosage: string,
  schedule: MedicationSchedule,
  startDate: number,
  endDate: number | null
): Promise<Medication> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'medications'));
  const medication: Medication = { id: docRef.id, petId, name, dosage, schedule, startDate, endDate, log: [] };
  await setDoc(docRef, medication);
  return medication;
}

export function subscribeToMedications(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (medications: Medication[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'medications'),
    (snap) => callback(snap.docs.map((d) => d.data() as Medication))
  );
}

export async function logMedicationDose(
  db: Firestore,
  householdId: string,
  petId: string,
  medicationId: string,
  givenBy: string
): Promise<void> {
  await updateDoc(
    doc(db, 'households', householdId, 'pets', petId, 'medications', medicationId),
    { log: arrayUnion({ givenBy, givenAt: Date.now() }) }
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/medicationService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Extend `firestore.rules`**

```
// firestore.rules — add:
    match /households/{householdId}/pets/{petId}/medications/{medicationId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'petId', 'name', 'dosage', 'schedule', 'startDate', 'endDate', 'log']);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

(No `hasAll`/dose-log-specific scoping is needed here: unlike the household join flow, every writer on this document is already a verified household member — there's no non-member write path to defend against, so a plain membership check on `update` is sufficient for this plan's scope.)

- [ ] **Step 7: Extend the rules test file**

```typescript
  it('allows a household member to create a medication', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        id: 'med-1', petId: 'pet-1', name: 'Amoxicillin', dosage: '250mg',
        schedule: { timesPerDay: 2, intervalDays: 1 }, startDate: 0, endDate: null, log: [],
      })
    );
  });

  it('allows a household member to log a medication dose', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        id: 'med-1', petId: 'pet-1', name: 'Amoxicillin', dosage: '250mg',
        schedule: { timesPerDay: 2, intervalDays: 1 }, startDate: 0, endDate: null, log: [],
      });
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      updateDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        log: arrayUnion({ givenBy: 'user-1', givenAt: 0 }),
      })
    );
  });

  it('denies a non-member from logging a medication dose', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        id: 'med-1', petId: 'pet-1', name: 'Amoxicillin', dosage: '250mg',
        schedule: { timesPerDay: 2, intervalDays: 1 }, startDate: 0, endDate: null, log: [],
      });
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        log: arrayUnion({ givenBy: 'user-2', givenAt: 0 }),
      })
    );
  });
```

(This test file's imports already include `arrayUnion` from `firebase/firestore` — added in Plan 1's Task 5 for the household join tests; no new import needed.)

- [ ] **Step 8: Commit**

```bash
git add src/types/medication.ts src/pets/medicationService.ts __tests__/medicationService.test.ts firestore.rules __tests__/firestore.rules.test.ts
git commit -m "feat: add Medication type (custom recurring schedule), medicationService, and rules"
```

---

### Task 7: Medication list + add screens + mark-dose-given action

**Files:**
- Create: `src/navigation/MedicationListScreen.tsx`, `src/navigation/AddMedicationScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`, `src/navigation/PetHomeScreen.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useHousehold()`, `subscribeToMedications`/`createMedication`/`logMedicationDose` (Task 6), `firestore`

- [ ] **Step 1: Medication list screen with mark-as-given**

```typescript
// src/navigation/MedicationListScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToMedications, logMedicationDose } from '../pets/medicationService';
import { firestore } from '../firebase/config';
import { Medication } from '../types/medication';

export function MedicationListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const [medications, setMedications] = useState<Medication[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToMedications(firestore, household.id, petId, setMedications);
  }, [household, petId]);

  const handleMarkGiven = async (medicationId: string) => {
    if (!household || !user) return;
    await logMedicationDose(firestore, household.id, petId, medicationId, user.uid);
  };

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add medication" onPress={() => navigation.navigate('AddMedication', { petId })} />
      <FlatList
        data={medications}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={{ gap: 4 }}>
            <Text>{item.name} — {item.dosage} ({item.schedule.timesPerDay}x/day, every {item.schedule.intervalDays}d)</Text>
            <Text>Last given: {item.log.length > 0 ? new Date(item.log[item.log.length - 1].givenAt).toLocaleString() : 'never'}</Text>
            <Button title="Mark dose as given" onPress={() => handleMarkGiven(item.id)} />
          </View>
        )}
        ListEmptyComponent={<Text>No medications yet.</Text>}
      />
    </View>
  );
}
```

- [ ] **Step 2: Add-medication screen**

```typescript
// src/navigation/AddMedicationScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createMedication } from '../pets/medicationService';
import { firestore } from '../firebase/config';

export function AddMedicationScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timesPerDay, setTimesPerDay] = useState('1');
  const [intervalDays, setIntervalDays] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    try {
      await createMedication(
        firestore, household.id, petId, name, dosage,
        { timesPerDay: parseInt(timesPerDay, 10) || 1, intervalDays: parseInt(intervalDays, 10) || 1 },
        Date.now(), null
      );
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Medication name" value={name} onChangeText={setName} />
      <TextInput placeholder="Dosage (e.g. 250mg)" value={dosage} onChangeText={setDosage} />
      <TextInput placeholder="Times per day" value={timesPerDay} onChangeText={setTimesPerDay} keyboardType="number-pad" />
      <TextInput placeholder="Every N days" value={intervalDays} onChangeText={setIntervalDays} keyboardType="number-pad" />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add medication" onPress={handleSubmit} />
    </View>
  );
}
```

- [ ] **Step 3: Register the screens**

```typescript
// src/navigation/MainNavigator.tsx — add imports and screens:
import { MedicationListScreen } from './MedicationListScreen';
import { AddMedicationScreen } from './AddMedicationScreen';
// ...
      <Stack.Screen name="MedicationList" component={MedicationListScreen} />
      <Stack.Screen name="AddMedication" component={AddMedicationScreen} />
```

```typescript
// src/navigation/PetHomeScreen.tsx — add a link:
      <Button title="Medications" onPress={() => navigation.navigate('MedicationList', { petId: route.params?.petId })} />
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/navigation/MedicationListScreen.tsx src/navigation/AddMedicationScreen.tsx src/navigation/MainNavigator.tsx src/navigation/PetHomeScreen.tsx
git commit -m "feat: add medication list/add screens with mark-dose-given action"
```

---

### Task 8: Weight log type + service + rules

**Files:**
- Create: `src/types/weightLog.ts`, `src/pets/weightLogService.ts`
- Test: `__tests__/weightLogService.test.ts`
- Modify: `firestore.rules`, `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Produces: `WeightLog` type; `createWeightLog(db, householdId, petId, date, weight): Promise<WeightLog>`, `subscribeToWeightLogs(db, householdId, petId, callback): Unsubscribe` — consumed by `WeightLogScreen.tsx` (Task 9). Weight is stored as a plain number in kilograms — unit conversion/display preference is out of scope for this plan.

- [ ] **Step 1: Write the type**

```typescript
// src/types/weightLog.ts
export interface WeightLog {
  id: string;
  petId: string;
  date: number; // epoch millis
  weight: number; // kilograms
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/weightLogService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'weight-1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockCreatedDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createWeightLog, subscribeToWeightLogs } from '../src/pets/weightLogService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('weightLogService', () => {
  it('creates a weight log entry', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const log = await createWeightLog(fakeDb, 'h1', 'pet-1', 1000, 12.5);

    expect(log).toEqual({ id: 'weight-1', petId: 'pet-1', date: 1000, weight: 12.5 });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, log);
  });

  it('subscribes to a pet\'s weight logs and maps snapshots to WeightLog[]', () => {
    const callback = jest.fn();
    const fakeLog = { id: 'weight-1', petId: 'pet-1', date: 1000, weight: 12.5 };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeLog }] });
      return () => {};
    });

    subscribeToWeightLogs(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeLog]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/weightLogService.test.ts`
Expected: FAIL with "Cannot find module '../src/pets/weightLogService'"

- [ ] **Step 4: Implement the service**

```typescript
// src/pets/weightLogService.ts
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { WeightLog } from '../types/weightLog';

export async function createWeightLog(
  db: Firestore,
  householdId: string,
  petId: string,
  date: number,
  weight: number
): Promise<WeightLog> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'weightLogs'));
  const log: WeightLog = { id: docRef.id, petId, date, weight };
  await setDoc(docRef, log);
  return log;
}

export function subscribeToWeightLogs(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (logs: WeightLog[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'weightLogs'),
    (snap) => callback(snap.docs.map((d) => d.data() as WeightLog))
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/weightLogService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Extend `firestore.rules`**

```
// firestore.rules — add:
    match /households/{householdId}/pets/{petId}/weightLogs/{logId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'petId', 'date', 'weight']);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

- [ ] **Step 7: Extend the rules test file**

```typescript
  it('allows a household member to create a weight log entry', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'weightLogs', 'weight-1'), {
        id: 'weight-1', petId: 'pet-1', date: 0, weight: 12.5,
      })
    );
  });

  it('denies a non-member from creating a weight log entry', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'weightLogs', 'weight-1'), {
        id: 'weight-1', petId: 'pet-1', date: 0, weight: 12.5,
      })
    );
  });
```

- [ ] **Step 8: Commit**

```bash
git add src/types/weightLog.ts src/pets/weightLogService.ts __tests__/weightLogService.test.ts firestore.rules __tests__/firestore.rules.test.ts
git commit -m "feat: add WeightLog type, weightLogService, and rules"
```

---

### Task 9: Weight log screen with entry form and trend chart

**Files:**
- Create: `src/navigation/WeightLogScreen.tsx`, `src/pets/WeightTrendChart.tsx`
- Modify: `src/navigation/MainNavigator.tsx`, `src/navigation/PetHomeScreen.tsx`

**Design decision:** the trend visualization is a small hand-rolled bar chart built from plain `View`s (bar height proportional to weight within the logged range), not a charting library. This avoids adding a new native dependency during MVP (this app has already hit several native-linking/version issues during Plan 1 — see the SDD ledger); the data layer (`WeightLog[]`) is identical either way, so swapping in a real charting library later, if the bar chart proves too basic, only touches this one component.

**Interfaces:**
- Consumes: `useHousehold()`, `subscribeToWeightLogs`/`createWeightLog` (Task 8), `firestore`

- [ ] **Step 1: Trend chart component**

```typescript
// src/pets/WeightTrendChart.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { WeightLog } from '../types/weightLog';

const CHART_HEIGHT = 120;

export function WeightTrendChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return <Text>No weight entries yet.</Text>;
  }

  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const weights = sorted.map((l) => l.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 4 }}>
      {sorted.map((log) => {
        const barHeight = 8 + ((log.weight - min) / range) * (CHART_HEIGHT - 8);
        return (
          <View key={log.id} style={{ alignItems: 'center' }}>
            <View style={{ width: 12, height: barHeight, backgroundColor: '#4a90d9' }} />
            <Text style={{ fontSize: 8 }}>{log.weight}</Text>
          </View>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Weight log screen**

```typescript
// src/navigation/WeightLogScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs, createWeightLog } from '../pets/weightLogService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { WeightTrendChart } from '../pets/WeightTrendChart';

export function WeightLogScreen({ route }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!household) return;
    return subscribeToWeightLogs(firestore, household.id, petId, setLogs);
  }, [household, petId]);

  const handleAdd = async () => {
    if (!household) return;
    setError(null);
    const parsed = parseFloat(weight);
    if (isNaN(parsed)) {
      setError('Enter a valid weight');
      return;
    }
    try {
      await createWeightLog(firestore, household.id, petId, Date.now(), parsed);
      setWeight('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <WeightTrendChart logs={logs} />
      <TextInput placeholder="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Log weight" onPress={handleAdd} />
    </View>
  );
}
```

- [ ] **Step 3: Register the screen**

```typescript
// src/navigation/MainNavigator.tsx — add import and screen:
import { WeightLogScreen } from './WeightLogScreen';
// ...
      <Stack.Screen name="WeightLog" component={WeightLogScreen} />
```

```typescript
// src/navigation/PetHomeScreen.tsx — add a link:
      <Button title="Weight" onPress={() => navigation.navigate('WeightLog', { petId: route.params?.petId })} />
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/pets/WeightTrendChart.tsx src/navigation/WeightLogScreen.tsx src/navigation/MainNavigator.tsx src/navigation/PetHomeScreen.tsx
git commit -m "feat: add weight log screen with entry form and hand-rolled trend chart"
```

---

### Task 10: Expense type + service + rules

**Files:**
- Create: `src/types/expense.ts`, `src/pets/expenseService.ts`
- Test: `__tests__/expenseService.test.ts`
- Modify: `firestore.rules`, `__tests__/firestore.rules.test.ts`

**Design decision:** `amount` is stored as an integer number of cents, not a float, to avoid floating-point rounding errors accumulating across a running total (spec: Core screens #7 — "list + running total").

**Interfaces:**
- Produces: `Expense`, `ExpenseCategory` types; `createExpense(db, householdId, petId, date, category, amountCents, note): Promise<Expense>`, `subscribeToExpenses(db, householdId, petId, callback): Unsubscribe` — consumed by `ExpenseListScreen.tsx`/`AddExpenseScreen.tsx` (Task 11).

- [ ] **Step 1: Write the types**

```typescript
// src/types/expense.ts
export type ExpenseCategory = 'food' | 'vet' | 'grooming' | 'insurance' | 'supplies' | 'other';

export interface Expense {
  id: string;
  petId: string;
  date: number; // epoch millis
  category: ExpenseCategory;
  amountCents: number; // integer cents, avoids float rounding in running totals
  note: string;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/expenseService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'expense-1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockCreatedDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createExpense, subscribeToExpenses } from '../src/pets/expenseService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('expenseService', () => {
  it('creates an expense record', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const expense = await createExpense(fakeDb, 'h1', 'pet-1', 1000, 'vet', 5000, 'Annual checkup');

    expect(expense).toEqual({
      id: 'expense-1', petId: 'pet-1', date: 1000, category: 'vet', amountCents: 5000, note: 'Annual checkup',
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, expense);
  });

  it('subscribes to a pet\'s expenses and maps snapshots to Expense[]', () => {
    const callback = jest.fn();
    const fakeExpense = { id: 'expense-1', petId: 'pet-1', category: 'vet', amountCents: 5000 };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeExpense }] });
      return () => {};
    });

    subscribeToExpenses(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeExpense]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/expenseService.test.ts`
Expected: FAIL with "Cannot find module '../src/pets/expenseService'"

- [ ] **Step 4: Implement the service**

```typescript
// src/pets/expenseService.ts
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Expense, ExpenseCategory } from '../types/expense';

export async function createExpense(
  db: Firestore,
  householdId: string,
  petId: string,
  date: number,
  category: ExpenseCategory,
  amountCents: number,
  note: string
): Promise<Expense> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'expenses'));
  const expense: Expense = { id: docRef.id, petId, date, category, amountCents, note };
  await setDoc(docRef, expense);
  return expense;
}

export function subscribeToExpenses(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (expenses: Expense[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'expenses'),
    (snap) => callback(snap.docs.map((d) => d.data() as Expense))
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/expenseService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Extend `firestore.rules`**

```
// firestore.rules — add:
    match /households/{householdId}/pets/{petId}/expenses/{expenseId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'petId', 'date', 'category', 'amountCents', 'note']);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

- [ ] **Step 7: Extend the rules test file**

```typescript
  it('allows a household member to create an expense', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'expenses', 'expense-1'), {
        id: 'expense-1', petId: 'pet-1', date: 0, category: 'vet', amountCents: 5000, note: 'Checkup',
      })
    );
  });

  it('denies a non-member from creating an expense', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'expenses', 'expense-1'), {
        id: 'expense-1', petId: 'pet-1', date: 0, category: 'vet', amountCents: 5000, note: 'Checkup',
      })
    );
  });
```

- [ ] **Step 8: Commit**

```bash
git add src/types/expense.ts src/pets/expenseService.ts __tests__/expenseService.test.ts firestore.rules __tests__/firestore.rules.test.ts
git commit -m "feat: add Expense type, expenseService, and rules"
```

---

### Task 11: Expense list + add screens with running total and category filter

**Files:**
- Create: `src/navigation/ExpenseListScreen.tsx`, `src/navigation/AddExpenseScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`, `src/navigation/PetHomeScreen.tsx`

**Interfaces:**
- Consumes: `useHousehold()`, `subscribeToExpenses`/`createExpense` (Task 10), `firestore`

- [ ] **Step 1: Expense list screen with running total and category filter**

```typescript
// src/navigation/ExpenseListScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToExpenses } from '../pets/expenseService';
import { firestore } from '../firebase/config';
import { Expense, ExpenseCategory } from '../types/expense';

const CATEGORIES: (ExpenseCategory | 'all')[] = ['all', 'food', 'vet', 'grooming', 'insurance', 'supplies', 'other'];

export function ExpenseListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all');

  useEffect(() => {
    if (!household) return;
    return subscribeToExpenses(firestore, household.id, petId, setExpenses);
  }, [household, petId]);

  const filtered = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter]
  );
  const totalCents = useMemo(() => filtered.reduce((sum, e) => sum + e.amountCents, 0), [filtered]);

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add expense" onPress={() => navigation.navigate('AddExpense', { petId })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {CATEGORIES.map((c) => (
          <Button key={c} title={c} onPress={() => setFilter(c)} />
        ))}
      </View>
      <Text>Total: ${(totalCents / 100).toFixed(2)}</Text>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Text>
            {item.category}: ${(item.amountCents / 100).toFixed(2)} — {item.note}
          </Text>
        )}
        ListEmptyComponent={<Text>No expenses yet.</Text>}
      />
    </View>
  );
}
```

- [ ] **Step 2: Add-expense screen**

```typescript
// src/navigation/AddExpenseScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createExpense } from '../pets/expenseService';
import { firestore } from '../firebase/config';
import { ExpenseCategory } from '../types/expense';

const CATEGORIES: ExpenseCategory[] = ['food', 'vet', 'grooming', 'insurance', 'supplies', 'other'];

export function AddExpenseScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) {
      setError('Enter a valid amount');
      return;
    }
    try {
      await createExpense(firestore, household.id, petId, Date.now(), category, Math.round(parsed * 100), note);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {CATEGORIES.map((c) => (
          <Button key={c} title={c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Text>Selected category: {category}</Text>
      <TextInput placeholder="Note" value={note} onChangeText={setNote} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add expense" onPress={handleSubmit} />
    </View>
  );
}
```

- [ ] **Step 3: Register the screens**

```typescript
// src/navigation/MainNavigator.tsx — add imports and screens:
import { ExpenseListScreen } from './ExpenseListScreen';
import { AddExpenseScreen } from './AddExpenseScreen';
// ...
      <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
```

```typescript
// src/navigation/PetHomeScreen.tsx — add a link:
      <Button title="Expenses" onPress={() => navigation.navigate('ExpenseList', { petId: route.params?.petId })} />
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/navigation/ExpenseListScreen.tsx src/navigation/AddExpenseScreen.tsx src/navigation/MainNavigator.tsx src/navigation/PetHomeScreen.tsx
git commit -m "feat: add expense list/add screens with running total and category filter"
```

---

### Task 12: Vet visit type (notes only) + service + rules

**Files:**
- Create: `src/types/vetVisit.ts`, `src/pets/vetVisitService.ts`
- Test: `__tests__/vetVisitService.test.ts`
- Modify: `firestore.rules`, `__tests__/firestore.rules.test.ts`

**Scope note:** this task covers the notes/reason/date fields only. `documentUrls` is included in the type (per spec) but populated later — Task 14 adds the actual upload flow. Keeping the data model complete now (with an empty array default) means Task 14 only has to add an upload UI and a field-append call, not touch this type or its rules again.

**Interfaces:**
- Produces: `VetVisit` type; `createVetVisit(db, householdId, petId, date, reason, notes): Promise<VetVisit>`, `subscribeToVetVisits(db, householdId, petId, callback): Unsubscribe`, `addVetVisitDocument(db, householdId, petId, visitId, documentUrl): Promise<void>` (used by Task 14) — consumed by `VetVisitListScreen.tsx`/`AddVetVisitScreen.tsx` (Task 13).

- [ ] **Step 1: Write the type**

```typescript
// src/types/vetVisit.ts
export interface VetVisit {
  id: string;
  petId: string;
  date: number; // epoch millis
  reason: string;
  notes: string;
  documentUrls: string[];
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/vetVisitService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'visit-1' };
const mockVisitDocRef = { id: 'visit-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'visit-1-existing' ? mockVisitDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
}));

import { createVetVisit, subscribeToVetVisits, addVetVisitDocument } from '../src/pets/vetVisitService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vetVisitService', () => {
  it('creates a vet visit with an empty documentUrls array', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const visit = await createVetVisit(fakeDb, 'h1', 'pet-1', 1000, 'Annual checkup', 'All healthy');

    expect(visit).toEqual({
      id: 'visit-1', petId: 'pet-1', date: 1000, reason: 'Annual checkup', notes: 'All healthy', documentUrls: [],
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, visit);
  });

  it('subscribes to a pet\'s vet visits and maps snapshots to VetVisit[]', () => {
    const callback = jest.fn();
    const fakeVisit = { id: 'visit-1', petId: 'pet-1', reason: 'Annual checkup' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeVisit }] });
      return () => {};
    });

    subscribeToVetVisits(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeVisit]);
  });

  it('appends a document URL via arrayUnion', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await addVetVisitDocument(fakeDb, 'h1', 'pet-1', 'visit-1-existing', 'https://example.com/doc.pdf');

    expect(mockArrayUnion).toHaveBeenCalledWith('https://example.com/doc.pdf');
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockVisitDocRef, {
      documentUrls: { __arrayUnion: ['https://example.com/doc.pdf'] },
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/vetVisitService.test.ts`
Expected: FAIL with "Cannot find module '../src/pets/vetVisitService'"

- [ ] **Step 4: Implement the service**

```typescript
// src/pets/vetVisitService.ts
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { VetVisit } from '../types/vetVisit';

export async function createVetVisit(
  db: Firestore,
  householdId: string,
  petId: string,
  date: number,
  reason: string,
  notes: string
): Promise<VetVisit> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'vetVisits'));
  const visit: VetVisit = { id: docRef.id, petId, date, reason, notes, documentUrls: [] };
  await setDoc(docRef, visit);
  return visit;
}

export function subscribeToVetVisits(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (visits: VetVisit[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'vetVisits'),
    (snap) => callback(snap.docs.map((d) => d.data() as VetVisit))
  );
}

export async function addVetVisitDocument(
  db: Firestore,
  householdId: string,
  petId: string,
  visitId: string,
  documentUrl: string
): Promise<void> {
  await updateDoc(
    doc(db, 'households', householdId, 'pets', petId, 'vetVisits', visitId),
    { documentUrls: arrayUnion(documentUrl) }
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/vetVisitService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Extend `firestore.rules`**

```
// firestore.rules — add:
    match /households/{householdId}/pets/{petId}/vetVisits/{visitId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'petId', 'date', 'reason', 'notes', 'documentUrls']);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

- [ ] **Step 7: Extend the rules test file**

```typescript
  it('allows a household member to create a vet visit', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'vetVisits', 'visit-1'), {
        id: 'visit-1', petId: 'pet-1', date: 0, reason: 'Checkup', notes: 'Fine', documentUrls: [],
      })
    );
  });

  it('denies a non-member from creating a vet visit', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'vetVisits', 'visit-1'), {
        id: 'visit-1', petId: 'pet-1', date: 0, reason: 'Checkup', notes: 'Fine', documentUrls: [],
      })
    );
  });
```

- [ ] **Step 8: Commit**

```bash
git add src/types/vetVisit.ts src/pets/vetVisitService.ts __tests__/vetVisitService.test.ts firestore.rules __tests__/firestore.rules.test.ts
git commit -m "feat: add VetVisit type (notes-only), vetVisitService, and rules"
```

---

### Task 13: Vet visit list + add screens (notes-only)

**Files:**
- Create: `src/navigation/VetVisitListScreen.tsx`, `src/navigation/AddVetVisitScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`, `src/navigation/PetHomeScreen.tsx`

**Interfaces:**
- Consumes: `useHousehold()`, `subscribeToVetVisits`/`createVetVisit` (Task 12), `firestore`

- [ ] **Step 1: Vet visit list screen**

```typescript
// src/navigation/VetVisitListScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';
import { VetVisit } from '../types/vetVisit';

export function VetVisitListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [visits, setVisits] = useState<VetVisit[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVetVisits(firestore, household.id, petId, setVisits);
  }, [household, petId]);

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add vet visit" onPress={() => navigation.navigate('AddVetVisit', { petId })} />
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <Text onPress={() => navigation.navigate('VetVisitDocuments', { petId, visitId: item.id })}>
            {new Date(item.date).toLocaleDateString()} — {item.reason}: {item.notes} ({item.documentUrls.length} docs)
          </Text>
        )}
        ListEmptyComponent={<Text>No vet visits recorded yet.</Text>}
      />
    </View>
  );
}
```

(The `VetVisitDocuments` route referenced here is added in Task 14 — this screen anticipates it now so Task 14 doesn't need to touch this file again. Until Task 14 lands, the `onPress` navigates to a route that doesn't exist yet; that's fine mid-plan since this task is reviewed before Task 14 runs, and the target only needs to exist by the time a user actually taps it in a running app.)

- [ ] **Step 2: Add-vet-visit screen**

```typescript
// src/navigation/AddVetVisitScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createVetVisit } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';

export function AddVetVisitScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    try {
      await createVetVisit(firestore, household.id, petId, Date.now(), reason, notes);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Reason for visit" value={reason} onChangeText={setReason} />
      <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} multiline />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add vet visit" onPress={handleSubmit} />
    </View>
  );
}
```

- [ ] **Step 3: Register the screens**

```typescript
// src/navigation/MainNavigator.tsx — add imports and screens:
import { VetVisitListScreen } from './VetVisitListScreen';
import { AddVetVisitScreen } from './AddVetVisitScreen';
// ...
      <Stack.Screen name="VetVisitList" component={VetVisitListScreen} />
      <Stack.Screen name="AddVetVisit" component={AddVetVisitScreen} />
```

```typescript
// src/navigation/PetHomeScreen.tsx — add a link:
      <Button title="Vet Visits" onPress={() => navigation.navigate('VetVisitList', { petId: route.params?.petId })} />
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/navigation/VetVisitListScreen.tsx src/navigation/AddVetVisitScreen.tsx src/navigation/MainNavigator.tsx src/navigation/PetHomeScreen.tsx
git commit -m "feat: add vet visit list/add screens (notes-only)"
```

---

### Task 14: Vet visit document attachments via Cloud Storage

**Files:**
- Create: `storage.rules`, `src/navigation/VetVisitDocumentsScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`, `package.json` (new dependencies)

**This is the highest-uncertainty task in this plan** — it's the first thing in this codebase to touch Cloud Storage, and it uses a comparatively newer Firebase feature (Storage rules calling into Firestore via `firestore.get()`/`firestore.exists()` to check household membership). Treat this task's review with the same rigor Plan 1's `firestore.rules` work got — dispatch a dedicated, skeptical review rather than assuming the cross-service rule syntax is correct just because it compiles/looks right, given this project's history of rules logic that looked correct and wasn't.

**Interfaces:**
- Consumes: `addVetVisitDocument` (Task 12), `useHousehold()`, `firestore`
- Produces: a working "attach a photo to a vet visit" flow.

- [ ] **Step 1: Install new dependencies**

```bash
npx expo install @react-native-firebase/storage expo-image-picker
```

- [ ] **Step 2: Write `storage.rules`**

```
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /households/{householdId}/pets/{petId}/vetVisits/{visitId}/{fileName} {
      allow read, write: if request.auth != null &&
        firestore.exists(/databases/(default)/documents/households/$(householdId)) &&
        firestore.get(/databases/(default)/documents/households/$(householdId)).data.members
          .filter(m => m.userId == request.auth.uid).size() > 0;
    }
  }
}
```

This mirrors `firestore.rules`' `isHouseholdMember()` helper, cross-referencing the same Firestore household document from within Storage rules (a documented Firebase feature — Storage rules can call `firestore.get()`/`firestore.exists()` to check conditions in Firestore). **This cannot be verified in this project's sandbox** (no JRE/emulator, same standing constraint as every rules file in this project) — flag clearly for real verification via `firebase emulators:exec --only firestore,storage "..."` on a machine with Java before trusting it in production.

- [ ] **Step 3: Register the storage rules file**

```json
// firebase.json — add a "storage" key alongside the existing "firestore"/"emulators" keys:
  "storage": {
    "rules": "storage.rules"
  },
```

Also add a storage emulator entry under `"emulators"` (`"storage": { "port": 9199 }`) so this can eventually be tested locally.

- [ ] **Step 4: Vet visit documents screen**

```typescript
// src/navigation/VetVisitDocumentsScreen.tsx
import React, { useState } from 'react';
import { View, Button, Text, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { useHousehold } from '../household/HouseholdContext';
import { addVetVisitDocument } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';

export function VetVisitDocumentsScreen({ route }: any) {
  const { petId, visitId } = route.params;
  const { household } = useHousehold();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickAndUpload = async () => {
    if (!household) return;
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled) return;

    setUploading(true);
    try {
      const localUri = result.assets[0].uri;
      const fileName = `${Date.now()}.jpg`;
      const storage = getStorage();
      const fileRef = ref(storage, `households/${household.id}/pets/${petId}/vetVisits/${visitId}/${fileName}`);
      await putFile(fileRef, localUri);
      const downloadUrl = await getDownloadURL(fileRef);
      await addVetVisitDocument(firestore, household.id, petId, visitId, downloadUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Button title={uploading ? 'Uploading...' : 'Attach a photo'} onPress={handlePickAndUpload} disabled={uploading} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
```

Verify `getStorage`/`ref`/`putFile`/`getDownloadURL`'s exact names and signatures against `node_modules/@react-native-firebase/storage`'s type declarations before finalizing — this is a brand-new dependency to this codebase, so nothing here has been confirmed against an installed version yet, unlike the firestore/auth modular imports used elsewhere in this project.

- [ ] **Step 5: Register the screen**

```typescript
// src/navigation/MainNavigator.tsx — add import and screen:
import { VetVisitDocumentsScreen } from './VetVisitDocumentsScreen';
// ...
      <Stack.Screen name="VetVisitDocuments" component={VetVisitDocumentsScreen} />
```

(This is the route `VetVisitListScreen.tsx`, Task 13, already navigates to.)

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add storage.rules firebase.json src/navigation/VetVisitDocumentsScreen.tsx src/navigation/MainNavigator.tsx package.json package-lock.json
git commit -m "feat: add vet visit document attachments via Cloud Storage"
```

---

### Task 15: Pet home dashboard screen

**Files:**
- Modify: `src/navigation/PetHomeScreen.tsx`

**Interfaces:**
- Consumes: `useHousehold()`, `subscribeToWeightLogs` (Task 8), `firestore`; navigates to every screen added in Tasks 5, 7, 9, 11, 13, 14.

This replaces the placeholder created in Task 3 and incrementally extended by Tasks 5/7/9/11/13 with the spec's actual "Pet home" screen (Core screens #2): a weight trend snippet and links to every record type. Reminder computation ("upcoming reminders") is explicitly Plan 3's job — this screen only displays data already in Firestore, it does not compute due-dates itself.

- [ ] **Step 1: Replace `PetHomeScreen.tsx` with the final version**

```typescript
// src/navigation/PetHomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs } from '../pets/weightLogService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { WeightTrendChart } from '../pets/WeightTrendChart';

export function PetHomeScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToWeightLogs(firestore, household.id, petId, setWeightLogs);
  }, [household, petId]);

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <WeightTrendChart logs={weightLogs} />
      <Button title="Vaccines" onPress={() => navigation.navigate('VaccineList', { petId })} />
      <Button title="Medications" onPress={() => navigation.navigate('MedicationList', { petId })} />
      <Button title="Vet Visits" onPress={() => navigation.navigate('VetVisitList', { petId })} />
      <Button title="Weight" onPress={() => navigation.navigate('WeightLog', { petId })} />
      <Button title="Expenses" onPress={() => navigation.navigate('ExpenseList', { petId })} />
    </View>
  );
}
```

(This is a direct replacement of the file's current content, which was extended incrementally with one `Button` per task from Tasks 5/7/9/11/13 — the calls above supersede all of those.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: PASS (all unit/mocked-Firestore tests — `firestore.rules.test.ts` still requires the emulator, per the standing constraint noted throughout this plan)

- [ ] **Step 4: Commit**

```bash
git add src/navigation/PetHomeScreen.tsx
git commit -m "feat: add pet home dashboard tying together all record-type screens"
```

---

## Self-Review Notes

- **Spec coverage:** Goals #1 (vaccines/medications/vet-visits/weight/expenses tracking) — Tasks 4-14. Goal #2 (real-time family sharing) — every service uses `onSnapshot`, not one-shot reads; `useHousehold()` (Task 1) itself is real-time. Goal #3 (reliable cloud storage from entry) — inherited from Plan 1's Firestore/offline-persistence setup, no additional work needed. Goal #4 (offline-first core actions) — inherited from Plan 1's `initializeFirestore({persistence: true, ...})`; no per-task changes needed since all writes in this plan go through the same `firestore` instance. Goal #5 (pricing) — explicitly out of scope (Plan 3/monetization). Core screens #1 (pet switcher) — Task 3. #2 (pet home) — Task 15. #3 (medications) — Task 7. #4 (vaccines) — Task 5. #5 (vet visits) — Tasks 13-14. #6 (weight) — Task 9. #7 (expenses) — Task 11. #8 (household settings) — create/join already exists from Plan 1; "manage subscription" is out of scope (monetization, Plan 3+). Non-goals (species restriction, grooming/training, vet integrations, insurance claims) — untouched, consistent with scope. Notifications section — explicitly deferred to Plan 3, noted in Global Constraints. Open question "recurring-schedule format" — resolved in Task 6 (custom struct, with rationale). Open question "invite links vs in-app codes" — already resolved in Plan 1 (in-app codes).
- **Type consistency:** every service task's create function returns exactly the type defined in that same task's Step 1, and every screen task consumes that same type/function signature without modification — checked pairwise (Task 4↔5, 6↔7, 8↔9, 10↔11, 12↔13↔14).
- **No placeholders:** every step has runnable code. The one intentionally-incomplete reference (`VetVisitDocuments` route used by Task 13's screen before Task 14 defines it) is flagged inline as expected mid-plan sequencing, not a gap — it's fully resolved by Task 14, which comes right after.
- **Rules-testing constraint carried forward from Plan 1:** every `firestore.rules`/`storage.rules` change in this plan needs real emulator verification (JRE required) before production trust — this plan does not resolve that standing gap, it just adds more rules that need the same eventual verification pass. Whoever executes this plan should run the full `firestore.rules.test.ts` suite for real at least once after Task 14, not after every individual task, to avoid needing Java mid-plan if it's still unavailable.
