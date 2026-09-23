# Pet Health Tracker — Vets Directory and Household Members Implementation Plan (Plan 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real vets directory (clinic name, doctor name, address, phone, opening hours, speciality, 24-hour-emergency flag, notes, and which pets go there — with tap-to-call and tap-to-open-Maps, no map inside the app), plus a real Household tab (invite code with a native share button, member count against the free-tier limit, and a "remove member" action any member can use) — and a fix for the standing "a removed member has no way back in" gap.

**Architecture:** `vets` becomes a new household-level Firestore subcollection (`households/{householdId}/vets/{vetId}`), following the exact `isHouseholdMember` + create-time `hasOnly([...])` pattern every other collection in this codebase already uses — no new rules machinery. `vetService.ts` is a thin CRUD shell (create/update/subscribe) matching `eventService.ts`'s shape exactly. Three screens — `VetsScreen` (list, pet-filtered via the existing `usePetSelection()`/`<PetSelector>` primitive), `AddVetScreen`, `EditVetScreen` — follow the established flat-form pattern (`EditEventScreen`'s seed-once-from-a-live-subscription pattern, `AddEventScreen`'s pet-multiselect pattern). The household member limit needs a denormalized `memberCount` mirror on the already-existing `inviteCodes/{code}` document, because the joining (non-member) client has no read access to the household document itself and there is no other way to show them a "this household is full" message before they attempt to join — this mirrors the exact reasoning that produced `memberIds`/`inviteCodes` in Plan 1. The recovery-path fix relaxes `users/{userId}`'s rules from create-once/immutable to "a user may overwrite their OWN pointer once they are no longer a member of the household it names" — this requires no change to how removal itself works (a member removing another member is already a permitted `update` under the existing `isMember` rule, with no field-shape restriction), and needs no new cross-document/cross-write-ordering trust the codebase hasn't already established.

**Tech Stack:** Same as Plans 1-6 (Expo prebuild/dev-client, `@react-native-firebase/firestore` modular API, React Navigation, Jest with mocked Firestore for service logic + `@firebase/rules-unit-testing` against the real emulator for rules). **No new dependency, no new native module, no `expo prebuild`/rebuild needed for this plan.** Tap-to-call/tap-to-open-Maps use React Native's built-in `Linking` API; the invite-code share button uses React Native's built-in `Share` API — both already ship with React Native, no package to add.

**Spec:** [docs/superpowers/specs/2026-09-13-execution-pack.md](../specs/2026-09-13-execution-pack.md), "Phase 5 — Vets and the household" (the locked planning prompt and its "before approving"/"on the phone" checklists). Also inherits Plans 1-6's specs/constraints, especially Plan 1's `households`/`inviteCodes`/`users` rules design (`docs/superpowers/plans/2026-09-11-pet-health-app-foundation.md`, "Revision log") and Plan 4's `src/limits/limits.ts` module.

**Decisions locked in during brainstorming (not fully spelled out in the execution pack itself):**
- Any household member may remove any other member — no owner/admin role is introduced. This matches the current data model exactly (`HouseholdMember` has no role field) and keeps this plan's scope from growing into a governance feature nobody asked for.
- Vet visits are **not** linked to a specific vet in this plan (`VetVisit` gains no `vetId` field) — deferred to a future plan.
- A vet's address is plain free text with a tap-to-open-Maps action, exactly as the execution pack already specifies — no Google Places autocomplete/picker, no new API key or billing setup.
- A vet's "doctor name" is one clinic-level free-text field — no per-visit doctor selection, no multi-doctor-per-clinic concept.
- No delete-vet UI, matching this app's existing house style: every other record type (pets, vaccines, medications, vet visits, expenses, events) also has no delete UI even though `firestore.rules` permits it for future use.

## Global Constraints

- Every security-rules change follows CLAUDE.md's pattern: `isHouseholdMember(householdId)` gate + a `create`-time `hasOnly([...])` field allowlist, `update` with no field restriction — **except** the two rules this plan adds that deliberately step outside that pattern (the `inviteCodes` `memberCount` update rule and the `users/{userId}` recovery update rule). Both are justified inline in Task 6/7 below; do not add `hasAll`/`diff()` hijack-protection machinery anywhere else — that belongs only to `isJoining()` (the original untrusted-join boundary), per CLAUDE.md.
- Reuse `usePetSelection()`/`<PetSelector>` (`src/selection/PetSelectionContext.tsx` + `src/components/ui/PetSelector.tsx`) unchanged for the Vets tab's "all pets / one pet" filter — do not build a second selection mechanism. A vet is visible under a specific pet's filter if that pet's id is in the vet's `petIds`.
- Follow the established service-function convention exactly: a simple, few-field entity takes positional params (`createEvent(db, householdId, petIds, type, title, notes, date)`); a many-field entity takes an object input type (`createPet(db, householdId, input: NewPetInput, existingPets)`). `Vet` has 10 content fields, so `createVet` takes a `NewVetInput` object, mirroring `petService.ts`'s `NewPetInput` exactly.
- No delete-vet UI, no owner/admin role, no vetId-on-VetVisit linking, no Google Places integration — all explicitly out of scope (see "Decisions locked in" above). Do not add any of these opportunistically.
- **No CI/automation deploys `firestore.rules`.** After this plan's rules changes are merged, redeploy by hand: `firebase deploy --only firestore:rules --project pet-tracker-app-63512`. Deploy once, at the very end (Task 9), after every rules-touching task has landed — not after each individual task.
- Do not replace the existing design system (`src/theme/theme.ts`, `src/components/ui/`) — extend it. No new UI primitive is needed for this plan (the existing `Chip` component doubles as a toggle for the "24-hour emergency" flag, exactly as `HouseholdSetupScreen` already uses `Chip` as a mode selector).
- TypeScript throughout.

**Known, accepted gap this plan does not fix:** the live Firestore project already has at least one real household with real members, created before the `memberCount` field existed. Its `inviteCodes/{code}` document will read `memberCount: undefined` until someone joins or is removed at least once (after which it self-corrects, since `joinHousehold`/`removeMember` always write a real number). `joinHousehold`'s `isHouseholdFull(memberCount ?? 0)` check treats a missing value as 0 (under the limit) — the safe, fail-open direction, matching this project's established tolerance for soft/advisory free-tier caps (the same as Plan 4's custom-field limit, which isn't rules-enforced either). No backfill migration is built for this — flagging it here rather than letting it surprise a future reader.

---

## File Structure

```
src/
  types/
    vet.ts                        # NEW: Vet type
  vets/
    vetService.ts                 # NEW: createVet/updateVet/subscribeToVets (NewVetInput object-input, matches petService.ts)
  navigation/
    VetsScreen.tsx                 # REWRITTEN: real list, PetSelector filter, tap-to-call/tap-to-Maps, empty state
    AddVetScreen.tsx               # NEW: flat add form + pet multi-select
    EditVetScreen.tsx              # NEW: flat edit form, seed-once-from-live-subscription
    AddSheet.tsx                   # MODIFIED: one new "Add a Vet" entry
    RootNavigator.tsx              # MODIFIED: register AddVet/EditVet routes
    HouseholdScreen.tsx            # REWRITTEN: invite code + share, member list with remove, limit display
  household/
    householdService.ts            # MODIFIED: memberCount denormalization (createHousehold/joinHousehold), new removeMember
  limits/
    limits.ts                      # MODIFIED: isHouseholdFull, householdMemberLimitMessage
firestore.rules                    # MODIFIED: new `vets` collection block, `inviteCodes` memberCount update rule, `users/{userId}` recovery update rule
__tests__/
  vetService.test.ts               # NEW
  householdService.test.ts         # MODIFIED
  limits.test.ts                   # MODIFIED
  firestore.rules.test.ts          # MODIFIED
```

---

### Task 1: `Vet` type

**Files:**
- Create: `src/types/vet.ts`

**Interfaces:**
- Produces: `Vet { id: string; householdId: string; clinicName: string; doctorName: string; address: string; phone: string; openingHours: string; speciality: string; isEmergency24h: boolean; notes: string; petIds: string[] }`. Every later task imports this — this exact shape is load-bearing.

Pure type, no behavior — same reasoning as every other Task 1 in this project: later tasks need it to exist first, and a reviewer should be able to check "did this only touch a type" in isolation.

- [ ] **Step 1: Create the type**

```typescript
// src/types/vet.ts
export interface Vet {
  id: string;
  householdId: string;
  clinicName: string;
  doctorName: string; // '' if unknown — "a vet with only a name and nothing else" (execution pack's own device check) must still work
  address: string; // free text, not geocoded — VetsScreen opens it in the phone's Maps app on tap
  phone: string; // free text — VetsScreen dials it on tap
  openingHours: string;
  speciality: string;
  isEmergency24h: boolean;
  notes: string;
  petIds: string[]; // which pets go there — [] is valid (a vet not yet assigned to any pet)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors — nothing imports this file yet.

- [ ] **Step 3: Commit**

```bash
git add src/types/vet.ts
git commit -m "feat: add Vet type"
git push
```

---

### Task 2: `vets` storage — `vetService` and rules

**Files:**
- Create: `src/vets/vetService.ts`
- Modify: `firestore.rules`
- Test: `__tests__/vetService.test.ts`
- Modify: `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Consumes: `Vet` (Task 1).
- Produces: `NewVetInput = Omit<Vet, 'id' | 'householdId'>`; `createVet(db, householdId, input: NewVetInput): Promise<Vet>`; `subscribeToVets(db, householdId, callback: (vets: Vet[]) => void): Unsubscribe`; `updateVet(db, householdId, vetId, updates: Partial<Vet>): Promise<void>`. Tasks 3-5 (screens) import these.

- [ ] **Step 1: Write the failing service test**

```typescript
// __tests__/vetService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'vet-1' };
const mockExistingDocRef = { id: 'vet-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'vet-1-existing' ? mockExistingDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createVet, subscribeToVets, updateVet } from '../src/vets/vetService';

const fakeDb = {} as Firestore;

const fullInput = {
  clinicName: 'Riverside Vet Clinic',
  doctorName: 'Dr. Novak',
  address: '12 River Rd',
  phone: '555-0100',
  openingHours: 'Mon-Fri 9am-6pm',
  speciality: 'General practice',
  isEmergency24h: false,
  notes: 'Ana\'s regular clinic',
  petIds: ['pet-1'],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vetService', () => {
  it('creates a vet with the given fields', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const vet = await createVet(fakeDb, 'h1', fullInput);

    expect(vet).toEqual({ id: 'vet-1', householdId: 'h1', ...fullInput });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, vet);
  });

  it('creates a vet with only a name and nothing else', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const minimalInput = {
      clinicName: 'Corner Clinic',
      doctorName: '', address: '', phone: '', openingHours: '',
      speciality: '', isEmergency24h: false, notes: '', petIds: [],
    };
    const vet = await createVet(fakeDb, 'h1', minimalInput);

    expect(vet).toEqual({ id: 'vet-1', householdId: 'h1', ...minimalInput });
  });

  it('subscribes to the household vets collection', () => {
    const callback = jest.fn();
    mockOnSnapshot.mockReturnValue(() => {});

    subscribeToVets(fakeDb, 'h1', callback);

    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('maps snapshot docs to Vet objects', () => {
    const callback = jest.fn();
    const fakeDocs = [{ data: () => ({ id: 'vet-1', clinicName: 'Riverside' }) }];
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({ docs: fakeDocs });
      return () => {};
    });

    subscribeToVets(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([{ id: 'vet-1', clinicName: 'Riverside' }]);
  });

  it('reports a listener error as an empty list rather than leaving the screen stuck', () => {
    const callback = jest.fn();
    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      onError(new Error('permission-denied'));
      return () => {};
    });

    subscribeToVets(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([]);
  });

  it('updates a vet', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateVet(fakeDb, 'h1', 'vet-1-existing', { clinicName: 'Renamed Clinic' });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockExistingDocRef, { clinicName: 'Renamed Clinic' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/vetService.test.ts`
Expected: FAIL with "Cannot find module '../src/vets/vetService'"

- [ ] **Step 3: Implement `vetService.ts`**

```typescript
// src/vets/vetService.ts
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Vet } from '../types/vet';

export type NewVetInput = Omit<Vet, 'id' | 'householdId'>;

export async function createVet(
  db: Firestore,
  householdId: string,
  input: NewVetInput
): Promise<Vet> {
  const docRef = doc(collection(db, 'households', householdId, 'vets'));
  const vet: Vet = { ...input, id: docRef.id, householdId };
  await setDoc(docRef, vet);
  return vet;
}

export function subscribeToVets(
  db: Firestore,
  householdId: string,
  callback: (vets: Vet[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'vets'),
    (snap) => callback(snap.docs.map((d) => d.data() as Vet)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToVets listener error', error);
      callback([]);
    }
  );
}

export async function updateVet(
  db: Firestore,
  householdId: string,
  vetId: string,
  updates: Partial<Vet>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'vets', vetId), updates);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/vetService.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Add the `vets` collection to `firestore.rules`**

Read `firestore.rules` first (search for `match /households/{householdId}/events/{eventId}`, the last collection block before `inviteCodes`) and add a new sibling `match` block directly after it — household-level, not nested under `pets`, matching `events`' precedent exactly:

```
    match /households/{householdId}/vets/{vetId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly([
          'id', 'householdId', 'clinicName', 'doctorName', 'address', 'phone',
          'openingHours', 'speciality', 'isEmergency24h', 'notes', 'petIds'
        ]);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

- [ ] **Step 6: Add rules tests for the new collection**

Read `__tests__/firestore.rules.test.ts` in full first — find the `events` test cases (added by Plan 6, search for `events`) and add an equivalent set for `vets` immediately after them, inside the same `describe('household security rules', ...)` block, following the exact same structure (a member can create/read/update, a non-member is denied). Use a test document shaped like:

```typescript
const validVet = {
  id: 'vet-1', householdId: 'h1', clinicName: 'Riverside Vet Clinic', doctorName: 'Dr. Novak',
  address: '12 River Rd', phone: '555-0100', openingHours: 'Mon-Fri 9am-6pm',
  speciality: 'General practice', isEmergency24h: false, notes: '', petIds: ['pet-1'],
};
```

Write these four cases (reuse the existing `seedPetHousehold` helper already in the file, which seeds `households/h1` with `user-1` as its only member):

```typescript
it('allows a member to create a vet', async () => {
  await seedPetHousehold();
  const memberDb = testEnv.authenticatedContext('user-1').firestore();
  await assertSucceeds(
    setDoc(doc(memberDb, 'households', 'h1', 'vets', 'vet-1'), validVet)
  );
});

it('denies a non-member from creating a vet', async () => {
  await seedPetHousehold();
  const strangerDb = testEnv.authenticatedContext('user-2').firestore();
  await assertFails(
    setDoc(doc(strangerDb, 'households', 'h1', 'vets', 'vet-1'), validVet)
  );
});

it('denies creating a vet with a field outside the allowlist', async () => {
  await seedPetHousehold();
  const memberDb = testEnv.authenticatedContext('user-1').firestore();
  await assertFails(
    setDoc(doc(memberDb, 'households', 'h1', 'vets', 'vet-1'), { ...validVet, vetIdOnVisit: 'sneaky' })
  );
});

it('allows a member to read and update a vet', async () => {
  await seedPetHousehold();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'households', 'h1', 'vets', 'vet-1'), validVet);
  });
  const memberDb = testEnv.authenticatedContext('user-1').firestore();
  await assertSucceeds(getDoc(doc(memberDb, 'households', 'h1', 'vets', 'vet-1')));
  await assertSucceeds(
    updateDoc(doc(memberDb, 'households', 'h1', 'vets', 'vet-1'), { clinicName: 'Renamed Clinic' })
  );
});
```

- [ ] **Step 7: Run all the tests**

Run: `npx jest __tests__/vetService.test.ts` — expect PASS.
Run: `npx tsc --noEmit` — expect no new errors.
Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"` — expect all rules tests to pass, including the new `vets` cases. (If `java -version` fails with "Could not spawn", prepend `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin` to `PATH` for this command.)

- [ ] **Step 8: Commit**

```bash
git add src/vets/vetService.ts firestore.rules __tests__/vetService.test.ts __tests__/firestore.rules.test.ts
git commit -m "feat: add household-level vets collection, service, and rules"
git push
```

**Do not deploy `firestore.rules` yet** — deploy once, at the end of this plan (Task 9).

---

### Task 3: `VetsScreen` — the real vets list

**Files:**
- Modify: `src/navigation/VetsScreen.tsx` (currently a static "coming soon" placeholder)

**Interfaces:**
- Consumes: `Vet`, `subscribeToVets` (Task 2); `Pet`, `subscribeToPets`, `activePets` (existing `petService.ts`); `usePetSelection()`, `<PetSelector pets={Pet[]} />` (existing).
- Produces: navigates to `'AddVet'` and `'EditVet'` (routes registered in Task 4/5 — forward references by string are fine, this codebase types every screen's `navigation` prop as `any`, exactly like `CalendarScreen`/`AddEventScreen`).

- [ ] **Step 1: Rewrite `VetsScreen.tsx`**

```tsx
// src/navigation/VetsScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Linking, Alert, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToVets } from '../vets/vetService';
import { firestore } from '../firebase/config';
import { usePetSelection } from '../selection/PetSelectionContext';
import { Pet } from '../types/pet';
import { Vet } from '../types/vet';
import {
  ScreenContainer, Card, Button, Title, Subtitle, BodyText, MutedText, PetSelector, GuidedEmptyState,
} from '../components/ui';
import { spacing, radii, colors } from '../theme/theme';

function openMaps(address: string) {
  const url = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert('Could not open Maps', 'Check your connection and try again.')
  );
}

function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() =>
    Alert.alert('Could not start a call', 'Check the phone number and try again.')
  );
}

function VetCard({ vet, navigation }: { vet: Vet; navigation: any }) {
  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Subtitle>{vet.clinicName}</Subtitle>
        {vet.isEmergency24h && (
          <View style={{ backgroundColor: colors.danger, borderRadius: radii.pill, paddingVertical: 2, paddingHorizontal: spacing.sm }}>
            <MutedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>24h emergency</MutedText>
          </View>
        )}
      </View>
      {vet.doctorName.length > 0 && <MutedText>{vet.doctorName}</MutedText>}
      {vet.speciality.length > 0 && <MutedText>{vet.speciality}</MutedText>}
      {vet.openingHours.length > 0 && <MutedText>{vet.openingHours}</MutedText>}
      {vet.address.length > 0 && (
        <Pressable onPress={() => openMaps(vet.address)} accessibilityRole="button" accessibilityLabel={`Open ${vet.address} in Maps`}>
          <BodyText style={{ color: colors.primary }}>📍 {vet.address}</BodyText>
        </Pressable>
      )}
      {vet.phone.length > 0 && (
        <Pressable onPress={() => callPhone(vet.phone)} accessibilityRole="button" accessibilityLabel={`Call ${vet.phone}`}>
          <BodyText style={{ color: colors.primary }}>📞 {vet.phone}</BodyText>
        </Pressable>
      )}
      {vet.notes.length > 0 && <MutedText>{vet.notes}</MutedText>}
      <Button title="Edit" variant="outline" onPress={() => navigation.navigate('EditVet', { vetId: vet.id })} />
    </Card>
  );
}

export function VetsScreen({ navigation }: any) {
  const { household } = useHousehold();
  const { selectedPetId } = usePetSelection();
  const [pets, setPets] = useState<Pet[]>([]);
  const [vets, setVets] = useState<Vet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVets(firestore, household.id, setVets);
  }, [household]);

  const filteredVets = vets.filter((v) => selectedPetId === 'all' || v.petIds.includes(selectedPetId));

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>Vets</Title>
      <PetSelector pets={pets} />
      <Button title="Add a vet" onPress={() => navigation.navigate('AddVet')} />
      <FlatList
        style={{ flex: 1 }}
        data={filteredVets}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
        renderItem={({ item }) => <VetCard vet={item} navigation={navigation} />}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="🩺"
            title="No vets yet"
            message="Save every clinic you've used, with contact details and which pets go there."
            actionLabel="Add a vet"
            onAction={() => navigation.navigate('AddVet')}
          />
        }
      />
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (the `'AddVet'`/`'EditVet'` navigation calls are untyped string routes, matching every other `navigation.navigate(...)` call in this codebase — they don't need to exist yet for this to type-check).

- [ ] **Step 3: Commit**

```bash
git add src/navigation/VetsScreen.tsx
git commit -m "feat: rewrite VetsScreen with a real pet-filtered vets list"
git push
```

---

### Task 4: `AddVetScreen` and wiring

**Files:**
- Create: `src/navigation/AddVetScreen.tsx`
- Modify: `src/navigation/AddSheet.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `createVet`, `NewVetInput` (Task 2); `Pet`, `subscribeToPets`, `activePets`; `petColor` (existing).

- [ ] **Step 1: Create `AddVetScreen.tsx`**

```tsx
// src/navigation/AddVetScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { createVet } from '../vets/vetService';
import { firestore } from '../firebase/config';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { ScreenContainer, TextField, Button, Chip, Title, BodyText, MutedText, ErrorText } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

export function AddVetScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [isEmergency24h, setIsEmergency24h] = useState(false);
  const [notes, setNotes] = useState('');
  const [petIds, setPetIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  const togglePet = (petId: string) => {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  };

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      await createVet(firestore, household.id, {
        clinicName, doctorName, address, phone, openingHours,
        speciality, isEmergency24h, notes, petIds,
      });
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Title>Add a vet</Title>
      <TextField label="Clinic name" placeholder="e.g. Riverside Vet Clinic" value={clinicName} onChangeText={setClinicName} />
      <TextField label="Doctor name" placeholder="Optional" value={doctorName} onChangeText={setDoctorName} />
      <TextField label="Address" placeholder="Optional" value={address} onChangeText={setAddress} />
      <TextField label="Phone" placeholder="Optional" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Opening hours" placeholder="e.g. Mon-Fri 9am-6pm" value={openingHours} onChangeText={setOpeningHours} />
      <TextField label="Speciality" placeholder="Optional, e.g. Exotic pets" value={speciality} onChangeText={setSpeciality} />
      <Chip label="24-hour emergency clinic" selected={isEmergency24h} onPress={() => setIsEmergency24h((v) => !v)} />
      <TextField
        label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes}
        multiline style={{ minHeight: 96, textAlignVertical: 'top' }}
      />

      <BodyText style={{ fontWeight: '700' }}>Which pets go there?</BodyText>
      <MutedText>Optional — you can leave this for later.</MutedText>
      <View style={{ gap: spacing.sm }}>
        {pets.map((pet) => {
          const selected = petIds.includes(pet.id);
          return (
            <Pressable
              key={pet.id}
              onPress={() => togglePet(pet.id)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
                borderRadius: radii.md, borderWidth: 1.5,
                borderColor: selected ? petColor(pet) : colors.border,
                backgroundColor: selected ? colors.surfaceTint : colors.surface,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: petColor(pet) }} />
              <BodyText>{pet.name}</BodyText>
            </Pressable>
          );
        })}
      </View>

      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Add vet" onPress={handleSubmit} disabled={clinicName.trim().length === 0} loading={loading} />
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Wire "Add a Vet" into the "+" sheet**

In `src/navigation/AddSheet.tsx`, add a new entry to the `ADD_ACTIONS` array (after the `'Add an Expense'` entry). It needs `topLevel: true` because — exactly like `'Add to Calendar'` — vets aren't pet-scoped, so it should reach a top-level `RootNavigator` route directly rather than being pushed onto the Pets tab's nested stack:

```typescript
{ label: 'Add a Vet', route: 'AddVet', needsPet: false, topLevel: true },
```

- [ ] **Step 3: Register the route in `RootNavigator.tsx`**

Add the import alongside the other screen imports:

```typescript
import { AddVetScreen } from './AddVetScreen';
```

Add a new `Stack.Screen` alongside `AddEvent`/`EditEvent`/`DayDetail` (inside the `household ? (...)` branch):

```tsx
<Stack.Screen
  name="AddVet"
  component={AddVetScreen}
  options={{ headerShown: true, title: 'Add a vet', headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }}
/>
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/AddVetScreen.tsx src/navigation/AddSheet.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: add AddVetScreen and wire it into the + sheet"
git push
```

---

### Task 5: `EditVetScreen` and wiring

**Files:**
- Create: `src/navigation/EditVetScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `updateVet`, `subscribeToVets` (Task 2); `Pet`, `subscribeToPets`, `activePets`; `petColor` (existing).

- [ ] **Step 1: Create `EditVetScreen.tsx`**

```tsx
// src/navigation/EditVetScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToVets, updateVet } from '../vets/vetService';
import { firestore } from '../firebase/config';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { ScreenContainer, TextField, Button, Chip, BodyText, MutedText, ErrorText } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

export function EditVetScreen({ route, navigation }: any) {
  const { vetId } = route.params;
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [isEmergency24h, setIsEmergency24h] = useState(false);
  const [notes, setNotes] = useState('');
  const [petIds, setPetIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Seeds the form once from the first snapshot that contains the vet, then
  // never again — same reasoning as EditEventScreen (Plan 6): without this,
  // any later snapshot while the form is open (another member's write, a
  // slow-network double delivery) would silently clobber whatever the user
  // has typed.
  const loadedVetRef = useRef(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVets(firestore, household.id, (vets) => {
      if (loadedVetRef.current) return;
      const vet = vets.find((v) => v.id === vetId);
      if (!vet) {
        if (vets.length > 0) setNotFound(true);
        return;
      }
      setClinicName(vet.clinicName);
      setDoctorName(vet.doctorName);
      setAddress(vet.address);
      setPhone(vet.phone);
      setOpeningHours(vet.openingHours);
      setSpeciality(vet.speciality);
      setIsEmergency24h(vet.isEmergency24h);
      setNotes(vet.notes);
      setPetIds(vet.petIds);
      setLoaded(true);
      loadedVetRef.current = true;
    });
  }, [household, vetId]);

  const togglePet = (petId: string) => {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  };

  const handleSave = async () => {
    if (!household) return;
    setError(null);
    setSaving(true);
    try {
      await updateVet(firestore, household.id, vetId, {
        clinicName, doctorName, address, phone, openingHours,
        speciality, isEmergency24h, notes, petIds,
      });
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (notFound) {
    return (
      <ScreenContainer>
        <ErrorText>Vet not found.</ErrorText>
        <Button title="Go back" onPress={() => navigation.goBack()} />
      </ScreenContainer>
    );
  }

  if (!loaded) {
    return (
      <ScreenContainer>
        <MutedText>Loading…</MutedText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <TextField label="Clinic name" value={clinicName} onChangeText={setClinicName} />
      <TextField label="Doctor name" placeholder="Optional" value={doctorName} onChangeText={setDoctorName} />
      <TextField label="Address" placeholder="Optional" value={address} onChangeText={setAddress} />
      <TextField label="Phone" placeholder="Optional" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Opening hours" placeholder="e.g. Mon-Fri 9am-6pm" value={openingHours} onChangeText={setOpeningHours} />
      <TextField label="Speciality" placeholder="Optional, e.g. Exotic pets" value={speciality} onChangeText={setSpeciality} />
      <Chip label="24-hour emergency clinic" selected={isEmergency24h} onPress={() => setIsEmergency24h((v) => !v)} />
      <TextField
        label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes}
        multiline style={{ minHeight: 96, textAlignVertical: 'top' }}
      />

      <BodyText style={{ fontWeight: '700' }}>Which pets go there?</BodyText>
      <View style={{ gap: spacing.sm }}>
        {pets.map((pet) => {
          const selected = petIds.includes(pet.id);
          return (
            <Pressable
              key={pet.id}
              onPress={() => togglePet(pet.id)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
                borderRadius: radii.md, borderWidth: 1.5,
                borderColor: selected ? petColor(pet) : colors.border,
                backgroundColor: selected ? colors.surfaceTint : colors.surface,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: petColor(pet) }} />
              <BodyText>{pet.name}</BodyText>
            </Pressable>
          );
        })}
      </View>

      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Save" onPress={handleSave} loading={saving} disabled={clinicName.trim().length === 0} />
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Register the route in `RootNavigator.tsx`**

Add the import:

```typescript
import { EditVetScreen } from './EditVetScreen';
```

Add a new `Stack.Screen` alongside `AddVet` (added in Task 4):

```tsx
<Stack.Screen
  name="EditVet"
  component={EditVetScreen}
  options={{ headerShown: true, title: 'Edit vet', headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }}
/>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/EditVetScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: add EditVetScreen"
git push
```

---

### Task 6: Household member limit (`memberCount` denormalization)

**Files:**
- Modify: `src/limits/limits.ts`
- Modify: `firestore.rules`
- Modify: `src/household/householdService.ts`
- Test: `__tests__/limits.test.ts`
- Modify: `__tests__/householdService.test.ts`
- Modify: `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Produces: `isHouseholdFull(memberCount: number): boolean`; `householdMemberLimitMessage(): string` (both in `limits.ts`). `joinHousehold`'s signature is unchanged but now throws a friendly `Error` (message from `householdMemberLimitMessage()`) instead of attempting the write when the household is full.

**Why this needs a new denormalized field:** the joining client is, by design, not yet a member and has no read access to the household document (`allow read: if isMember(resource.data)` — see the "household join flow" note in CLAUDE.md). There is no way to show them "this household is full" before they attempt to join without exposing the member count somewhere they CAN read — the already-readable `inviteCodes/{code}` document (readable via `get` by any signed-in user, Plan 1) is exactly that place, mirroring the same reasoning that put `householdId` there in the first place.

- [ ] **Step 1: Write the failing `limits.ts` tests**

Add these cases to the existing `describe('limits', ...)` block in `__tests__/limits.test.ts` (append after the last existing test):

```typescript
  it('reports a household as full at exactly the free member limit', () => {
    expect(isHouseholdFull(4)).toBe(true);
    expect(isHouseholdFull(3)).toBe(false);
  });

  it('returns an explanatory household-limit message, not a bare refusal', () => {
    expect(householdMemberLimitMessage()).toContain('4 household members');
  });
```

And add `isHouseholdFull, householdMemberLimitMessage` to the existing top-of-file import from `'../src/limits/limits'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/limits.test.ts`
Expected: FAIL — `isHouseholdFull`/`householdMemberLimitMessage` are not exported yet.

- [ ] **Step 3: Implement the `limits.ts` changes**

Add these two functions, and redefine `canAddHouseholdMember` in terms of the new one (same external behavior, single source of truth for the comparison):

```typescript
export function isHouseholdFull(memberCount: number): boolean {
  return memberCount >= FREE_HOUSEHOLD_MEMBERS;
}

export function householdMemberLimitMessage(): string {
  return `The free plan includes up to ${FREE_HOUSEHOLD_MEMBERS} household members. Upgrading lifts the limit.`;
}

export function canAddHouseholdMember(household: { members: unknown[] }): boolean {
  return !isHouseholdFull(household.members.length);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/limits.test.ts`
Expected: PASS, all cases (including the pre-existing ones — `canAddHouseholdMember`'s external behavior is unchanged).

- [ ] **Step 5: Add the `memberCount` update rule to `inviteCodes`**

Read `firestore.rules`'s `match /inviteCodes/{code}` block first (search for it — the block with the long comment about why it exists). Replace its `create` allowlist and its `allow update, delete: if false;` line:

Replace:
```
      allow create: if request.auth != null &&
        request.resource.data.keys().hasOnly(['householdId']);
      allow update, delete: if false;
```

With:
```
      allow create: if request.auth != null &&
        request.resource.data.keys().hasOnly(['householdId', 'memberCount']);

      // memberCount is a denormalized mirror of the household's member
      // count (Plan 7), read here by a non-member client (joinHousehold)
      // specifically so it can show a friendly "household is full" message
      // BEFORE attempting to join — the joining client has no read grant on
      // the household document itself (see the comment above), so this is
      // the only place that count can come from. This is intentionally an
      // advisory-only soft cap, the same tier as Plan 4's custom-field
      // limit (also not rules-enforced): a signed-in user could in
      // principle write an inaccurate count here, but that only affects
      // what gets DISPLAYED before a join attempt, not who can actually
      // join a household they don't belong to — isMember/isJoining on the
      // household document itself are the real access-control boundary and
      // are completely unaffected by this field. householdId is kept
      // immutable so this rule can never be used to repoint a code at a
      // different household.
      allow update: if request.auth != null &&
        request.resource.data.householdId == resource.data.householdId &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount']);
      allow delete: if false;
```

- [ ] **Step 6: Update `createHousehold` and `joinHousehold` in `householdService.ts`**

Update the import line at the top of the file to add `increment` and `arrayRemove` (the latter is needed by Task 7, adding it now avoids a second import-line edit):

```typescript
import { collection, doc, getDoc, arrayUnion, arrayRemove, increment, writeBatch, type Firestore } from '@react-native-firebase/firestore';
import { Household, HouseholdMember } from '../types/household';
import { isHouseholdFull, householdMemberLimitMessage } from '../limits/limits';
```

In `createHousehold`, change the one line that sets the `inviteCodes` document:

```typescript
    batch.set(doc(db, 'inviteCodes', inviteCode), { householdId: docRef.id, memberCount: 1 });
```

Replace the whole `joinHousehold` function body with:

```typescript
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

  const { householdId, memberCount } = inviteSnap.data() as { householdId: string; memberCount?: number };

  // memberCount is a denormalized mirror of the household's member count
  // (see firestore.rules) — the only way a non-member client can see it,
  // since it has no read access to the household document itself. Checking
  // it here, before attempting the join write at all, is what lets this
  // throw a friendly, specific message instead of a bare permission-denied
  // error surfacing from a rules rejection. A missing memberCount (a
  // household created before this field existed) is treated as 0 — the
  // safe, fail-open direction.
  if (isHouseholdFull(memberCount ?? 0)) {
    throw new Error(householdMemberLimitMessage());
  }

  const newMember: HouseholdMember = { userId, displayName, joinedAt: Date.now() };

  // Batched with the users/{uid} pointer write and the inviteCodes
  // memberCount increment below so all three succeed or fail together.
  const batch = writeBatch(db);
  batch.update(doc(db, 'households', householdId), {
    members: arrayUnion(newMember),
    memberIds: arrayUnion(userId),
    joinCodeUsed: inviteCode,
  });
  batch.update(doc(db, 'inviteCodes', inviteCode), {
    memberCount: increment(1),
  });
  batch.set(doc(db, 'users', userId), { householdId });
  await batch.commit();
}
```

- [ ] **Step 7: Update `__tests__/householdService.test.ts`**

This file needs several coordinated changes (new mocks, an updated assertion, new test cases). Replace the whole file with:

```typescript
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'generated-id' };
const mockInviteDocRef = { id: 'invite-ref' };
const mockHouseholdDocRef = { id: 'h1' };
const mockUsersDocRef = { id: 'users-ref' };
const mockCollectionRef = {};
const mockGetDoc = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));
const mockArrayRemove = jest.fn((value: unknown) => ({ __arrayRemove: [value] }));
const mockIncrement = jest.fn((value: number) => ({ __increment: value }));
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn((..._args: unknown[]) => ({
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
    return mockCreatedDocRef; // doc(collectionRef) auto-id case, used by createHousehold
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
  arrayRemove: (...args: unknown[]) => mockArrayRemove(args[0]),
  increment: (...args: unknown[]) => mockIncrement(args[0] as number),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { createHousehold, joinHousehold, getHousehold } from '../src/household/householdService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
});

describe('householdService', () => {
  it('creates a household, its invite code (with a starting memberCount of 1), and a users/{uid} pointer in one batch', async () => {
    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.members).toEqual([
      expect.objectContaining({ userId: 'user-1', displayName: 'Ana' }),
    ]);
    expect(household.memberIds).toEqual(['user-1']);
    expect(household.inviteCode).toHaveLength(6);
    expect(mockWriteBatch).toHaveBeenCalledWith(fakeDb);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedDocRef, household);
    expect(mockBatchSet).toHaveBeenCalledWith(mockInviteDocRef, { householdId: 'generated-id', memberCount: 1 });
    expect(mockBatchSet).toHaveBeenCalledWith(mockUsersDocRef, { householdId: 'generated-id' });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('retries with a freshly generated invite code and a new batch when commit fails (e.g. an invite-code collision)', async () => {
    mockBatchCommit
      .mockRejectedValueOnce(new Error('permission-denied: inviteCodes doc already exists'))
      .mockResolvedValueOnce(undefined);

    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.inviteCode).toHaveLength(6);
    expect(mockWriteBatch).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedDocRef, household);
  });

  it('throws the last commit error after exhausting all retry attempts', async () => {
    const failure = new Error('permission-denied: inviteCodes doc already exists');
    mockBatchCommit.mockRejectedValue(failure);

    await expect(
      createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household")
    ).rejects.toThrow(failure.message);

    expect(mockBatchCommit).toHaveBeenCalledTimes(5);
  });

  it('joins a household and writes the users/{uid} pointer and an inviteCodes memberCount increment in the same batch', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ householdId: 'h1', memberCount: 1 }) });

    await joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123');

    expect(mockGetDoc).toHaveBeenCalledWith(mockInviteDocRef);
    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2', displayName: 'Marko' })
    );
    expect(mockArrayUnion).toHaveBeenCalledWith('user-2');
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, {
      members: { __arrayUnion: [expect.objectContaining({ userId: 'user-2' })] },
      memberIds: { __arrayUnion: ['user-2'] },
      joinCodeUsed: 'ABC123',
    });
    expect(mockIncrement).toHaveBeenCalledWith(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockInviteDocRef, { memberCount: { __increment: 1 } });
    expect(mockBatchSet).toHaveBeenCalledWith(mockUsersDocRef, { householdId: 'h1' });
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('throws a friendly message and writes nothing when the household is already at the free member limit', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ householdId: 'h1', memberCount: 4 }) });

    await expect(
      joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123')
    ).rejects.toThrow('4 household members');
    expect(mockWriteBatch).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('treats a missing memberCount (a household created before this field existed) as under the limit', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ householdId: 'h1' }) });

    await joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123');

    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('throws when the invite code does not match any household', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

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

(This drops the unused `mockArrayRemove`/`mockIncrement` lint-wise — they're intentionally added now and consumed by the `removeMember` tests Task 7 adds to this same file.)

- [ ] **Step 8: Run all the tests**

Run: `npx jest __tests__/limits.test.ts __tests__/householdService.test.ts` — expect PASS.
Run: `npx tsc --noEmit` — expect no new errors.

- [ ] **Step 9: Add rules tests for the `inviteCodes` `memberCount` update**

Add these cases to `__tests__/firestore.rules.test.ts`, inside the same `describe('household security rules', ...)` block, right after the existing `'denies creating an invite-code entry with extra fields'` test:

```typescript
  it('allows creating an invite-code entry with householdId and memberCount', async () => {
    const creatorDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(creatorDb, 'inviteCodes', 'ZZZ999'), { householdId: 'h2', memberCount: 1 })
    );
  });

  it("allows any signed-in user to update an invite code's memberCount", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1', memberCount: 1 });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(
      updateDoc(doc(someUserDb, 'inviteCodes', 'ABC123'), { memberCount: 2 })
    );
  });

  it('denies repointing an invite code at a different household via a memberCount update', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1', memberCount: 1 });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(someUserDb, 'inviteCodes', 'ABC123'), { householdId: 'h-hijacked', memberCount: 2 })
    );
  });
```

- [ ] **Step 10: Run the rules tests**

Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"` — expect all rules tests to pass, including the three new ones. (Prepend the JDK path to `PATH` if `java -version` fails to spawn — see CLAUDE.md.)

- [ ] **Step 11: Commit**

```bash
git add src/limits/limits.ts firestore.rules src/household/householdService.ts __tests__/limits.test.ts __tests__/householdService.test.ts __tests__/firestore.rules.test.ts
git commit -m "feat: enforce the free household-member limit with a friendly join-time message"
git push
```

---

### Task 7: Remove a household member, and the recovery path

**Files:**
- Modify: `firestore.rules`
- Modify: `src/household/householdService.ts`
- Modify: `__tests__/householdService.test.ts`
- Modify: `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Produces: `removeMember(db, householdId: string, inviteCode: string, member: HouseholdMember): Promise<void>` in `householdService.ts`. Task 8 (`HouseholdScreen`) calls this.

**Why the recovery-path fix is a `users/{userId}` rules change, not a change to how removal itself works:** removing a member is already a permitted write today — `allow update: if isMember(resource.data) || isJoining(resource.data);` on the household document has no field-shape restriction when the requester is a current member, so `arrayRemove` on `members`/`memberIds` already passes. The actual known gap (CLAUDE.md: "a user whose household document becomes unreadable... has no in-app recovery path") is that `users/{userId}` is create-once/immutable, so a removed member's stale pointer can never be overwritten — `createHousehold`/`joinHousehold` both fail the moment they try to `set` a `users/{uid}` doc that already exists. The fix relaxes that one rule: a user may overwrite their OWN pointer once they are no longer a member of the household it currently names. This needs no new cross-document write from the REMOVER's side and no assumption about write ordering within a batch (a documented open question elsewhere in this file) — it only ever depends on the CURRENT (pre-write) state of documents the requester is reading about themselves.

- [ ] **Step 1: Write the failing `removeMember` test**

Add these cases to `__tests__/householdService.test.ts` (the file Task 6 just rewrote), inside the existing `describe('householdService', ...)` block, right after the `'returns null from getHousehold...'` test. Also change the import line to include `removeMember`:

```typescript
import { createHousehold, joinHousehold, getHousehold, removeMember } from '../src/household/householdService';
```

```typescript
  it('removes a member from both members and memberIds, and decrements the invite code memberCount, in one batch', async () => {
    const member = { userId: 'user-2', displayName: 'Marko', joinedAt: 0 };

    await removeMember(fakeDb, 'h1', 'ABC123', member);

    expect(mockArrayRemove).toHaveBeenCalledWith(member);
    expect(mockArrayRemove).toHaveBeenCalledWith('user-2');
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, {
      members: { __arrayRemove: [member] },
      memberIds: { __arrayRemove: ['user-2'] },
    });
    expect(mockIncrement).toHaveBeenCalledWith(-1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockInviteDocRef, { memberCount: { __increment: -1 } });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/householdService.test.ts`
Expected: FAIL — `removeMember` is not exported yet.

- [ ] **Step 3: Implement `removeMember`**

Add this function to `src/household/householdService.ts` (after `getHousehold`):

```typescript
export async function removeMember(
  db: Firestore,
  householdId: string,
  inviteCode: string,
  member: HouseholdMember
): Promise<void> {
  // No new rules permission is needed for this write — isMember(resource.data)
  // already allows any current member to update members/memberIds with no
  // field-shape restriction (see the big isMember/isJoining comment block at
  // the top of firestore.rules). The actual fix this plan makes is the
  // users/{userId} recovery-path rule below, which lets the REMOVED member's
  // own client repair their stale pointer the next time they try to create
  // or join a household — this function does not touch users/{removedUid}
  // at all, deliberately avoiding any dependency on write ordering within
  // this batch.
  const batch = writeBatch(db);
  batch.update(doc(db, 'households', householdId), {
    members: arrayRemove(member),
    memberIds: arrayRemove(member.userId),
  });
  batch.update(doc(db, 'inviteCodes', inviteCode), {
    memberCount: increment(-1),
  });
  await batch.commit();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/householdService.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Add the recovery-path rule to `users/{userId}`**

Read `firestore.rules`'s `match /users/{userId}` block first (search for it — the last block in the file). Replace its `allow create`/`allow update, delete` lines:

Replace:
```
      allow create: if request.auth != null && request.auth.uid == userId &&
        request.resource.data.keys().hasOnly(['householdId']);
      allow update, delete: if false;
```

With:
```
      allow create: if request.auth != null && request.auth.uid == userId &&
        request.resource.data.keys().hasOnly(['householdId']);

      // Recovery path (Plan 7) for the standing "a removed household member
      // has no way back in" gap: a removed member's pointer still names
      // their OLD household. `resource` below is that EXISTING document
      // (pre-write) — this rule lets a user overwrite their OWN pointer
      // only once they are no longer in the memberIds of the household it
      // currently names, so a still-active member cannot touch their own
      // pointer this way (they'd have to actually be removed first). This
      // depends only on the CURRENT committed state of the household
      // document being read, never on any other write in the same batch —
      // removeMember (householdService.ts) does not touch this document at
      // all; the removed user's own next createHousehold/joinHousehold call
      // is what exercises this rule, driven by the exact same
      // batch.set(doc(db,'users',userId), {householdId}) call those
      // functions already make (Firestore classifies a write to an existing
      // doc as `update` regardless of set() vs update(), so no client code
      // change was needed for this — see the comment on `allow get` above).
      allow update: if request.auth != null && request.auth.uid == userId &&
        request.resource.data.keys().hasOnly(['householdId']) &&
        !(request.auth.uid in get(/databases/$(database)/documents/households/$(resource.data.householdId)).data.memberIds);
      allow delete: if false;
```

Also update the now-stale comment on the existing `'denies overwriting an existing users/{uid} pointer'` rationale if you left one referencing "changing households... needs its own future design" — that's now partially addressed by this rule; leave a one-line note that a STILL-ACTIVE member still can't overwrite their pointer, only a removed one can.

- [ ] **Step 6: Add rules tests for the recovery path**

Add these cases to `__tests__/firestore.rules.test.ts`, inside `describe('household security rules', ...)`, right after the existing `'denies overwriting an existing users/{uid} pointer'` test:

```typescript
  it('lets a removed member overwrite their stale household pointer', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      // user-1's pointer still names h1, but h1's memberIds no longer
      // includes them (they were removed, or never actually re-added after
      // seedHousehold — either way, the rule only cares about the CURRENT
      // memberIds of the household the stale pointer names).
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
      await setDoc(doc(context.firestore(), 'households', 'h1'), {
        id: 'h1', name: 'Test Household',
        members: [{ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }],
        memberIds: ['user-2'],
        inviteCode: 'ABC123', createdAt: 0,
      });
    });
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(userDb, 'users', 'user-1'), { householdId: 'h2' })
    );
  });

  it('still denies a current member from overwriting their own pointer', async () => {
    await seedHousehold(); // user-1 is a member of h1
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
    });
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(userDb, 'users', 'user-1'), { householdId: 'h2' })
    );
  });

  it('allows a member to remove another member from the household', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1'), {
        id: 'h1', name: 'Test Household',
        members: [
          { userId: 'user-1', displayName: 'Ana', joinedAt: 0 },
          { userId: 'user-2', displayName: 'Marko', joinedAt: 0 },
        ],
        memberIds: ['user-1', 'user-2'],
        inviteCode: 'ABC123', createdAt: 0,
      });
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      updateDoc(doc(memberDb, 'households', 'h1'), {
        members: arrayRemove({ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }),
        memberIds: arrayRemove('user-2'),
      })
    );
  });
```

This file's existing top-of-file import already includes `arrayUnion` from `'firebase/firestore'` — add `arrayRemove` alongside it.

- [ ] **Step 7: Run all the tests**

Run: `npx jest __tests__/householdService.test.ts` — expect PASS.
Run: `npx tsc --noEmit` — expect no new errors.
Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"` — expect all rules tests to pass, including the three new ones.

- [ ] **Step 8: Commit**

```bash
git add firestore.rules src/household/householdService.ts __tests__/householdService.test.ts __tests__/firestore.rules.test.ts
git commit -m "feat: add remove-member and fix the removed-member recovery-path gap"
git push
```

---

### Task 8: `HouseholdScreen` rewrite

**Files:**
- Modify: `src/navigation/HouseholdScreen.tsx`

**Interfaces:**
- Consumes: `removeMember` (Task 7); `FREE_HOUSEHOLD_MEMBERS`, `canAddHouseholdMember`, `householdMemberLimitMessage` (Task 6); `useAuth()` (existing, returns `{ user }`); `useHousehold()` (existing).

- [ ] **Step 1: Rewrite `HouseholdScreen.tsx`**

```tsx
// src/navigation/HouseholdScreen.tsx
import React from 'react';
import { FlatList, Share, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { removeMember } from '../household/householdService';
import { firestore } from '../firebase/config';
import { FREE_HOUSEHOLD_MEMBERS, canAddHouseholdMember, householdMemberLimitMessage } from '../limits/limits';
import { HouseholdMember } from '../types/household';
import { ScreenContainer, Card, Title, Subtitle, MutedText, Button } from '../components/ui';
import { spacing } from '../theme/theme';

export function HouseholdScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();

  const handleShare = () => {
    if (!household) return;
    Share.share({
      message: `Join our household on Pet Health Tracker! Use invite code: ${household.inviteCode}`,
    });
  };

  const handleRemove = (member: HouseholdMember) => {
    if (!household) return;
    Alert.alert(
      'Remove member',
      `Remove ${member.displayName} from this household? They will need a new invite to rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(firestore, household.id, household.inviteCode, member);
            } catch (e: any) {
              Alert.alert('Could not remove member', e.message);
            }
          },
        },
      ]
    );
  };

  const atLimit = household ? !canAddHouseholdMember(household) : false;

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>{household?.name ?? 'Household'}</Title>

      <Card style={{ gap: spacing.xs }}>
        <Subtitle>Invite code</Subtitle>
        <Title style={{ letterSpacing: 4 }}>{household?.inviteCode ?? '------'}</Title>
        <Button title="Share invite" onPress={handleShare} />
      </Card>

      <MutedText>{household?.members.length ?? 0} of {FREE_HOUSEHOLD_MEMBERS} members</MutedText>
      {atLimit && <MutedText>{householdMemberLimitMessage()}</MutedText>}

      <FlatList
        data={household?.members ?? []}
        keyExtractor={(m) => m.userId}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Subtitle>{item.displayName}{item.userId === user?.uid ? ' (You)' : ''}</Subtitle>
            {item.userId !== user?.uid && (
              <Button title="Remove" variant="outline" onPress={() => handleRemove(item)} />
            )}
          </Card>
        )}
      />
      {__DEV__ && (
        <Button
          variant="outline"
          title="Developer: style guide"
          onPress={() => navigation.navigate('PetsTab', { screen: 'DevStyleGuide' })}
        />
      )}
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/HouseholdScreen.tsx
git commit -m "feat: rewrite HouseholdScreen with invite sharing, member limit, and remove-member"
git push
```

---

### Task 9: Deploy rules, whole-plan verification, and the device checklist

**Files:** none new — this task is verification and a manual deploy, not code.

This plan's rules changes (Tasks 2, 6, 7) must actually reach the live Firebase project, or they will fail exactly the way Plan 5's `vetVisits` update once did — a real permission-denied error on-device despite passing every local/emulator test. Deploy once, now, after every task above has landed.

- [ ] **Step 1: Deploy the rules**

```bash
firebase deploy --only firestore:rules --project pet-tracker-app-63512
```

Expected output ends with `+ Deploy complete!`.

- [ ] **Step 2: Full verification pass**

Run: `npx tsc --noEmit` — expect zero errors across the whole project.
Run: `npx jest` — expect every non-rules test to pass.
Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"` — expect every rules test to pass.

- [ ] **Step 3: On-device checklist**

Build and launch from `C:\dev\pet-app` (`npx expo run:android`) and check, on the real phone. Per CLAUDE.md's "Local device build environment," remember to recreate `android/local.properties` and copy `google-services.json` into `android/app/` if this is a fresh worktree/checkout.

Vets:
- Add a vet with every field filled in, including the 24-hour-emergency flag and two pets selected. Confirm it shows up filtered under each of those two pets individually, and under "All Pets."
- Add a vet with only a clinic name and nothing else (the execution pack's own explicit check) — confirm it saves and displays without a crash or a blank-looking card.
- Tap an address — confirm it opens the phone's Maps app (not a map inside this app). Tap it with the phone in airplane mode — confirm a graceful "could not open" message, not a crash.
- Tap a phone number — confirm it opens the phone dialer pre-filled, not an actual call.
- Edit a vet's details and save — confirm the change persists (re-open the app or re-navigate to confirm it wasn't only local state).
- Reach "Add a Vet" from the global "+" sheet while on a tab other than Vets — confirm it still reaches `AddVetScreen` (this is what Task 4's `topLevel` routing exists to guarantee).

Household:
- Tap "Share invite" — confirm the phone's native share sheet opens with the invite code in the message.
- **Actually join from a second phone using the share button and the invite code it produces.** This is the feature the whole product is built on — test it properly, twice (per the execution pack's explicit callout).
- With 4 members already in a household, attempt to join a 5th — confirm a clear, non-insulting message is shown (not a generic error), and no 5th member is actually added.
- Remove a member (not yourself) from the Household tab — confirm the confirmation dialog appears, and after confirming, the member disappears from the list and the member count updates.
- On the removed member's own phone/account, confirm they can now create a brand-new household OR join a different one via invite code — this is the recovery-path fix; confirm it actually works end-to-end, not just that the rules tests pass.
- Confirm a member who has NOT been removed still cannot be made to lose their household by any action in the app (i.e. nothing regresses the existing multi-day-old real household's members).

If anything fails, it's a real bug in already-merged `master` code — fix it directly on `master` with small, targeted commits (per the standing commit/push-freely authorization), the same way this session's earlier device-verification bugs were fixed, rather than opening a new worktree for what should be a quick fix.

- [ ] **Step 4: Update `NEXTSTEPS.md`/`CLAUDE.md`**

Once the checklist passes, update both files the same way previous plans closed out: mark Plan 7 complete and device-verified, record what it built (mirroring the "Calendar (Plan 6)" or "Reminders and notifications (Plan 5)" style permanent-reference paragraph in CLAUDE.md — including the `memberCount` denormalization rationale and the `users/{userId}` recovery-path rule, since both are non-obvious enough that a future session will need the "why," not just the "what"), and move Plan 8 ("Medical records, documents, and the pet passport") into the "next" slot.
