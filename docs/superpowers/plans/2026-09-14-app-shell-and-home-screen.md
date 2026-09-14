# Pet Health Tracker — App Shell and Home Screen Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat stack navigation with a bottom tab bar (Pets, Calendar, Vets, Household + a raised "+" add button), rebuild the pet list as a one-card-per-pet home screen showing what's next due, give every pet a consistent identity colour, and add a shared "All pets / one pet" selector component that every later list screen (Plans 4–8) will reuse.

**Architecture:** `RootNavigator`'s existing `Main` route currently mounts `MainNavigator` (a flat `createNativeStackNavigator` with 13 screens) directly. This plan inserts a new `MainTabs` (a `createBottomTabNavigator`) between them: `RootNavigator` now mounts `MainTabs`, and the *existing* `MainNavigator` becomes the nested stack for just the "Pets" tab (its root screen changes from `PetListScreen` to a new `HomeScreen`; everything else in it — `AddPet`, `PetHome`, and all ten record-type screens — is untouched). The other three tabs (`Calendar`, `Vets`, `Household`) are single screens, not nested stacks, since none of them have sub-navigation yet. Reminders/due-date computation is explicitly **not** built here — that is Plan 5's job (a self-contained, unit-tested pure function per the execution pack). This plan adds a deliberately minimal, vaccine-only "what's next" lookup on the home screen so cards aren't empty, and documents that Plan 5 replaces it.

**Tech Stack:** Same as Plans 1–2, plus two new pure-JS dependencies: `@react-navigation/bottom-tabs` (tab bar, same major version as the already-installed `@react-navigation/native` v7) and `@expo/vector-icons` (icon set — bundled with the Expo SDK's font-loading machinery via `expo-font`, which is already a transitive dependency of `expo`, but confirmed **not currently installed** in this repo — see Task 1).

**Spec:** [docs/superpowers/specs/2026-09-13-execution-pack.md](../specs/2026-09-13-execution-pack.md) (Phase 1 planning prompt) and [docs/superpowers/specs/2026-09-13-build-plan.md](../specs/2026-09-13-build-plan.md) (sections 1, 2c, 3, 4 — the reasoning behind this scope). Also inherits Plan 1's and Plan 2's specs/constraints.

## Global Constraints

- Do not replace the existing design system (`src/theme/theme.ts`, `src/components/ui/`) — extend it. Teal (`colors.primary` `#0891B2`) and orange (`colors.accent` `#F97316`) stay as-is (execution pack: Phase 1 scope).
- New dependencies must not require a native rebuild unless explicitly called out and confirmed necessary (execution pack: Phase 1 scope — "do not add a new native dependency for this").
- Every security-rules change follows CLAUDE.md's pet-records pattern exactly: `isHouseholdMember(householdId)` read/write gate + a `create`-time `hasOnly([...])` field allowlist. Never add `hasAll`/`diff()` hijack machinery outside `isJoining()` (CLAUDE.md: "Pet records data model").
- Reminder/due-date computation stays out of this plan — Plan 5 owns it as a pure, Firebase-free function (execution pack Phase 3). This plan's home-screen "what's next" is explicitly temporary and minimal.
- Species stays `'dog' | 'cat' | 'other'` — expanding it is Plan 4 scope (execution pack Phase 2). Do not touch `PetSpecies` in this plan.
- Full pet editing (name/species/breed/etc.) is Plan 4 scope ("Editing a pet afterwards" — execution pack Phase 2). This plan only adds a narrow, single-purpose way to change a pet's colour — not a general edit-pet screen.
- TypeScript throughout, matching Plans 1–2.

---

## File Structure

```
src/
  theme/
    petColors.ts                 # NEW: fixed 8-colour palette + assignPetColor()
  pets/
    petService.ts                # MODIFIED: createPet assigns colorKey; add updatePetColor()
    upcomingSummary.ts           # NEW: minimal, vaccine-only "what's next" lookup (temporary — Plan 5 replaces)
  selection/
    PetSelectionContext.tsx      # NEW: shared selected-pet state ('all' | petId)
  components/
    ui/
      PetSelector.tsx            # NEW: shared "All pets / one pet" horizontal selector
  navigation/
    MainTabs.tsx                 # NEW: bottom tab navigator (Pets/Calendar/Vets/Household + "+")
    AddSheet.tsx                 # NEW: "+" button action sheet
    ChoosePetForAddScreen.tsx    # NEW: single-pet picker shown when "+" needs a pet and none/multiple selected
    HomeScreen.tsx                # NEW: one card per pet, replaces PetListScreen as the Pets-tab root
    CalendarScreen.tsx            # NEW: empty-state stub
    VetsScreen.tsx                 # NEW: empty-state stub
    HouseholdScreen.tsx             # NEW: read-only household name + member list, dev-only style guide entry point
    DevStyleGuideScreen.tsx          # NEW: __DEV__-gated design system reference screen
    MainNavigator.tsx                # MODIFIED: root screen PetListScreen -> HomeScreen; doc comment clarifying it's now the Pets-tab's nested stack
    RootNavigator.tsx                 # MODIFIED: mounts MainTabs instead of MainNavigator
    PetListScreen.tsx                  # DELETED — superseded by HomeScreen.tsx
    PetHomeScreen.tsx                   # MODIFIED: add a small colour-swatch row to change a pet's colour
firestore.rules                          # MODIFIED: pets' create hasOnly allowlist gains 'colorKey'
App.tsx                                   # MODIFIED: wrap RootNavigator with PetSelectionProvider
__tests__/
  petColors.test.ts                       # NEW
  upcomingSummary.test.ts                  # NEW
  firestore.rules.test.ts                   # MODIFIED: colorKey coverage
```

---

### Task 1: Install bottom-tabs and the icon set, verify no native rebuild is needed

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `@react-navigation/bottom-tabs`'s `createBottomTabNavigator` and `@expo/vector-icons`'s `Ionicons` component, available to every later task in this plan.

**Why this is its own task:** the execution pack claims the icon set "ships with Expo... adds nothing to install," but a verification pass on 2026-09-14 confirmed `@expo/vector-icons` is in neither `package.json` nor `node_modules` — it genuinely needs installing. Both packages are pure JS + bundled font assets with no native module surface of their own (they ride on `expo-font`, already wired in by the `expo` package itself), so the expectation is that `npx expo run:android` works without an `expo prebuild` — but that expectation must be verified on the real device before later tasks build on top of it, not assumed.

- [ ] **Step 1: Install**

```bash
npx expo install @react-navigation/bottom-tabs @expo/vector-icons
```

- [ ] **Step 2: Verify no prebuild/native rebuild is needed**

Run:
```bash
npx tsc --noEmit
npx expo run:android
```

Expected: the existing app still builds and launches on the connected device with no Gradle changes required and no `expo prebuild` run in between. If `expo run:android` fails or Gradle reports a new native module needing linking, stop and flag this — it would mean the execution pack's "adds nothing to install" claim is wrong in a bigger way than expected, and the plan's later tasks (which assume no rebuild) need re-checking before proceeding.

- [ ] **Step 3: Smoke-test the icon import**

Temporarily add to `App.tsx` (revert after confirming, this is a throwaway check, not a committed change):
```typescript
import { Ionicons } from '@expo/vector-icons';
// ...
<Ionicons name="paw" size={24} color="black" />
```
Confirm on the phone that a paw icon renders (not a missing-glyph box) before removing this temporary snippet. This confirms the font asset actually loaded, not just that the import resolved.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @react-navigation/bottom-tabs and @expo/vector-icons"
git push origin master
```

---

### Task 2: Pet identity colour — palette, `colorKey` field, rules, and a way to change it

**Files:**
- Create: `src/theme/petColors.ts`
- Test: `__tests__/petColors.test.ts`
- Modify: `src/types/pet.ts`, `src/pets/petService.ts`, `firestore.rules`, `__tests__/firestore.rules.test.ts`, `src/navigation/AddPetScreen.tsx`, `src/navigation/PetHomeScreen.tsx`, `__tests__/petService.test.ts`

**Interfaces:**
- Produces: `PET_COLORS: string[]`, `assignPetColor(existingPets: Pet[]): string` (pure); `Pet.colorKey: string`; `updatePetColor(db, householdId, petId, colorKey): Promise<void>` — consumed by `AddPetScreen` (auto-assignment on create), `PetHomeScreen` (manual change), `PetSelector` (Task 3), and `HomeScreen` (Task 5).

**Design decision:** a fixed 8-colour round-robin palette, not a colour picker or hash-based assignment — simplest thing that gives visually distinct, deterministic colours, matching this project's existing "no unnecessary complexity" pattern (e.g. `WeightTrendChart`'s hand-rolled bars). A household with more than 8 pets reuses colours; acceptable for MVP, noted in Assumptions.

**On "let it be changed when editing a pet":** there is no general edit-pet screen yet (that's Plan 4 — "Editing a pet afterwards" is explicit Phase 2 scope). Building one now would duplicate work Plan 4 is about to do properly. Instead, this task adds a single-purpose colour-swatch row to the existing `PetHomeScreen.tsx`, next to the avatar — narrow, immediately useful, and nothing Plan 4 needs to undo.

- [ ] **Step 1: Write the palette and assignment function**

```typescript
// src/theme/petColors.ts
import { Pet } from '../types/pet';

// Chosen to read clearly against colors.background (#F8FAFC) and stay
// visually distinct from the brand teal/orange (colors.primary/accent) so a
// pet's identity colour is never mistaken for a UI accent.
export const PET_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#84CC16', // lime
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#78716C', // warm gray
];

export function assignPetColor(existingPets: Pet[]): string {
  return PET_COLORS[existingPets.length % PET_COLORS.length];
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/petColors.test.ts
import { PET_COLORS, assignPetColor } from '../src/theme/petColors';
import { Pet } from '../src/types/pet';

const fakePet = (colorKey: string): Pet => ({
  id: 'x', householdId: 'h1', name: 'x', species: 'dog', breed: '', birthDate: 0,
  photoUrl: null, colorKey,
});

describe('assignPetColor', () => {
  it('assigns the first palette colour to the first pet', () => {
    expect(assignPetColor([])).toBe(PET_COLORS[0]);
  });

  it('assigns the next palette colour for each additional pet', () => {
    expect(assignPetColor([fakePet(PET_COLORS[0])])).toBe(PET_COLORS[1]);
    expect(assignPetColor([fakePet(PET_COLORS[0]), fakePet(PET_COLORS[1])])).toBe(PET_COLORS[2]);
  });

  it('wraps around after the palette is exhausted', () => {
    const eightPets = PET_COLORS.map(fakePet);
    expect(assignPetColor(eightPets)).toBe(PET_COLORS[0]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest __tests__/petColors.test.ts`
Expected: FAIL — `Pet` doesn't have `colorKey` yet (TypeScript error) and the module doesn't exist.

- [ ] **Step 4: Add `colorKey` to the `Pet` type**

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
  colorKey: string; // one of PET_COLORS (src/theme/petColors.ts)
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/petColors.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Wire `colorKey` into `petService.ts`**

```typescript
// src/pets/petService.ts — extend createPet's signature and body:
import { Pet, PetSpecies } from '../types/pet';
import { assignPetColor } from '../theme/petColors';

export async function createPet(
  db: Firestore,
  householdId: string,
  name: string,
  species: PetSpecies,
  breed: string,
  birthDate: number,
  existingPets: Pet[]
): Promise<Pet> {
  const docRef = doc(collection(db, 'households', householdId, 'pets'));
  const pet: Pet = {
    id: docRef.id, householdId, name, species, breed, birthDate,
    photoUrl: null, colorKey: assignPetColor(existingPets),
  };
  await setDoc(docRef, pet);
  return pet;
}

export async function updatePetColor(
  db: Firestore,
  householdId: string,
  petId: string,
  colorKey: string
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId), { colorKey });
}
```

`createPet` now needs the household's current pets to pick the next colour — the caller (`AddPetScreen`, Step 8 below) already has this from `subscribeToPets`/`useHousehold`, no new data fetch required.

- [ ] **Step 7: Update `__tests__/petService.test.ts` for the new signature**

```typescript
// __tests__/petService.test.ts — update the existing "creates a pet" test:
  it('creates a pet under the household with an assigned colour', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const pet = await createPet(fakeDb, 'h1', 'Rex', 'dog', 'Labrador', 1000, []);

    expect(pet).toEqual({
      id: 'pet-1',
      householdId: 'h1',
      name: 'Rex',
      species: 'dog',
      breed: 'Labrador',
      birthDate: 1000,
      photoUrl: null,
      colorKey: '#EF4444',
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, pet);
  });
```

(Read the current full test file first — this replaces only the one test body above; leave `getPet`/`subscribeToPets` tests untouched. Add `updateDoc` to the file's `jest.mock('@react-native-firebase/firestore', ...)` block if not already mocked there, following the same pattern `updatePetPhoto` already uses.)

- [ ] **Step 8: Run tests, then update `AddPetScreen.tsx`**

Run: `npx jest __tests__/petService.test.ts` — expect PASS, then:

```typescript
// src/navigation/AddPetScreen.tsx — add subscribeToPets to know existing pets, pass to createPet:
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createPet, updatePetPhoto, subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet, PetSpecies } from '../types/pet';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, ErrorText, Chip, AvatarPicker } from '../components/ui';
import { spacing } from '../theme/theme';

const SPECIES: PetSpecies[] = ['dog', 'cat', 'other'];

export function AddPetScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState(Date.now());
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [existingPets, setExistingPets] = useState<Pet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setExistingPets);
  }, [household]);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      const pet = await createPet(firestore, household.id, name, species, breed, birthDate, existingPets);
      if (photoDataUri) {
        await updatePetPhoto(firestore, household.id, pet.id, photoDataUri);
      }
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <AvatarPicker photoUri={photoDataUri} onPicked={setPhotoDataUri} />
      <TextField label="Name" placeholder="Pet's name" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {SPECIES.map((s) => (
          <Chip key={s} label={s} selected={species === s} onPress={() => setSpecies(s)} />
        ))}
      </View>
      <TextField label="Breed" placeholder="Optional" value={breed} onChangeText={setBreed} />
      <DateField label="Birth date" value={birthDate} onChange={setBirthDate} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Add pet" onPress={handleSubmit} loading={loading} />
    </ScreenContainer>
  );
}
```

- [ ] **Step 9: Add a colour-swatch row to `PetHomeScreen.tsx`**

```typescript
// src/navigation/PetHomeScreen.tsx — add near the top, after the existing imports:
import { Pressable } from 'react-native'; // already imported above in this file — just add to the existing import line, don't duplicate
import { PET_COLORS } from '../theme/petColors';
import { updatePetColor } from '../pets/petService';

// ...inside the component, after the AvatarPicker/name block, add:
      {household && pet && (
        <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
          {PET_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => updatePetColor(firestore, household.id, petId, c)}
              style={{
                width: 28, height: 28, borderRadius: 14, backgroundColor: c,
                borderWidth: pet.colorKey === c ? 3 : 0, borderColor: colors.text,
              }}
            />
          ))}
        </View>
      )}
```

Read the current full `PetHomeScreen.tsx` before editing (it was shown in full during planning, but re-read to catch any drift) — merge this into the existing `<View style={{ alignItems: 'center', gap: spacing.xs }}>` block that already holds the `AvatarPicker` and name, immediately after `{pet && <Subtitle>{pet.name}</Subtitle>}`.

- [ ] **Step 10: Extend `firestore.rules`**

```
// firestore.rules line 168 — extend the pets create allowlist:
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'householdId', 'name', 'species', 'breed', 'birthDate', 'photoUrl', 'colorKey']);
```

(`allow update` for pets already has no field restriction — `updatePetColor`'s `updateDoc` needs no further rules change.)

- [ ] **Step 11: Extend the rules test**

```typescript
// __tests__/firestore.rules.test.ts — update the existing "allows a household member to create a pet" and "denies a non-member..." tests' payloads to include colorKey:
        id: 'pet-1', householdId: 'h1', name: 'Rex', species: 'dog', breed: 'Labrador',
        birthDate: 0, photoUrl: null, colorKey: '#EF4444',
```

Run via the emulator, per project standard: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"`.

- [ ] **Step 12: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 13: Commit**

```bash
git add src/theme/petColors.ts src/types/pet.ts src/pets/petService.ts src/navigation/AddPetScreen.tsx src/navigation/PetHomeScreen.tsx firestore.rules __tests__/petColors.test.ts __tests__/petService.test.ts __tests__/firestore.rules.test.ts
git commit -m "feat: assign each pet an identity colour, add colour-swatch changer"
git push origin master
```

---

### Task 3: Shared pet-selection state and the "All pets / one pet" selector component

**Files:**
- Create: `src/selection/PetSelectionContext.tsx`, `src/components/ui/PetSelector.tsx`
- Modify: `src/components/ui/index.ts`, `App.tsx`

**Interfaces:**
- Produces: `PetSelectionProvider`, `usePetSelection(): { selectedPetId: string | 'all'; setSelectedPetId: (id: string | 'all') => void }`; `<PetSelector pets={Pet[]} />` — consumed by `HomeScreen` (Task 5) and `AddSheet`/`ChoosePetForAddScreen` (Task 9). Every later plan's list screens are expected to import `usePetSelection`/`PetSelector` from these same two files rather than building their own.

**Why one shared piece of state, not per-screen:** the execution pack is explicit that a second, per-screen version of this selector is the single costliest mistake to make here — it would need to be redone on every later list screen. A single context means "select Djidji on the home screen" naturally carries over if a later screen (Plans 4–8) reads the same context.

- [ ] **Step 1: Selection context**

```typescript
// src/selection/PetSelectionContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface PetSelectionContextValue {
  selectedPetId: string | 'all';
  setSelectedPetId: (id: string | 'all') => void;
}

const PetSelectionContext = createContext<PetSelectionContextValue | undefined>(undefined);

export function PetSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedPetId, setSelectedPetId] = useState<string | 'all'>('all');
  return (
    <PetSelectionContext.Provider value={{ selectedPetId, setSelectedPetId }}>
      {children}
    </PetSelectionContext.Provider>
  );
}

export function usePetSelection(): PetSelectionContextValue {
  const ctx = useContext(PetSelectionContext);
  if (!ctx) throw new Error('usePetSelection must be used within PetSelectionProvider');
  return ctx;
}
```

- [ ] **Step 2: Selector component**

```typescript
// src/components/ui/PetSelector.tsx
import React from 'react';
import { ScrollView, Pressable, Image, View } from 'react-native';
import { Pet } from '../../types/pet';
import { usePetSelection } from '../../selection/PetSelectionContext';
import { MutedText, Subtitle } from './Typography';
import { colors, spacing, radii } from '../../theme/theme';

const SPECIES_EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', other: '🐾' };

export function PetSelector({ pets }: { pets: Pet[] }) {
  const { selectedPetId, setSelectedPetId } = usePetSelection();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
      <Pressable onPress={() => setSelectedPetId('all')} style={{ alignItems: 'center', gap: spacing.xs }}>
        <View
          style={{
            width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceTint,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: selectedPetId === 'all' ? 3 : 0, borderColor: colors.primary,
          }}
        >
          <Subtitle>🐾</Subtitle>
        </View>
        <MutedText>All Pets</MutedText>
      </Pressable>
      {pets.map((pet) => (
        <Pressable key={pet.id} onPress={() => setSelectedPetId(pet.id)} style={{ alignItems: 'center', gap: spacing.xs }}>
          <View
            style={{
              width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
              alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTint,
              borderWidth: 3, borderColor: selectedPetId === pet.id ? pet.colorKey : 'transparent',
            }}
          >
            {pet.photoUrl ? (
              <Image source={{ uri: pet.photoUrl }} style={{ width: 48, height: 48 }} resizeMode="cover" />
            ) : (
              <Subtitle>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Subtitle>
            )}
          </View>
          <MutedText numberOfLines={1} style={{ maxWidth: 64 }}>{pet.name}</MutedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

Verify `radii` is actually used or drop the unused import — this component doesn't end up needing it directly (border radius values here are computed as half of width/height inline); remove the `radii` import from the snippet above if `tsc`/lint flags it unused.

- [ ] **Step 3: Export from the shared UI barrel**

```typescript
// src/components/ui/index.ts — add:
export { PetSelector } from './PetSelector';
```

- [ ] **Step 4: Wrap the app in `PetSelectionProvider`**

```typescript
// App.tsx
import React from 'react';
import { AuthProvider } from './src/auth/AuthContext';
import { HouseholdProvider } from './src/household/HouseholdContext';
import { PetSelectionProvider } from './src/selection/PetSelectionContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <PetSelectionProvider>
          <RootNavigator />
        </PetSelectionProvider>
      </HouseholdProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (note: `PetSelector` isn't rendered anywhere yet until Task 5 — an unused-export warning, if any, is expected and resolves once Task 5 wires it in; a genuine compile *error* is not expected)

- [ ] **Step 6: Commit**

```bash
git add src/selection/PetSelectionContext.tsx src/components/ui/PetSelector.tsx src/components/ui/index.ts App.tsx
git commit -m "feat: add shared pet-selection context and All Pets/one-pet selector"
git push origin master
```

---

### Task 4: Minimal "what's next" lookup (temporary — Plan 5 replaces this)

**Files:**
- Create: `src/pets/upcomingSummary.ts`
- Test: `__tests__/upcomingSummary.test.ts`

**Interfaces:**
- Produces: `getNextDue(vaccines: Vaccine[], now: number): { label: string; overdue: boolean } | null` — consumed by `HomeScreen` (Task 5).

**Scope decision:** Plan 5 (execution pack Phase 3) owns the real `computeUpcoming(pets, vaccines, medications, events, vetVisits, horizonDays)` pure function across every record type — that is explicitly "the most important requirement" of that plan and must not be pre-built or duplicated here. This task only needs *something* non-empty on each home card today. It looks at `Vaccine.nextDueDate` only (the one field in the current data model with an unambiguous single due-date), and returns the single nearest one (overdue if in the past). Medications, vet visits, and weight are not surfaced here — a card simply omits the "next due" line if there's no upcoming vaccine, rather than guessing.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/upcomingSummary.test.ts
import { getNextDue } from '../src/pets/upcomingSummary';
import { Vaccine } from '../src/types/vaccine';

const vax = (id: string, nextDueDate: number | null): Vaccine => ({
  id, petId: 'pet-1', name: `Vaccine ${id}`, dateGiven: 0, nextDueDate, vetName: '',
});

describe('getNextDue', () => {
  it('returns null when there are no vaccines', () => {
    expect(getNextDue([], 1000)).toBeNull();
  });

  it('returns null when no vaccine has a nextDueDate', () => {
    expect(getNextDue([vax('a', null)], 1000)).toBeNull();
  });

  it('returns the nearest upcoming due date as not overdue', () => {
    const result = getNextDue([vax('a', 2000), vax('b', 1500)], 1000);
    expect(result).toEqual({ label: 'Vaccine b due', overdue: false });
  });

  it('flags a past due date as overdue', () => {
    const result = getNextDue([vax('a', 500)], 1000);
    expect(result).toEqual({ label: 'Vaccine a overdue', overdue: true });
  });

  it('prefers the nearest date even when it is overdue and another is upcoming', () => {
    const result = getNextDue([vax('a', 500), vax('b', 2000)], 1000);
    expect(result).toEqual({ label: 'Vaccine a overdue', overdue: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/upcomingSummary.test.ts`
Expected: FAIL with "Cannot find module '../src/pets/upcomingSummary'"

- [ ] **Step 3: Implement**

```typescript
// src/pets/upcomingSummary.ts
import { Vaccine } from '../types/vaccine';

export function getNextDue(vaccines: Vaccine[], now: number): { label: string; overdue: boolean } | null {
  const dated = vaccines.filter((v): v is Vaccine & { nextDueDate: number } => v.nextDueDate != null);
  if (dated.length === 0) return null;

  const nearest = dated.reduce((closest, v) =>
    Math.abs(v.nextDueDate - now) < Math.abs(closest.nextDueDate - now) ? v : closest
  );
  const overdue = nearest.nextDueDate < now;
  return { label: `${nearest.name} ${overdue ? 'overdue' : 'due'}`, overdue };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/upcomingSummary.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pets/upcomingSummary.ts __tests__/upcomingSummary.test.ts
git commit -m "feat: add minimal vaccine-only 'next due' lookup for home cards (temporary, Plan 5 replaces)"
git push origin master
```

---

### Task 5: Rebuild the home screen — one card per pet, filtered by the shared selector

**Files:**
- Create: `src/navigation/HomeScreen.tsx`
- Delete: `src/navigation/PetListScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`

**Interfaces:**
- Consumes: `usePetSelection`/`PetSelector` (Task 3), `getNextDue` (Task 4), `assignPetColor`'s output via `pet.colorKey` (Task 2), `subscribeToVaccines` (existing, `src/pets/vaccineService.ts`)
- Produces: `HomeScreen`, registered as the Pets-tab stack's root route (replacing `PetListScreen`).

- [ ] **Step 1: Write `HomeScreen.tsx`**

```typescript
// src/navigation/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Image, View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { subscribeToVaccines } from '../pets/vaccineService';
import { getNextDue } from '../pets/upcomingSummary';
import { usePetSelection } from '../selection/PetSelectionContext';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { ScreenContainer, Card, Button, Subtitle, BodyText, MutedText, PetSelector } from '../components/ui';
import { colors, spacing } from '../theme/theme';

const SPECIES_EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', other: '🐾' };

function speciesAndAge(pet: Pet): string {
  const ageMs = Date.now() - pet.birthDate;
  const years = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  return `${pet.species}${years >= 0 ? ` · ${years} yr` : ''}`;
}

function PetCard({ pet, navigation }: { pet: Pet; navigation: any }) {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const { household } = useHousehold();

  useEffect(() => {
    if (!household) return;
    return subscribeToVaccines(firestore, household.id, pet.id, setVaccines);
  }, [household, pet.id]);

  const nextDue = getNextDue(vaccines, Date.now());

  return (
    <Pressable onPress={() => navigation.navigate('PetHome', { petId: pet.id })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderLeftWidth: 4, borderLeftColor: pet.colorKey }}>
        {pet.photoUrl ? (
          <Image source={{ uri: pet.photoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} resizeMode="cover" />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' }}>
            <Subtitle>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Subtitle>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Subtitle>{pet.name}</Subtitle>
          <MutedText>{speciesAndAge(pet)}</MutedText>
          {nextDue ? (
            <BodyText style={{ color: nextDue.overdue ? colors.danger : colors.primaryDark, fontWeight: '600' }}>
              {nextDue.label}
            </BodyText>
          ) : (
            <MutedText>Nothing due</MutedText>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: any) {
  const { household } = useHousehold();
  const { selectedPetId } = usePetSelection();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const visiblePets = selectedPetId === 'all' ? pets : pets.filter((p) => p.id === selectedPetId);

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Button title="Add a pet" onPress={() => navigation.navigate('AddPet')} />
      {pets.length > 0 && <PetSelector pets={pets} />}
      <FlatList
        data={visiblePets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => <PetCard pet={item} navigation={navigation} />}
        ListEmptyComponent={<MutedText>No pets yet — add one to get started.</MutedText>}
      />
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Delete `PetListScreen.tsx`, update `MainNavigator.tsx`**

Delete `src/navigation/PetListScreen.tsx`.

```typescript
// src/navigation/MainNavigator.tsx — this file is now the nested stack
// mounted inside the Pets tab (see MainTabs.tsx, Task 8) rather than the
// app's single top-level stack. Swap the import and the first Stack.Screen:
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './HomeScreen';
import { AddPetScreen } from './AddPetScreen';
import { PetHomeScreen } from './PetHomeScreen';
import { VaccineListScreen } from './VaccineListScreen';
import { AddVaccineScreen } from './AddVaccineScreen';
import { MedicationListScreen } from './MedicationListScreen';
import { AddMedicationScreen } from './AddMedicationScreen';
import { WeightLogScreen } from './WeightLogScreen';
import { ExpenseListScreen } from './ExpenseListScreen';
import { AddExpenseScreen } from './AddExpenseScreen';
import { VetVisitListScreen } from './VetVisitListScreen';
import { AddVetVisitScreen } from './AddVetVisitScreen';
import { VetVisitDocumentsScreen } from './VetVisitDocumentsScreen';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '700' as const },
  headerBackTitle: '',
  contentStyle: { backgroundColor: colors.background },
};

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="PetList" component={HomeScreen} options={{ title: 'My Pets' }} />
      <Stack.Screen name="AddPet" component={AddPetScreen} options={{ title: 'Add Pet' }} />
      <Stack.Screen name="PetHome" component={PetHomeScreen} options={{ title: 'Pet Home' }} />
      <Stack.Screen name="VaccineList" component={VaccineListScreen} options={{ title: 'Vaccines' }} />
      <Stack.Screen name="AddVaccine" component={AddVaccineScreen} options={{ title: 'Add Vaccine' }} />
      <Stack.Screen name="MedicationList" component={MedicationListScreen} options={{ title: 'Medications' }} />
      <Stack.Screen name="AddMedication" component={AddMedicationScreen} options={{ title: 'Add Medication' }} />
      <Stack.Screen name="WeightLog" component={WeightLogScreen} options={{ title: 'Weight' }} />
      <Stack.Screen name="ExpenseList" component={ExpenseListScreen} options={{ title: 'Expenses' }} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
      <Stack.Screen name="VetVisitList" component={VetVisitListScreen} options={{ title: 'Vet Visits' }} />
      <Stack.Screen name="AddVetVisit" component={AddVetVisitScreen} options={{ title: 'Add Vet Visit' }} />
      <Stack.Screen name="VetVisitDocuments" component={VetVisitDocumentsScreen} options={{ title: 'Documents' }} />
    </Stack.Navigator>
  );
}
```

(Route name `PetList` is kept even though the component is now `HomeScreen` — nothing outside this file navigates to it by name except `MainTabs`, Task 8, which needs a stable route name to detect "am I at the tab's root" for hiding the tab bar on pushed screens. Renaming the route buys nothing and risks missing a reference.)

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Screenshot verification**

Run `npx expo run:android` (or reload if Metro is already running), navigate to the Pets tab, screenshot it with 0, 1, and 2+ pets. Confirm: the selector only appears once there's at least one pet, cards show the coloured left edge, and overdue vaccines render in red while upcoming ones render in the darker teal.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/HomeScreen.tsx src/navigation/MainNavigator.tsx
git rm src/navigation/PetListScreen.tsx
git commit -m "feat: rebuild pet list as a one-card-per-pet home screen with next-due and selector"
git push origin master
```

---

### Task 6: Calendar and Vets tab stubs with written empty states

**Files:**
- Create: `src/navigation/CalendarScreen.tsx`, `src/navigation/VetsScreen.tsx`

**Interfaces:**
- Produces: `CalendarScreen`, `VetsScreen` — mounted as tab roots in `MainTabs` (Task 8). No data dependencies; genuinely empty until Plans 6 and 7 build the real thing.

- [ ] **Step 1: Calendar stub**

```typescript
// src/navigation/CalendarScreen.tsx
import React from 'react';
import { ScreenContainer, Title, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

export function CalendarScreen() {
  return (
    <ScreenContainer style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm }}>
      <Title>📅</Title>
      <Title>Calendar is coming soon</Title>
      <MutedText style={{ textAlign: 'center' }}>
        Every reminder and appointment for your pets will show up here, filterable by pet.
      </MutedText>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Vets stub**

```typescript
// src/navigation/VetsScreen.tsx
import React from 'react';
import { ScreenContainer, Title, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

export function VetsScreen() {
  return (
    <ScreenContainer style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm }}>
      <Title>🩺</Title>
      <Title>Vets is coming soon</Title>
      <MutedText style={{ textAlign: 'center' }}>
        Save every clinic you've used, with contact details and which pets go there.
      </MutedText>
    </ScreenContainer>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (these two screens aren't mounted anywhere yet until Task 8 — that's expected)

- [ ] **Step 4: Commit**

```bash
git add src/navigation/CalendarScreen.tsx src/navigation/VetsScreen.tsx
git commit -m "feat: add Calendar and Vets tab empty states"
git push origin master
```

---

### Task 7: Household tab — read-only household info

**Files:**
- Create: `src/navigation/HouseholdScreen.tsx`

**Interfaces:**
- Consumes: `useHousehold()` (existing, `src/household/HouseholdContext.tsx`) — `household.name`, `household.members: HouseholdMember[]`.
- Produces: `HouseholdScreen` — mounted as a tab root in `MainTabs` (Task 8).

**Scope decision:** the execution pack's Phase 1 prompt lists this as one of the four tabs but doesn't call it out as an empty stub the way Calendar/Vets are — unlike those two, this app already has real household data (`useHousehold()`) with nothing new to build to display it. Full member management — the invite-code share button, per-member removal, the free/paid member-count limit — is explicit Phase 5 (Plan 7) scope ("The Household tab: who is in it, the invite code with a share button..."). This task shows what already exists (household name, member list) and nothing beyond that; it also hosts the dev-only style guide entry point (Task 10), matching how a "developer menu" item is conventionally tucked into a settings-adjacent screen rather than getting its own tab.

- [ ] **Step 1: Write the screen**

```typescript
// src/navigation/HouseholdScreen.tsx
import React from 'react';
import { FlatList } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { ScreenContainer, Card, Title, Subtitle, MutedText, Button } from '../components/ui';
import { spacing } from '../theme/theme';

export function HouseholdScreen({ navigation }: any) {
  const { household } = useHousehold();

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>{household?.name ?? 'Household'}</Title>
      <MutedText>{household?.members.length ?? 0} member{household?.members.length === 1 ? '' : 's'}</MutedText>
      <FlatList
        data={household?.members ?? []}
        keyExtractor={(m) => m.userId}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card>
            <Subtitle>{item.displayName}</Subtitle>
          </Card>
        )}
      />
      {__DEV__ && (
        <Button
          variant="outline"
          title="Developer: style guide"
          onPress={() => navigation.navigate('DevStyleGuide')}
        />
      )}
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (`DevStyleGuide` route doesn't exist yet — Task 10 adds it; this button simply won't navigate anywhere successfully until then, which is fine mid-plan since it's not user-reachable outside `__DEV__` and this task isn't yet wired into `MainTabs`)

- [ ] **Step 3: Commit**

```bash
git add src/navigation/HouseholdScreen.tsx
git commit -m "feat: add read-only Household tab screen"
git push origin master
```

---

### Task 8: Bottom tab navigator — Pets, Calendar, Vets, Household + raised "+" button

**Files:**
- Create: `src/navigation/MainTabs.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `MainNavigator` (Task 5, now the Pets-tab nested stack), `CalendarScreen`/`VetsScreen` (Task 6), `HouseholdScreen` (Task 7), `AddSheet` (Task 9 — the "+" button opens this as a modal, wired in this task's tab bar button but the sheet's content is built next)
- Produces: `MainTabs`, mounted by `RootNavigator` as the `Main` route (replacing the direct `MainNavigator` mount).

**On hiding the tab bar over pushed screens:** without this, the tab bar would sit under every pushed screen in the Pets stack (`AddPet`, `PetHome`, `VaccineList`, ...), competing with each screen's own header and wasting vertical space on forms. The standard React Navigation pattern — reading the nested stack's currently focused route name via `getFocusedRouteNameFromRoute` and hiding `tabBarStyle` unless it's the stack's root — is used here.

- [ ] **Step 1: Write `MainTabs.tsx`**

```typescript
// src/navigation/MainTabs.tsx
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MainNavigator } from './MainNavigator';
import { CalendarScreen } from './CalendarScreen';
import { VetsScreen } from './VetsScreen';
import { HouseholdScreen } from './HouseholdScreen';
import { AddSheet } from './AddSheet';
import { colors } from '../theme/theme';

const Tab = createBottomTabNavigator();

// Only the Pets tab has a nested stack with sub-screens the tab bar should
// hide behind. Its root route is named 'PetList' (Task 5) — anything else
// focused means we've pushed deeper and the tab bar should disappear.
function petsTabBarStyle(route: RouteProp<any, any>) {
  const focusedRoute = getFocusedRouteNameFromRoute(route) ?? 'PetList';
  return focusedRoute === 'PetList' ? undefined : { display: 'none' as const };
}

function RaisedAddButton(props: BottomTabBarButtonProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setSheetVisible(true)}
        style={{
          top: -16, alignSelf: 'center', width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
        }}
        accessibilityRole="button"
        accessibilityLabel="Add"
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>
      <AddSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="PetsTab"
        component={MainNavigator}
        options={({ route }) => ({
          title: 'Pets',
          tabBarStyle: [{ backgroundColor: colors.surface, borderTopColor: colors.border }, petsTabBarStyle(route)],
          tabBarIcon: ({ color, size }) => <Ionicons name="paw" size={size} color={color} />,
        })}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="AddTab"
        component={View} // never actually navigated to — tabBarButton fully replaces this tab's default press behavior
        options={{
          title: '',
          tabBarButton: (props) => <RaisedAddButton {...props} />,
        }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tab.Screen
        name="VetsTab"
        component={VetsScreen}
        options={{ title: 'Vets', tabBarIcon: ({ color, size }) => <Ionicons name="medkit" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="HouseholdTab"
        component={HouseholdScreen}
        options={{ title: 'Household', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}
```

`AddSheet` (Task 9) doesn't exist yet — this file won't compile until that task lands. Both tasks are small; if executing strictly one-task-at-a-time, add a temporary inline placeholder (`function AddSheet() { return null; }`) after this step and remove it once Task 9's real file exists, OR do Task 9 immediately after this step before verifying compilation. Given the tight coupling, **implementers should treat Tasks 8 and 9 as done together before running `tsc`**, per the executing-plans note below.

- [ ] **Step 2: Mount `MainTabs` from `RootNavigator`**

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
import { MainTabs } from './MainTabs';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, initializing } = useAuth();
  const { household, loading: householdLoading } = useHousehold();

  if (initializing) return null;
  if (user && householdLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {!user ? (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : household ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: Verify it compiles (after Task 9 is also done — see note in Step 1)**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Screenshot verification**

Run `npx expo run:android`, sign in to an existing household. Confirm on the phone: all four tabs plus the raised "+" button are visible and sit above the Android system navigation bar (not overlapped by it); switching tabs preserves each tab's state; pushing into `AddPet` or any record screen from the Pets tab hides the tab bar, and backing out restores it.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/MainTabs.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: add bottom tab navigator (Pets/Calendar/Vets/Household) with raised add button"
git push origin master
```

---

### Task 9: The "+" add sheet, with a pet-picker step when needed

**Files:**
- Create: `src/navigation/AddSheet.tsx`, `src/navigation/ChoosePetForAddScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`

**Interfaces:**
- Consumes: `usePetSelection()` (Task 3, for "if a single pet is currently selected, pre-fill it"), `subscribeToPets` (existing)
- Produces: `AddSheet` (rendered by `MainTabs`, Task 8); `ChoosePetForAddScreen`, registered as an additional route on the existing Pets-tab stack (`MainNavigator`) so it can push into the target Add screen afterward.

**Design:** a native `Modal`-based action sheet (no new dependency) listing every add-action. "Add a Pet" needs no `petId` and navigates directly. Every other action needs a `petId`: if exactly one pet is selected via the shared selector (not `'all'`), it's pre-filled and the sheet navigates straight to the target Add screen; otherwise it navigates to `ChoosePetForAddScreen` first, which does the same job as `PetSelector` but in "pick one, no 'all' option" mode for this one-off flow.

- [ ] **Step 1: Write `AddSheet.tsx`**

```typescript
// src/navigation/AddSheet.tsx
import React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePetSelection } from '../selection/PetSelectionContext';
import { BodyText, Title } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

const ADD_ACTIONS: { label: string; route: string; needsPet: boolean }[] = [
  { label: 'Add a Pet', route: 'AddPet', needsPet: false },
  { label: 'Add a Vaccine', route: 'AddVaccine', needsPet: true },
  { label: 'Add a Medication', route: 'AddMedication', needsPet: true },
  { label: 'Log a Weight', route: 'WeightLog', needsPet: true },
  { label: 'Add a Vet Visit', route: 'AddVetVisit', needsPet: true },
  { label: 'Add an Expense', route: 'AddExpense', needsPet: true },
];

export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const { selectedPetId } = usePetSelection();

  const handlePress = (action: (typeof ADD_ACTIONS)[number]) => {
    onClose();
    // Push onto the Pets tab's nested stack (named "PetsTab" in MainTabs)
    // regardless of which tab is currently focused, so the target screen's
    // existing header/back behavior works unchanged.
    if (!action.needsPet) {
      navigation.navigate('PetsTab', { screen: action.route });
      return;
    }
    if (selectedPetId !== 'all') {
      navigation.navigate('PetsTab', { screen: action.route, params: { petId: selectedPetId } });
      return;
    }
    navigation.navigate('PetsTab', { screen: 'ChoosePetForAdd', params: { targetRoute: action.route } });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, gap: spacing.sm }}>
          <Title style={{ marginBottom: spacing.sm }}>Add</Title>
          {ADD_ACTIONS.map((action) => (
            <Pressable key={action.route} onPress={() => handlePress(action)} style={{ paddingVertical: spacing.sm }}>
              <BodyText>{action.label}</BodyText>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Write `ChoosePetForAddScreen.tsx`**

```typescript
// src/navigation/ChoosePetForAddScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { ScreenContainer, Card, Subtitle, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

export function ChoosePetForAddScreen({ route, navigation }: any) {
  const { targetRoute } = route.params;
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <MutedText>Who is this for?</MutedText>
      <FlatList
        data={pets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.replace(targetRoute, { petId: item.id })}>
            <Card style={{ borderLeftWidth: 4, borderLeftColor: item.colorKey }}>
              <Subtitle>{item.name}</Subtitle>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<MutedText>Add a pet first.</MutedText>}
      />
    </ScreenContainer>
  );
}
```

- [ ] **Step 3: Register `ChoosePetForAdd` on the Pets-tab stack**

```typescript
// src/navigation/MainNavigator.tsx — add the import and one more Stack.Screen:
import { ChoosePetForAddScreen } from './ChoosePetForAddScreen';
// ...inside <Stack.Navigator>, anywhere after PetList:
      <Stack.Screen name="ChoosePetForAdd" component={ChoosePetForAddScreen} options={{ title: 'Choose a pet' }} />
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors — this also resolves Task 8's `AddSheet` import (see the note at the end of Task 8, Step 1).

- [ ] **Step 5: Screenshot verification**

On the phone: tap "+" with no pet selected (selector on "All Pets") and choose "Add a Vaccine" — confirm it lands on `ChoosePetForAddScreen`, and picking a pet there lands on `AddVaccineScreen` with that pet. Then select a single pet via the selector on the home screen, tap "+", choose "Add a Vaccine" again — confirm it skips straight to `AddVaccineScreen` pre-filled with that pet.

- [ ] **Step 6: Commit**

```bash
git add src/navigation/AddSheet.tsx src/navigation/ChoosePetForAddScreen.tsx src/navigation/MainNavigator.tsx
git commit -m "feat: add the '+' add sheet with pet-selection-aware routing"
git push origin master
```

---

### Task 10: Dev-only style guide screen

**Files:**
- Create: `src/navigation/DevStyleGuideScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`

**Interfaces:**
- Produces: `DevStyleGuideScreen`, registered on the Pets-tab stack, reachable only via the `__DEV__`-gated button already added to `HouseholdScreen` (Task 7).

**Production gate:** the execution pack's own spec doesn't state a gate for this screen — reviewed and flagged as a gap during planning (see Assumptions). The fix used here is two-layered: (1) the only entry point (`HouseholdScreen`'s button) only renders `if (__DEV__)`, and (2) the route itself is still technically reachable by a crafted deep link in a release build since React Navigation doesn't remove unreferenced routes — acceptable for MVP (it's a read-only design reference screen with no data access, not a security boundary), but noted explicitly so it isn't mistaken for a real access-control gate later.

- [ ] **Step 1: Write the screen**

```typescript
// src/navigation/DevStyleGuideScreen.tsx
import React from 'react';
import { View } from 'react-native';
import { ScreenContainer, Title, Subtitle, BodyText, MutedText, ErrorText, Button, Card, Chip, TextField } from '../components/ui';
import { colors, spacing, radii, typography } from '../theme/theme';
import { PET_COLORS } from '../theme/petColors';

export function DevStyleGuideScreen() {
  return (
    <ScreenContainer scroll>
      <Title>Style Guide</Title>

      <Subtitle>Colours</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {Object.entries(colors).map(([name, value]) => (
          <View key={name} style={{ alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: 48, height: 48, borderRadius: radii.md, backgroundColor: value, borderWidth: 1, borderColor: colors.border }} />
            <MutedText>{name}</MutedText>
          </View>
        ))}
      </View>

      <Subtitle>Pet identity colours</Subtitle>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {PET_COLORS.map((c) => (
          <View key={c} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c }} />
        ))}
      </View>

      <Subtitle>Typography</Subtitle>
      {Object.keys(typography).map((key) => (
        <BodyText key={key} style={(typography as any)[key]}>{key} — The quick brown fox</BodyText>
      ))}

      <Subtitle>Spacing</Subtitle>
      <View style={{ gap: spacing.xs }}>
        {Object.entries(spacing).map(([name, value]) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MutedText style={{ width: 32 }}>{name}</MutedText>
            <View style={{ width: value, height: 12, backgroundColor: colors.primary }} />
          </View>
        ))}
      </View>

      <Subtitle>Components</Subtitle>
      <Card>
        <BodyText>Card</BodyText>
      </Card>
      <Button title="Primary button" onPress={() => {}} />
      <Button title="Accent button" variant="accent" onPress={() => {}} />
      <Button title="Outline button" variant="outline" onPress={() => {}} />
      <Button title="Danger button" variant="danger" onPress={() => {}} />
      <TextField label="Text field" placeholder="Placeholder text" />
      <Chip label="Chip" selected onPress={() => {}} />
      <Chip label="Chip" selected={false} onPress={() => {}} />
      <ErrorText>Error text example</ErrorText>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Register the route**

```typescript
// src/navigation/MainNavigator.tsx — add the import and one more Stack.Screen:
import { DevStyleGuideScreen } from './DevStyleGuideScreen';
// ...inside <Stack.Navigator>, anywhere after PetList:
      <Stack.Screen name="DevStyleGuide" component={DevStyleGuideScreen} options={{ title: 'Style Guide' }} />
```

Note: `HouseholdScreen`'s button (Task 7) navigates to `'DevStyleGuide'` directly via its own `navigation` prop, but `HouseholdScreen` is mounted as a tab root (`HouseholdTab`), not inside the Pets stack where `DevStyleGuide` is registered — cross-tab navigation to a route on a different tab's nested stack needs the same nested-navigate form `AddSheet` uses. Fix `HouseholdScreen`'s button:

```typescript
// src/navigation/HouseholdScreen.tsx — change the onPress:
          onPress={() => navigation.navigate('PetsTab', { screen: 'DevStyleGuide' })}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Screenshot verification**

On the phone (debug build, so `__DEV__` is true): open Household tab, tap "Developer: style guide", confirm every colour/type/spacing/component swatch renders without crashing and nothing overflows the screen width.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/DevStyleGuideScreen.tsx src/navigation/MainNavigator.tsx src/navigation/HouseholdScreen.tsx
git commit -m "feat: add dev-only style guide screen"
git push origin master
```

---

## Assumptions and open questions

- **"Household" tab content is a judgment call.** The execution pack's Phase 1 prompt lists four tabs and explicitly calls Calendar/Vets "empty... with a written empty state," but says nothing about what Household should show yet (full member management is Phase 5/Plan 7). This plan shows existing, already-available household name + member list, read-only, and nothing more. If the owner intended Household to also be an empty stub until Plan 7, that's a one-line screenshot-driven fix, not a design change.
- **"Pets" tab = the rebuilt home screen**, not a separate "Home" concept alongside a plain pet list. The execution pack's Phase 1 scope describes both a bottom-tab-bar item called "Pets" *and* a "home screen" rebuild without saying how they relate. Reading BUILD-PLAN.md's Section 1 (the competitor's home screen becomes our reference) together with the tab list, the most consistent interpretation is that the Pets tab's root screen *is* the home screen — that's what this plan builds. Flag if the owner meant something else (e.g., a fifth concept).
- **The "+" sheet's action list (six items) is a judgment call**, not explicitly enumerated in the execution pack beyond "opens a sheet for adding anything." Chosen to cover every add-flow that already exists in the app today (pet, vaccine, medication, weight, vet visit, expense) — nothing new is invented, nothing existing is omitted.
- **`getNextDue`'s vaccine-only scope is deliberate**, not an oversight — see Task 4. Medications/vet visits/weight are not surfaced as "next due" on home cards in this plan; Plan 5 supersedes this function entirely with a real cross-type computation. Whoever executes Plan 5 should delete `src/pets/upcomingSummary.ts` and `HomeScreen`'s use of it, replacing it with the real `computeUpcoming` output — flagged here so it isn't forgotten as leftover code.
- **Task 8/9 compile coupling**: `MainTabs.tsx` (Task 8) imports `AddSheet` (Task 9) before it exists. If executed strictly one task at a time with a `tsc` gate after each, Task 8 alone will not compile — see the inline note in Task 8, Step 1, for the two ways to handle this (temporary stub, or do both tasks before the first `tsc` check). Flagging explicitly since "every task states how it will be verified" is a hard requirement of this plan and this is the one place two tasks are genuinely coupled.
- **`@expo/vector-icons` and `@react-navigation/bottom-tabs` requiring no native rebuild is an expectation, not a confirmed fact** — Task 1 verifies it for real on the device as its first real step, precisely because the source spec's identical claim about the icon set was already found to be wrong about installation (present here as "adds nothing to install" vs. confirmed-absent from `node_modules`). If Task 1's verification fails, every later task in this plan is blocked until that's resolved (likely an `expo prebuild` + native rebuild cycle, which CLAUDE.md's "Local device build environment" section documents how to do on this machine).
- **PetHomeScreen's `SECTIONS` grid emoji (💉💊🩺⚖️💰) are left untouched.** They're arguably "interface controls" (tappable cards navigating to sections), which the execution pack's icon guidance would seem to cover, but they're not named in Phase 1's concrete scope bullets and CLAUDE.md currently documents all species/section emoji as a deliberate MVP choice. Left alone here to avoid silently expanding scope; worth a deliberate decision (possibly folded into Task 1's icon work, or a fast-follow) rather than doing it implicitly inside this plan.
- **No tests were written for `MainTabs`, `AddSheet`, `HomeScreen`'s rendering, or any other screen component** — consistent with Plans 1–2's pattern (screens are verified via `tsc` + phone screenshots, not component tests; only pure logic — `assignPetColor`, `getNextDue` — gets Jest tests). No new testing pattern is introduced here.
- **The colour-swatch row added to `PetHomeScreen` (Task 2, Step 9) is a minimal placeholder for "editing," not a form.** It writes on tap with no confirmation step, matching this app's existing low-friction interaction pattern (e.g. `logMedicationDose`) rather than adding a save/cancel flow that Plan 4's real edit screen will likely supersede anyway.
- **Nothing in this plan touches `firestore.rules`' `update` behavior** — every write this plan adds (`updatePetColor`) goes through the pets collection's already-unrestricted `allow update` rule; only the `create` allowlist needed a change (Task 2, Step 10).
