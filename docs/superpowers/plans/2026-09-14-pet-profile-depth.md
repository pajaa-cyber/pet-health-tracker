# Pet Health Tracker — Pet Profile Depth Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild "Add a pet" as a wizard that lets someone finish adding a stray with no papers in under a minute without ever lying about a field they don't know — graceful "I don't know" answers for every date, a breed list that never forces a choice, microchip/sex/environment detail, custom fields, editing, and a "remembered" state for a pet that has died (no delete button).

**Architecture:** Every new `Pet` field is optional/nullable so existing pets (Plan 1-3 era, no `colorKey`-style migration needed) keep working unread-modified. `AddPetScreen` becomes a single-component multi-step wizard (internal step index, not separate navigator routes — keeps the personalised step titles simple since later steps read the name typed in step 1 from local state, and avoids a 9-route back-stack). `EditPetScreen` is a flat one-screen form (no wizard — the person already has data, editing everything at once is less friction). A new `src/limits/limits.ts` module is the single place every free-tier limit is read from, so Plan 9 (real subscriptions) only has to change one file later. A new `GracefulDateField` component and its pure computation helper handle "exact / roughly / approximate age / don't know" for both birth date and arrival date. `status: 'active' | 'remembered'` replaces "delete" — `HomeScreen`/`PetSelector` filter to active pets only, closing the stale-`selectedPetId` gap Plan 3's final review flagged.

**Tech Stack:** Same as Plans 1-3 (Expo prebuild/dev-client, `@react-native-firebase/firestore` modular API, React Navigation, Jest with mocked Firestore for service logic + `@firebase/rules-unit-testing` against the real emulator for rules). No new dependency — no native rebuild needed for this plan.

**Spec:** [docs/superpowers/specs/2026-09-13-execution-pack.md](../specs/2026-09-13-execution-pack.md) (Phase 2 planning prompt) and [docs/superpowers/specs/2026-09-13-build-plan.md](../specs/2026-09-13-build-plan.md) (Section 3 — Ana's actual annotations behind this scope). Also inherits Plans 1-3's specs/constraints.

## Global Constraints

- Every new `Pet` field is optional or nullable — a pet document written by Plan 1-3 code (no `species`/`breed`/etc. beyond the original 7 fields) must keep rendering correctly with no migration script.
- Do not add a delete-pet path anywhere. "Remembered" (`status: 'remembered'`) is the only end state for a pet that's no longer active.
- Mixed / Stray or rescued / Don't know must be pinned above the alphabetical breed list, visually separated — not merged in alphabetically. This is the single most important line in the whole plan per the execution pack.
- Every free-tier limit (custom fields per pet: 3; household members: 4 — the member limit itself is enforced in a later plan, but the *module* answering "can this pet have another custom field?" must exist now and be the only place that number lives) is read from `src/limits/limits.ts`, never hardcoded in a screen.
- Do not replace the existing design system (`src/theme/theme.ts`, `src/components/ui/`) — extend it, per Plan 3's established rule.
- Every security-rules change follows CLAUDE.md's pattern: `isHouseholdMember(householdId)` gate + a `create`-time `hasOnly([...])` field allowlist — never `hasAll`/`diff()` outside `isJoining()`.
- No new native dependency; verify with `npx tsc --noEmit` after each task, no `expo prebuild` expected.
- TypeScript throughout.

---

## File Structure

```
src/
  limits/
    limits.ts                    # NEW: single source of every free-tier limit
  pets/
    species.ts                   # NEW: species list, emoji, display labels — single source, replaces 3 local SPECIES_EMOJI copies
    breeds.ts                    # NEW: curated (not exhaustive) per-species breed lists
    dateGrace.ts                 # NEW: pure logic for the exact/roughly/approxAge/unknown date model
    petService.ts                # MODIFIED: createPet takes an options object; add updatePet()
  components/
    ui/
      GracefulDateField.tsx      # NEW: exact/roughly/approxAge/unknown date question UI
      BreedPicker.tsx            # NEW: Mixed/Stray/Don't-know pinned + curated list + free text
      GuidedEmptyState.tsx       # NEW: picture/emoji + one sentence + arrow-to-add, reusable
      index.ts                   # MODIFIED: export the three above
  navigation/
    AddPetScreen.tsx             # REWRITTEN: multi-step wizard
    EditPetScreen.tsx            # NEW: flat edit form + "remembered" toggle
    MainNavigator.tsx            # MODIFIED: register EditPet route
    PetHomeScreen.tsx            # MODIFIED: Edit button, import species.ts instead of local emoji map
    HomeScreen.tsx                # MODIFIED: filter to active pets, import species.ts
    VaccineListScreen.tsx          # MODIFIED: use GuidedEmptyState
    WeightLogScreen.tsx             # MODIFIED: use GuidedEmptyState
  components/
    ui/PetSelector.tsx                # MODIFIED: filter to active pets, import species.ts
  selection/
    PetSelectionContext.tsx             # MODIFIED: reconcile selection when the selected pet becomes inactive
  types/
    pet.ts                                # MODIFIED: every new field
firestore.rules                             # MODIFIED: pets' create allowlist gains every new field name
__tests__/
  limits.test.ts                              # NEW
  dateGrace.test.ts                            # NEW
  petService.test.ts                            # MODIFIED
  firestore.rules.test.ts                        # MODIFIED
```

---

### Task 1: Free-tier limits module

**Files:**
- Create: `src/limits/limits.ts`
- Test: `__tests__/limits.test.ts`

**Interfaces:**
- Produces: `FREE_CUSTOM_FIELDS_PER_PET = 3`, `FREE_HOUSEHOLD_MEMBERS = 4`; `canAddCustomField(pet: { customFields?: { label: string; value: string }[] }): boolean`; `customFieldLimitMessage(): string` (the "explain what's available" copy, not a bare refusal); `canAddHouseholdMember(household: { members: unknown[] }): boolean` — this one has no caller yet in this plan (member-count UI is Plan 7 scope) but must exist now per the execution pack's explicit requirement, so Plan 9 only changes this one file later.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/limits.test.ts
import {
  FREE_CUSTOM_FIELDS_PER_PET,
  FREE_HOUSEHOLD_MEMBERS,
  canAddCustomField,
  canAddHouseholdMember,
  customFieldLimitMessage,
} from '../src/limits/limits';

describe('limits', () => {
  it('exposes the locked free-tier constants', () => {
    expect(FREE_CUSTOM_FIELDS_PER_PET).toBe(3);
    expect(FREE_HOUSEHOLD_MEMBERS).toBe(4);
  });

  it('allows another custom field below the limit', () => {
    expect(canAddCustomField({ customFields: [{ label: 'a', value: '1' }] })).toBe(true);
  });

  it('denies another custom field at the limit', () => {
    const three = [
      { label: 'a', value: '1' }, { label: 'b', value: '2' }, { label: 'c', value: '3' },
    ];
    expect(canAddCustomField({ customFields: three })).toBe(false);
  });

  it('allows a custom field when the pet has none yet (undefined)', () => {
    expect(canAddCustomField({})).toBe(true);
  });

  it('returns an explanatory message, not a bare refusal', () => {
    expect(customFieldLimitMessage()).toContain('3');
  });

  it('allows another household member below the limit', () => {
    expect(canAddHouseholdMember({ members: [1, 2, 3] })).toBe(true);
  });

  it('denies another household member at the limit', () => {
    expect(canAddHouseholdMember({ members: [1, 2, 3, 4] })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/limits.test.ts`
Expected: FAIL with "Cannot find module '../src/limits/limits'"

- [ ] **Step 3: Implement**

```typescript
// src/limits/limits.ts
export const FREE_CUSTOM_FIELDS_PER_PET = 3;
export const FREE_HOUSEHOLD_MEMBERS = 4;

export function canAddCustomField(pet: { customFields?: { label: string; value: string }[] }): boolean {
  return (pet.customFields?.length ?? 0) < FREE_CUSTOM_FIELDS_PER_PET;
}

export function customFieldLimitMessage(): string {
  return `The free plan includes ${FREE_CUSTOM_FIELDS_PER_PET} custom fields per pet. Upgrading unlocks unlimited custom fields.`;
}

export function canAddHouseholdMember(household: { members: unknown[] }): boolean {
  return household.members.length < FREE_HOUSEHOLD_MEMBERS;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/limits.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/limits/limits.ts __tests__/limits.test.ts
git commit -m "feat: add free-tier limits module"
git push
```

---

### Task 2: Extend the `Pet` type and `firestore.rules` for every new field

**Files:**
- Modify: `src/types/pet.ts`, `firestore.rules`, `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Produces: the widened `Pet` interface every later task in this plan writes/reads.

**Design decisions, all deliberate MVP scope cuts — see Assumptions section for the reasoning on each:**
- `PetSpecies` widens to 8 options; a 9th "other" free-text value lives in `speciesOther`.
- `birthDate` becomes `number | null` (was required `number`) — existing pets already have a real value here, so this is a widening, not a breaking change for reads.
- `arrivalDate`/`microchipDate` are new, nullable from the start.
- `customFields` is a plain array, not a map — order matters for display and 3 is a small enough cap that lookup-by-key is never needed.

- [ ] **Step 1: Update the type**

```typescript
// src/types/pet.ts
export type PetSpecies = 'dog' | 'cat' | 'rabbit' | 'bird' | 'small_rodent' | 'ferret' | 'reptile' | 'other';
export type DatePrecision = 'exact' | 'roughly' | 'approxAge' | 'unknown';
export type ArrivalPrecision = 'exact' | 'roughly' | 'unknown';
export type PetSex = 'male' | 'female' | 'unknown';
export type LivingEnvironment = 'indoor' | 'outdoor' | 'both';
export type PetStatus = 'active' | 'remembered';

export interface CustomField {
  label: string;
  value: string;
}

export interface Pet {
  id: string;
  householdId: string;
  name: string;
  species: PetSpecies;
  speciesOther: string | null; // only meaningful when species === 'other'
  breed: string;
  birthDate: number | null; // epoch millis; null only when birthDatePrecision is 'unknown'
  birthDatePrecision: DatePrecision;
  approximateAgeMonths: number | null; // only meaningful when birthDatePrecision is 'approxAge'
  arrivalDate: number | null; // "when did they join your care" — null if skipped or unknown
  arrivalDatePrecision: ArrivalPrecision | null; // null if the question was skipped entirely
  photoUrl: string | null;
  colorKey: string; // one of PET_COLORS (src/theme/petColors.ts)
  sex: PetSex;
  neutered: boolean | null; // null = unknown
  colorMarkings: string;
  livingEnvironment: LivingEnvironment | null; // null = not answered
  microchipProvider: string;
  microchipNumber: string;
  microchipDate: number | null;
  microchipRegistry: string;
  customFields: CustomField[];
  status: PetStatus;
}
```

Every field added by this task is either a new field (naturally absent on old documents, so `snap.data() as Pet` leaves it `undefined` at runtime despite the type saying otherwise — exactly like `colorKey` before Plan 3's `petColor()` fallback) or, for `birthDate`, still present and non-null on every existing document. **Read sites added in later tasks of this plan must treat `undefined` the same as the type's declared default** (`speciesOther: null`, `birthDatePrecision: 'exact'`, `status: 'active'`, `customFields: []`, etc.) — this is called out again in each task that reads these fields for the first time.

- [ ] **Step 2: Extend `firestore.rules`**

```
// firestore.rules line ~168 — replace the pets create allowlist:
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly([
          'id', 'householdId', 'name', 'species', 'speciesOther', 'breed',
          'birthDate', 'birthDatePrecision', 'approximateAgeMonths',
          'arrivalDate', 'arrivalDatePrecision', 'photoUrl', 'colorKey',
          'sex', 'neutered', 'colorMarkings', 'livingEnvironment',
          'microchipProvider', 'microchipNumber', 'microchipDate', 'microchipRegistry',
          'customFields', 'status'
        ]);
```

(`allow update` for pets already has no field restriction, per Plan 2's design — `updatePet` in Task 6 needs no further rules change.)

- [ ] **Step 3: Extend the rules test**

```typescript
// __tests__/firestore.rules.test.ts — update the existing "allows a household member to create a pet" and "denies a non-member..." tests' payloads to the full field set:
        id: 'pet-1', householdId: 'h1', name: 'Rex', species: 'dog', speciesOther: null,
        breed: 'Labrador', birthDate: 0, birthDatePrecision: 'exact', approximateAgeMonths: null,
        arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#EF4444',
        sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
        microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
        customFields: [], status: 'active',
```

Run via the emulator, per project standard: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"`.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: errors in every file that constructs a `Pet` object without the new required-by-type fields (`petService.ts`'s `createPet`, any test fixtures) — **expected at this point in the plan**, Task 6 fixes `petService.ts`. If `tsc` shows errors ONLY in `src/pets/petService.ts` and `__tests__/petService.test.ts`, that's the correct state to commit at the end of this task; anything else is a mistake in this task's own edit.

- [ ] **Step 5: Commit**

```bash
git add src/types/pet.ts firestore.rules __tests__/firestore.rules.test.ts
git commit -m "feat: widen Pet type and pets rules allowlist for profile-depth fields"
git push
```

---

### Task 3: Consolidate species data — one shared module, not three local copies

**Files:**
- Create: `src/pets/species.ts`
- Modify: `src/navigation/HomeScreen.tsx`, `src/navigation/PetHomeScreen.tsx`, `src/components/ui/PetSelector.tsx`

**Interfaces:**
- Produces: `SPECIES_LIST: PetSpecies[]` (the 8 values, in the order shown to the user), `SPECIES_LABEL: Record<PetSpecies, string>`, `SPECIES_EMOJI: Record<PetSpecies, string>`, `speciesDisplay(pet: { species: PetSpecies; speciesOther: string | null }): string` (returns `speciesOther` when species is `'other'` and it's set, else the label).

**Why now:** Plan 3's final review flagged `SPECIES_EMOJI` as duplicated three times; this plan is about to add 5 more species, which would otherwise mean editing the same map in three files. Fix it once here rather than three times.

- [ ] **Step 1: Write the shared module**

```typescript
// src/pets/species.ts
import { PetSpecies } from '../types/pet';

export const SPECIES_LIST: PetSpecies[] = [
  'dog', 'cat', 'rabbit', 'bird', 'small_rodent', 'ferret', 'reptile', 'other',
];

export const SPECIES_LABEL: Record<PetSpecies, string> = {
  dog: 'Dog',
  cat: 'Cat',
  rabbit: 'Rabbit',
  bird: 'Bird',
  small_rodent: 'Small rodent',
  ferret: 'Ferret',
  reptile: 'Reptile',
  other: 'Other',
};

export const SPECIES_EMOJI: Record<PetSpecies, string> = {
  dog: '🐶',
  cat: '🐱',
  rabbit: '🐰',
  bird: '🐦',
  small_rodent: '🐹',
  ferret: '🦡',
  reptile: '🦎',
  other: '🐾',
};

export function speciesDisplay(pet: { species: PetSpecies; speciesOther?: string | null }): string {
  if (pet.species === 'other' && pet.speciesOther) return pet.speciesOther;
  return SPECIES_LABEL[pet.species] ?? 'Other';
}
```

- [ ] **Step 2: Update the three consumers**

```typescript
// src/navigation/HomeScreen.tsx — remove the local:
// const SPECIES_EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', other: '🐾' };
// replace with:
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';
// ...and in speciesAndAge(), replace `${pet.species}` with `${speciesDisplay(pet)}` — read the current
// function body first (it also computes age from birthDate, which Task 2 made nullable — see Task 9
// for the read-side null-birthDate handling; this task only swaps the species source, leave the age
// math as-is for now).
```

```typescript
// src/navigation/PetHomeScreen.tsx — same swap: remove the local SPECIES_EMOJI const,
// import { SPECIES_EMOJI } from '../pets/species'; keep the rest of the file unchanged.
```

```typescript
// src/components/ui/PetSelector.tsx — same swap: remove the local SPECIES_EMOJI const,
// import { SPECIES_EMOJI } from '../../pets/species';
```

Read each file's current full content before editing — only the emoji-map declaration and its import should change in this task; nothing else in these three files.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: same error set as Task 2 left (petService.ts / its test) — no NEW errors from this task's three files.

- [ ] **Step 4: Commit**

```bash
git add src/pets/species.ts src/navigation/HomeScreen.tsx src/navigation/PetHomeScreen.tsx src/components/ui/PetSelector.tsx
git commit -m "refactor: consolidate species emoji/labels into one shared module"
git push
```

---

### Task 4: Graceful date model — pure logic + `GracefulDateField` component

**Files:**
- Create: `src/pets/dateGrace.ts`, `src/components/ui/GracefulDateField.tsx`
- Test: `__tests__/dateGrace.test.ts`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `monthsToApproxBirthDate(months: number, now: number): number` (pure — computes an equivalent epoch-millis birth date from an approximate age, so every existing age-reading call site keeps working unchanged for 3 of the 4 precision modes); `<GracefulDateField label, explanation, precision, birthDate, approximateAgeMonths, onChange, options: DatePrecision[]>` — a single reusable component covering both the 4-option birth-date question and the 3-option arrival-date question (pass `options={['exact','roughly','unknown']}` for arrival, the full 4 for birth).

**Design:** the "roughly" option reuses the exact same `DateField` (src/components/DateField.tsx) picker as "exact" — the only difference is which button was tapped and a `precision` flag stored alongside, plus a reassuring line under the question ("A rough guess is completely fine"). "Approximate age" asks for a number of months via a plain `TextField` (numeric keyboard) and computes an equivalent `birthDate` via `monthsToApproxBirthDate` so nothing downstream needs to know the difference. "Don't know" clears the date entirely.

- [ ] **Step 1: Write the failing test for the pure logic**

```typescript
// __tests__/dateGrace.test.ts
import { monthsToApproxBirthDate } from '../src/pets/dateGrace';

describe('monthsToApproxBirthDate', () => {
  it('computes a birth date roughly N months before now', () => {
    const now = new Date('2026-09-14T00:00:00Z').getTime();
    const result = monthsToApproxBirthDate(12, now);
    const daysBack = (now - result) / (24 * 60 * 60 * 1000);
    expect(daysBack).toBeGreaterThan(360);
    expect(daysBack).toBeLessThan(370);
  });

  it('returns a value less than or equal to now for a positive age', () => {
    const now = Date.now();
    expect(monthsToApproxBirthDate(3, now)).toBeLessThanOrEqual(now);
  });

  it('returns exactly now for an age of 0 months', () => {
    const now = Date.now();
    expect(monthsToApproxBirthDate(0, now)).toBe(now);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/dateGrace.test.ts`
Expected: FAIL with "Cannot find module '../src/pets/dateGrace'"

- [ ] **Step 3: Implement the pure logic**

```typescript
// src/pets/dateGrace.ts
const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000; // average month length — this is an estimate by definition

export function monthsToApproxBirthDate(months: number, now: number): number {
  return Math.round(now - months * MS_PER_MONTH);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/dateGrace.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write `GracefulDateField.tsx`**

```typescript
// src/components/ui/GracefulDateField.tsx
import React from 'react';
import { View } from 'react-native';
import { DateField } from '../DateField';
import { TextField } from './TextField';
import { Chip } from './Chip';
import { MutedText } from './Typography';
import { spacing } from '../../theme/theme';
import { monthsToApproxBirthDate } from '../../pets/dateGrace';

type Precision = 'exact' | 'roughly' | 'approxAge' | 'unknown';

const PRECISION_LABEL: Record<Precision, string> = {
  exact: 'Exact date',
  roughly: 'I know roughly when',
  approxAge: 'I only know an approximate age',
  unknown: "I don't know",
};

const PRECISION_REASSURANCE: Record<Precision, string> = {
  exact: '',
  roughly: 'A rough guess is completely fine.',
  approxAge: "We'll estimate a date from the age you give — you can change it later.",
  unknown: "That's okay — you can add this anytime from the pet's profile.",
};

interface GracefulDateFieldProps {
  label: string;
  explanation?: string;
  options: Precision[];
  precision: Precision | null;
  date: number | null;
  approximateAgeMonths: number | null;
  onChange: (result: { precision: Precision; date: number | null; approximateAgeMonths: number | null }) => void;
}

export function GracefulDateField({
  label, explanation, options, precision, date, approximateAgeMonths, onChange,
}: GracefulDateFieldProps) {
  const selectPrecision = (p: Precision) => {
    if (p === 'exact' || p === 'roughly') {
      onChange({ precision: p, date: date ?? Date.now(), approximateAgeMonths: null });
    } else if (p === 'approxAge') {
      onChange({ precision: p, date: null, approximateAgeMonths: approximateAgeMonths ?? 0 });
    } else {
      onChange({ precision: p, date: null, approximateAgeMonths: null });
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <MutedText style={{ fontWeight: '600', color: undefined }}>{label}</MutedText>
      {explanation && <MutedText>{explanation}</MutedText>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {options.map((p) => (
          <Chip key={p} label={PRECISION_LABEL[p]} selected={precision === p} onPress={() => selectPrecision(p)} />
        ))}
      </View>
      {precision && PRECISION_REASSURANCE[precision] && <MutedText>{PRECISION_REASSURANCE[precision]}</MutedText>}
      {(precision === 'exact' || precision === 'roughly') && (
        <DateField
          label={precision === 'exact' ? 'Date' : 'Approximate date'}
          value={date}
          onChange={(v) => onChange({ precision, date: v, approximateAgeMonths: null })}
        />
      )}
      {precision === 'approxAge' && (
        <TextField
          label="Approximate age, in months"
          keyboardType="number-pad"
          value={approximateAgeMonths != null ? String(approximateAgeMonths) : ''}
          onChangeText={(t) => {
            const months = Math.max(0, parseInt(t, 10) || 0);
            onChange({
              precision: 'approxAge',
              date: monthsToApproxBirthDate(months, Date.now()),
              approximateAgeMonths: months,
            });
          }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 6: Export it**

```typescript
// src/components/ui/index.ts — add:
export { GracefulDateField } from './GracefulDateField';
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors beyond what Tasks 2-3 already left (petService.ts/its test) — `GracefulDateField` isn't rendered anywhere yet until Task 7, that's expected.

- [ ] **Step 8: Commit**

```bash
git add src/pets/dateGrace.ts src/components/ui/GracefulDateField.tsx src/components/ui/index.ts __tests__/dateGrace.test.ts
git commit -m "feat: add graceful exact/roughly/approxAge/unknown date field"
git push
```

---

### Task 5: Breed picker — Mixed/Stray/Don't-know pinned above a curated list

**Files:**
- Create: `src/pets/breeds.ts`, `src/components/ui/BreedPicker.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `BREEDS_BY_SPECIES: Partial<Record<PetSpecies, string[]>>` (curated, alphabetically pre-sorted per species — **deliberately not exhaustive**, see Assumptions); `<BreedPicker species, value, onSelect, onClose>` — a full-screen-style modal list: three pinned rows (`Mixed`, `Stray or rescued`, `Don't know`) visually separated (a divider + spacing gap) above the alphabetical `BREEDS_BY_SPECIES[species]` list, with a free-text row at the very bottom ("Type your own") that reveals a `TextField` for anything not listed. Selecting any row calls `onSelect(breedString)` with the plain display string (`breed` stays a plain `string` field — no new enum needed, "Mixed"/"Stray or rescued"/"Don't know" are just three specific strings among all the others).

**This is the single most important line in the whole plan (execution pack's own words):** Mixed / Stray or rescued / Don't know must render **above and visually separated from** the alphabetical list — never merged into it alphabetically (which would bury "Mixed" between "Maltese" and "Manx", exactly what Ana's annotations call out as the competitors' failure).

- [ ] **Step 1: Write the curated breed data**

```typescript
// src/pets/breeds.ts
import { PetSpecies } from '../types/pet';

// Deliberately curated, not exhaustive — a representative common-breeds list
// per species, not a kennel-club-complete database. See the plan's
// Assumptions section for why. Species with no meaningful "breed" concept
// (reptile, small_rodent as a catch-all category) get an empty list, which
// BreedPicker handles by skipping straight to the free-text row.
export const BREEDS_BY_SPECIES: Partial<Record<PetSpecies, string[]>> = {
  dog: [
    'Beagle', 'Bichon Frise', 'Border Collie', 'Boxer', 'Bulldog', 'Chihuahua',
    'Cocker Spaniel', 'Dachshund', 'Doberman', 'French Bulldog', 'German Shepherd',
    'Golden Retriever', 'Great Dane', 'Labrador Retriever', 'Maltese', 'Pomeranian',
    'Poodle', 'Pug', 'Rottweiler', 'Shih Tzu', 'Siberian Husky', 'Yorkshire Terrier',
  ],
  cat: [
    'Abyssinian', 'American Shorthair', 'Bengal', 'British Shorthair', 'Burmese',
    'Devon Rex', 'Domestic Shorthair', 'Maine Coon', 'Persian', 'Ragdoll',
    'Russian Blue', 'Scottish Fold', 'Siamese', 'Sphynx', 'Turkish Angora',
  ],
  rabbit: ['Dutch', 'Flemish Giant', 'Holland Lop', 'Lionhead', 'Mini Rex', 'Netherland Dwarf'],
  bird: ['Budgerigar', 'Canary', 'Cockatiel', 'Cockatoo', 'Conure', 'Finch', 'Lovebird', 'Parrot'],
  ferret: ['Standard Ferret'],
};
```

- [ ] **Step 2: Write `BreedPicker.tsx`**

```typescript
// src/components/ui/BreedPicker.tsx
import React, { useState } from 'react';
import { Modal, View, FlatList, Pressable } from 'react-native';
import { PetSpecies } from '../../types/pet';
import { BREEDS_BY_SPECIES } from '../../pets/breeds';
import { BodyText, Title, MutedText } from './Typography';
import { TextField } from './TextField';
import { Button } from './Button';
import { colors, spacing, radii } from '../../theme/theme';

const PINNED = ['Mixed', 'Stray or rescued', "Don't know"];

interface BreedPickerProps {
  visible: boolean;
  species: PetSpecies;
  value: string;
  onSelect: (breed: string) => void;
  onClose: () => void;
}

export function BreedPicker({ visible, species, value, onSelect, onClose }: BreedPickerProps) {
  const [customText, setCustomText] = useState(PINNED.includes(value) ? '' : value);
  const list = BREEDS_BY_SPECIES[species] ?? [];

  const choose = (breed: string) => {
    onSelect(breed);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md }}>
        <Title>Breed</Title>
        <View style={{ gap: spacing.xs }}>
          {PINNED.map((label) => (
            <Pressable
              key={label}
              onPress={() => choose(label)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={{
                minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md,
                borderRadius: radii.md, backgroundColor: value === label ? colors.primary : colors.surfaceTint,
              }}
            >
              <BodyText style={{ color: value === label ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{label}</BodyText>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <FlatList
          data={list}
          keyExtractor={(b) => b}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.xs }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={item}
              style={{
                minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md,
                borderRadius: radii.md, backgroundColor: value === item ? colors.primary : 'transparent',
              }}
            >
              <BodyText style={{ color: value === item ? '#FFFFFF' : colors.text }}>{item}</BodyText>
            </Pressable>
          )}
          ListEmptyComponent={<MutedText>No preset list for this species — type your own below.</MutedText>}
        />
        <View style={{ gap: spacing.xs }}>
          <TextField
            label="Not listed? Type your own"
            placeholder="Breed name"
            value={customText}
            onChangeText={setCustomText}
          />
          <Button title="Use this breed" variant="outline" onPress={() => customText.trim() && choose(customText.trim())} />
        </View>
        <Button title="Cancel" variant="outline" onPress={onClose} />
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: Export it**

```typescript
// src/components/ui/index.ts — add:
export { BreedPicker } from './BreedPicker';
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors beyond the already-known petService.ts state — `BreedPicker` isn't rendered anywhere until Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/pets/breeds.ts src/components/ui/BreedPicker.tsx src/components/ui/index.ts
git commit -m "feat: add breed picker with Mixed/Stray/Don't-know pinned above the list"
git push
```

---

### Task 6: `petService.ts` — options-object `createPet`, plus `updatePet`

**Files:**
- Modify: `src/pets/petService.ts`, `__tests__/petService.test.ts`

**Interfaces:**
- Produces: `createPet(db, householdId, input: NewPetInput, existingPets: Pet[]): Promise<Pet>` (replaces the old 6-positional-argument form — the field count from Task 2 makes positional args unreadable); `updatePet(db, householdId, petId, updates: Partial<Pet>): Promise<void>`. `NewPetInput` is every `Pet` field except `id`, `householdId`, `colorKey` (assigned internally), `photoUrl` (set via the existing separate `updatePetPhoto` step, unchanged from Plan 3).
- Consumes: `assignPetColor` (Task-3-era `src/theme/petColors.ts`, unchanged).

**This task's signature change means Task 7's wizard is the only caller to update** — `AddPetScreen.tsx` is rewritten in that task anyway, so there's no intermediate broken-caller state to worry about within this plan (Task 2 already left `tsc` failing on the old call site; this task doesn't fix it, Task 7 does — expected and fine).

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/petService.test.ts — full replacement of the file's content:
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'pet-1' };
const mockExistingDocRef = { id: 'pet-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'pet-1-existing' ? mockExistingDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

import { createPet, getPet, subscribeToPets, updatePetPhoto, updatePetColor, updatePet } from '../src/pets/petService';
import { NewPetInput } from '../src/pets/petService';

const fakeDb = {} as Firestore;

const minimalInput: NewPetInput = {
  name: 'Rex', species: 'dog', speciesOther: null, breed: 'Mixed',
  birthDate: 1000, birthDatePrecision: 'exact', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null,
  sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('petService', () => {
  it('creates a pet under the household with every field and an assigned colour', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const pet = await createPet(fakeDb, 'h1', minimalInput, []);

    expect(pet).toEqual({
      id: 'pet-1', householdId: 'h1', photoUrl: null, colorKey: '#EF4444', ...minimalInput,
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

  it('updates a pet with a partial set of fields', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updatePet(fakeDb, 'h1', 'pet-1-existing', { name: 'Rexy', status: 'remembered' });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockExistingDocRef, { name: 'Rexy', status: 'remembered' });
  });
});
```

(This drops the old `updatePetPhoto`/`updatePetColor` tests' inline duplication since they're unchanged from Plan 3 — re-add them verbatim from the current file if this replacement accidentally drops coverage; read the current file first to confirm what else it covers before overwriting.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/petService.test.ts`
Expected: FAIL — `createPet`'s signature doesn't match yet, `updatePet`/`NewPetInput` don't exist.

- [ ] **Step 3: Implement**

```typescript
// src/pets/petService.ts — full file:
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Pet } from '../types/pet';
import { assignPetColor } from '../theme/petColors';

export type NewPetInput = Omit<Pet, 'id' | 'householdId' | 'photoUrl' | 'colorKey'>;

export async function createPet(
  db: Firestore,
  householdId: string,
  input: NewPetInput,
  existingPets: Pet[]
): Promise<Pet> {
  const docRef = doc(collection(db, 'households', householdId, 'pets'));
  const pet: Pet = {
    ...input,
    id: docRef.id,
    householdId,
    photoUrl: null,
    colorKey: assignPetColor(existingPets),
  };
  await setDoc(docRef, pet);
  return pet;
}

export async function updatePet(
  db: Firestore,
  householdId: string,
  petId: string,
  updates: Partial<Pet>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId), updates);
}

export async function updatePetPhoto(
  db: Firestore,
  householdId: string,
  petId: string,
  photoUrl: string
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId), { photoUrl });
}

export async function updatePetColor(
  db: Firestore,
  householdId: string,
  petId: string,
  colorKey: string
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId), { colorKey });
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
  return onSnapshot(
    collection(db, 'households', householdId, 'pets'),
    (snap) => callback(snap.docs.map((d) => d.data() as Pet)),
    (error) => {
      console.error('subscribeToPets listener error', error);
      callback([]);
    }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/petService.test.ts`
Expected: PASS

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: errors now ONLY in `src/navigation/AddPetScreen.tsx` (the old call site, not yet rewritten — Task 7 fixes this).

- [ ] **Step 6: Commit**

```bash
git add src/pets/petService.ts __tests__/petService.test.ts
git commit -m "feat: petService createPet takes an options object, add updatePet"
git push
```

---

### Task 7: Add-pet wizard — shell, name/photo, species, breed, birth date

**Files:**
- Rewrite: `src/navigation/AddPetScreen.tsx`

**Interfaces:**
- Consumes: `createPet`/`NewPetInput` (Task 6), `SPECIES_LIST`/`SPECIES_LABEL`/`SPECIES_EMOJI` (Task 3), `BreedPicker` (Task 5), `GracefulDateField` (Task 4).
- Produces: a `WizardData` local shape this task starts and Task 8 extends — later steps in this same file (added by Task 8) read/write the same `useState` object, so the exact field names here must match `NewPetInput` exactly (they do, by construction).

**Design:** internal `step: number` state, not separate routes — keeps "Neo's species" personalization trivial (name is already in local state by step 2) and avoids a 9-screen back-stack. Steps in this task: 0 (name + photo), 1 (species), 2 (breed), 3 (birth date). Task 8 adds steps 4-7 (arrival date, about-the-pet, microchip, custom fields) and Task 9 adds step 8 (review + save). This task's `AddPetScreen` is not yet complete/buildable to a working final screen on its own — **it will not compile standalone as "done" until Task 9 lands the Save button** (the same kind of intentional, documented multi-task coupling as Plan 3's Task 8/9 `AddSheet` split; this is fine, `tsc` on this task's own diff won't fully validate since the file imports things Task 8/9 also touch in the SAME file, not a cross-file split — read the note in Task 8/9 below on how this file evolves task-to-task).

**Important for whoever executes this:** because Tasks 7, 8, and 9 all modify the *same single file* (`AddPetScreen.tsx`) as a genuinely continuous piece of work (a step wizard can't be meaningfully split across files without an awkward step-registry abstraction this plan deliberately avoids — YAGNI for a 9-step linear wizard), **Task 7's own verification is `tsc --noEmit` showing errors ONLY about the not-yet-existing later steps' JSX being referenced from a `default: return null` placeholder, not a fully green compile.** Task 9 is the task where `tsc` must be fully clean and the screen screenshot-verified end to end.

- [ ] **Step 1: Write the wizard shell + first four steps**

```typescript
// src/navigation/AddPetScreen.tsx
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createPet, updatePetPhoto, subscribeToPets, NewPetInput } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet, PetSpecies, DatePrecision, ArrivalPrecision } from '../types/pet';
import { SPECIES_LIST, SPECIES_LABEL, SPECIES_EMOJI } from '../pets/species';
import {
  ScreenContainer, TextField, Button, ErrorText, Chip, AvatarPicker,
  Title, MutedText, GracefulDateField, BreedPicker,
} from '../components/ui';
import { spacing } from '../theme/theme';

type WizardData = NewPetInput & { photoDataUri: string | null };

const INITIAL: WizardData = {
  name: '', species: 'dog', speciesOther: null, breed: '',
  birthDate: Date.now(), birthDatePrecision: 'exact', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null,
  sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active', photoDataUri: null,
};

const TOTAL_STEPS = 9; // 0-indexed steps 0..8; Task 9 adds the final review step (index 8)

export function AddPetScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [existingPets, setExistingPets] = useState<Pet[]>([]);
  const [breedPickerOpen, setBreedPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setExistingPets);
  }, [household]);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSave = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      const { photoDataUri, ...input } = data;
      const pet = await createPet(firestore, household.id, input, existingPets);
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

  const petName = data.name.trim() || 'your pet';

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Title>Let's add a pet</Title>
            <AvatarPicker photoUri={data.photoDataUri} onPicked={(uri) => update({ photoDataUri: uri })} />
            <TextField label="Name" placeholder="Pet's name" value={data.name} onChangeText={(t) => update({ name: t })} />
          </>
        );
      case 1:
        return (
          <>
            <Title>{`What kind of animal is ${petName}?`}</Title>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SPECIES_LIST.map((s) => (
                <Chip
                  key={s}
                  label={`${SPECIES_EMOJI[s]} ${SPECIES_LABEL[s]}`}
                  selected={data.species === s}
                  onPress={() => update({ species: s, speciesOther: s === 'other' ? data.speciesOther : null })}
                />
              ))}
            </View>
            {data.species === 'other' && (
              <TextField
                label="What kind?"
                placeholder="e.g. Guinea pig, tortoise..."
                value={data.speciesOther ?? ''}
                onChangeText={(t) => update({ speciesOther: t })}
              />
            )}
          </>
        );
      case 2:
        return (
          <>
            <Title>{`${petName}'s breed`}</Title>
            <MutedText>Not sure, or not a specific breed? That's completely fine — pick Mixed, Stray or rescued, or Don't know.</MutedText>
            <Button
              title={data.breed || 'Choose a breed (optional)'}
              variant="outline"
              onPress={() => setBreedPickerOpen(true)}
            />
            <BreedPicker
              visible={breedPickerOpen}
              species={data.species}
              value={data.breed}
              onSelect={(b) => update({ breed: b })}
              onClose={() => setBreedPickerOpen(false)}
            />
          </>
        );
      case 3:
        return (
          <>
            <Title>{`When was ${petName} born?`}</Title>
            <GracefulDateField
              label="Birth date"
              options={['exact', 'roughly', 'approxAge', 'unknown']}
              precision={data.birthDatePrecision}
              date={data.birthDate}
              approximateAgeMonths={data.approximateAgeMonths}
              onChange={({ precision, date, approximateAgeMonths }) =>
                update({ birthDatePrecision: precision as DatePrecision, birthDate: date, approximateAgeMonths })
              }
            />
          </>
        );
      default:
        return null; // steps 4-8 added by Tasks 8-9
    }
  };

  return (
    <ScreenContainer scroll>
      <MutedText>{`Step ${step + 1} of ${TOTAL_STEPS}`}</MutedText>
      {renderStep()}
      {error && <ErrorText>{error}</ErrorText>}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {step > 0 && <Button title="Back" variant="outline" onPress={back} style={{ flex: 1 }} />}
        {step < TOTAL_STEPS - 1 ? (
          <Button title="Next" onPress={next} style={{ flex: 1 }} />
        ) : (
          <Button title="Add pet" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
        )}
      </View>
    </ScreenContainer>
  );
}
```

Note: with `TOTAL_STEPS = 9` and only cases 0-3 implemented, stepping to 4-7 currently renders `null` (an empty step with just Back/Next) and step 8 shows the "Add pet" button prematurely — **this is expected, intermediate state**; Task 8 fills in cases 4-7, Task 9 fills in case 8 and is the task where the whole flow is screenshot-verified end to end. Do not attempt to make this task's version end-to-end usable; that's explicitly deferred to Task 9's verification step.

- [ ] **Step 2: Run tsc, expect only the known/intentional gaps**

Run: `npx tsc --noEmit`
Expected: 0 errors (all types line up — the `default: return null` case is valid TS, and every field this step touches exists on `WizardData`/`NewPetInput` from Task 2/6). If there ARE errors, they're real and must be fixed before committing — unlike the deliberately-incomplete UI flow, a clean `tsc` is required at the end of every task in this plan, including this one.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/AddPetScreen.tsx
git commit -m "feat: add-pet wizard shell with name/photo, species, breed, birth-date steps"
git push
```

---

### Task 8: Add-pet wizard — arrival date, about-the-pet, microchip, custom fields

**Files:**
- Modify: `src/navigation/AddPetScreen.tsx` (continues Task 7's file)

**Interfaces:**
- Consumes: `canAddCustomField`/`customFieldLimitMessage` (Task 1), `GracefulDateField` (Task 4, arrival-date mode).
- Produces: cases 4-7 of `renderStep()`.

- [ ] **Step 1: Add imports for the limits module and the plain `DateField` (microchip date needs no graceful degradation, unlike birth/arrival date)**

```typescript
// src/navigation/AddPetScreen.tsx — add to the existing import block:
import { canAddCustomField, customFieldLimitMessage } from '../limits/limits';
import { DateField } from '../components/DateField';
```

- [ ] **Step 2: Fill in cases 4-7 of `renderStep()`**

```typescript
// src/navigation/AddPetScreen.tsx — inside renderStep()'s switch, replace `default: return null;`
// with these four new cases, keeping `default: return null;` (now only reached by case 8, until Task 9):
      case 4:
        return (
          <>
            <Title>{`When did ${petName} join your care?`}</Title>
            <MutedText>Optional — skip this if you'd rather not answer.</MutedText>
            <GracefulDateField
              label="Arrival date"
              options={['exact', 'roughly', 'unknown']}
              precision={data.arrivalDatePrecision}
              date={data.arrivalDate}
              approximateAgeMonths={null}
              onChange={({ precision, date }) =>
                update({ arrivalDatePrecision: precision as ArrivalPrecision, arrivalDate: date })
              }
            />
            <Button
              title="Skip"
              variant="outline"
              onPress={() => update({ arrivalDatePrecision: null, arrivalDate: null })}
            />
          </>
        );
      case 5:
        return (
          <>
            <Title>{`About ${petName}`}</Title>
            <View style={{ gap: spacing.xs }}>
              <MutedText>Sex — helps tailor care reminders.</MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['male', 'female', 'unknown'] as const).map((s) => (
                  <Chip key={s} label={s} selected={data.sex === s} onPress={() => update({ sex: s })} />
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <MutedText>Neutered / spayed — some vaccines and medications are dosed differently.</MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Chip label="Yes" selected={data.neutered === true} onPress={() => update({ neutered: true })} />
                <Chip label="No" selected={data.neutered === false} onPress={() => update({ neutered: false })} />
                <Chip label="Don't know" selected={data.neutered === null} onPress={() => update({ neutered: null })} />
              </View>
            </View>
            <TextField
              label="Colour / markings (optional)"
              value={data.colorMarkings}
              onChangeText={(t) => update({ colorMarkings: t })}
            />
            <View style={{ gap: spacing.xs }}>
              <MutedText>Where do they spend their time? This changes flea/tick/worm risk, so protection can be tailored to match.</MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['indoor', 'outdoor', 'both'] as const).map((e) => (
                  <Chip key={e} label={e} selected={data.livingEnvironment === e} onPress={() => update({ livingEnvironment: e })} />
                ))}
              </View>
            </View>
          </>
        );
      case 6:
        return (
          <>
            <Title>Microchip</Title>
            <MutedText>Optional — add this now or anytime from the pet's profile.</MutedText>
            <TextField label="Provider" value={data.microchipProvider} onChangeText={(t) => update({ microchipProvider: t })} />
            <TextField label="Chip number" value={data.microchipNumber} onChangeText={(t) => update({ microchipNumber: t })} />
            <DateField
              label="Date implanted"
              value={data.microchipDate}
              onChange={(v) => update({ microchipDate: v })}
              onClear={() => update({ microchipDate: null })}
            />
            <TextField label="Registry" value={data.microchipRegistry} onChangeText={(t) => update({ microchipRegistry: t })} />
          </>
        );
      case 7: {
        const atLimit = !canAddCustomField(data);
        return (
          <>
            <Title>Custom fields</Title>
            <MutedText>Add your own fields — favourite food, walking route, anything you want to remember.</MutedText>
            {data.customFields.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextField
                  label="Label"
                  value={f.label}
                  onChangeText={(t) => update({ customFields: data.customFields.map((cf, j) => (j === i ? { ...cf, label: t } : cf)) })}
                  style={{ flex: 1 }}
                />
                <TextField
                  label="Value"
                  value={f.value}
                  onChangeText={(t) => update({ customFields: data.customFields.map((cf, j) => (j === i ? { ...cf, value: t } : cf)) })}
                  style={{ flex: 1 }}
                />
              </View>
            ))}
            <Button
              title={atLimit ? customFieldLimitMessage() : 'Add a custom field'}
              variant="outline"
              disabled={atLimit}
              onPress={() => update({ customFields: [...data.customFields, { label: '', value: '' }] })}
            />
          </>
        );
      }
```

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/AddPetScreen.tsx
git commit -m "feat: add-pet wizard arrival-date, about-pet, microchip, custom-field steps"
git push
```

---

### Task 9: Add-pet wizard — Review step, end-to-end verification

**Files:**
- Modify: `src/navigation/AddPetScreen.tsx` (final step of this file's evolution across Tasks 7-9)

**Interfaces:**
- Produces: case 8 of `renderStep()` — every field shown, each row tappable to jump `setStep()` back to the question that set it.

- [ ] **Step 1: Fill in case 8 (Review)**

```typescript
// src/navigation/AddPetScreen.tsx — replace `default: return null;` with:
      case 8: {
        const Row = ({ label, value, jumpTo }: { label: string; value: string; jumpTo: number }) => (
          <Chip label={`${label}: ${value || '—'}`} selected={false} onPress={() => setStep(jumpTo)} />
        );
        return (
          <>
            <Title>Review</Title>
            <MutedText>Tap anything to change it.</MutedText>
            <View style={{ gap: spacing.xs }}>
              <Row label="Name" value={data.name} jumpTo={0} />
              <Row label="Species" value={data.species === 'other' ? (data.speciesOther ?? '') : SPECIES_LABEL[data.species]} jumpTo={1} />
              <Row label="Breed" value={data.breed} jumpTo={2} />
              <Row label="Birth date" value={data.birthDate ? new Date(data.birthDate).toLocaleDateString() : "Don't know"} jumpTo={3} />
              <Row label="Arrival date" value={data.arrivalDate ? new Date(data.arrivalDate).toLocaleDateString() : 'Not set'} jumpTo={4} />
              <Row label="Sex" value={data.sex} jumpTo={5} />
              <Row label="Neutered" value={data.neutered === null ? "Don't know" : data.neutered ? 'Yes' : 'No'} jumpTo={5} />
              <Row label="Colour / markings" value={data.colorMarkings} jumpTo={5} />
              <Row label="Environment" value={data.livingEnvironment ?? 'Not set'} jumpTo={5} />
              <Row label="Microchip" value={data.microchipNumber} jumpTo={6} />
              <Row label="Custom fields" value={String(data.customFields.length)} jumpTo={7} />
            </View>
          </>
        );
      }
      default:
        return null;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors — this must be fully clean now, the whole wizard is complete.

- [ ] **Step 3: Device verification**

Run `npx expo run:android` (or reload if already running). On the phone: add a pet giving only a name (tap Next through every step without filling anything else) — it should reach Save and succeed, and the resulting pet should not look half-broken on the home screen. Then add a second pet filling in every field including 3 custom fields, confirm the "Add a custom field" button becomes disabled with the limit message on the 4th attempt. Confirm the breed screen shows Mixed/Stray/Don't know visibly above the alphabetical list without scrolling. Confirm the Review step's rows jump back to the right step when tapped. Try a very long pet name and a very long custom field label — confirm nothing overflows or gets cut off mid-word.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/AddPetScreen.tsx
git commit -m "feat: add-pet wizard review step, wire end to end"
git push
```

---

### Task 10: Edit a pet — flat form, "remembered" toggle, entry point

**Files:**
- Create: `src/navigation/EditPetScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`, `src/navigation/PetHomeScreen.tsx`

**Interfaces:**
- Consumes: `updatePet` (Task 6), `getPet`/`subscribeToPets` (existing), same field-editing components as the wizard (`GracefulDateField`, `BreedPicker`, species chips) but laid out as one flat scrollable form, not a wizard — the person already has data, re-doing onboarding friction here would be actively worse.
- Produces: route `EditPet`, reachable from `PetHomeScreen` via a new "Edit" button.

**No delete button anywhere in this screen or file** — the only status-changing action is a "This pet has passed away" toggle that sets `status: 'remembered'` (and a way to undo it, setting back to `'active'`), never a destructive delete.

- [ ] **Step 1: Write `EditPetScreen.tsx`**

```typescript
// src/navigation/EditPetScreen.tsx
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { getPet, updatePet, updatePetPhoto } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet, DatePrecision, ArrivalPrecision } from '../types/pet';
import { SPECIES_LIST, SPECIES_LABEL, SPECIES_EMOJI } from '../pets/species';
import { DateField } from '../components/DateField';
import {
  ScreenContainer, TextField, Button, ErrorText, Chip, AvatarPicker,
  Title, MutedText, GracefulDateField, BreedPicker,
} from '../components/ui';
import { spacing, colors } from '../theme/theme';

export function EditPetScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [pet, setPet] = useState<Pet | null>(null);
  const [breedPickerOpen, setBreedPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    getPet(firestore, household.id, petId).then(setPet);
  }, [household, petId]);

  const patch = (updates: Partial<Pet>) => setPet((p) => (p ? { ...p, ...updates } : p));

  const handleSave = async () => {
    if (!household || !pet) return;
    setError(null);
    setLoading(true);
    try {
      const { id, householdId, photoUrl, colorKey, ...updates } = pet;
      await updatePet(firestore, household.id, petId, updates);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!pet) {
    return (
      <ScreenContainer>
        <MutedText>Loading…</MutedText>
      </ScreenContainer>
    );
  }

  const isRemembered = pet.status === 'remembered';

  return (
    <ScreenContainer scroll>
      <AvatarPicker
        photoUri={pet.photoUrl}
        fallbackEmoji={SPECIES_EMOJI[pet.species]}
        onPicked={(uri) => household && updatePetPhoto(firestore, household.id, petId, uri)}
      />
      <TextField label="Name" value={pet.name} onChangeText={(t) => patch({ name: t })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {SPECIES_LIST.map((s) => (
          <Chip key={s} label={`${SPECIES_EMOJI[s]} ${SPECIES_LABEL[s]}`} selected={pet.species === s} onPress={() => patch({ species: s })} />
        ))}
      </View>
      {pet.species === 'other' && (
        <TextField label="What kind?" value={pet.speciesOther ?? ''} onChangeText={(t) => patch({ speciesOther: t })} />
      )}
      <Button title={pet.breed || 'Choose a breed'} variant="outline" onPress={() => setBreedPickerOpen(true)} />
      <BreedPicker
        visible={breedPickerOpen}
        species={pet.species}
        value={pet.breed}
        onSelect={(b) => patch({ breed: b })}
        onClose={() => setBreedPickerOpen(false)}
      />
      <GracefulDateField
        label="Birth date"
        options={['exact', 'roughly', 'approxAge', 'unknown']}
        precision={pet.birthDatePrecision}
        date={pet.birthDate}
        approximateAgeMonths={pet.approximateAgeMonths}
        onChange={({ precision, date, approximateAgeMonths }) =>
          patch({ birthDatePrecision: precision as DatePrecision, birthDate: date, approximateAgeMonths })
        }
      />
      <GracefulDateField
        label="Arrival date"
        options={['exact', 'roughly', 'unknown']}
        precision={pet.arrivalDatePrecision}
        date={pet.arrivalDate}
        approximateAgeMonths={null}
        onChange={({ precision, date }) => patch({ arrivalDatePrecision: precision as ArrivalPrecision, arrivalDate: date })}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['male', 'female', 'unknown'] as const).map((s) => (
          <Chip key={s} label={s} selected={pet.sex === s} onPress={() => patch({ sex: s })} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Neutered: Yes" selected={pet.neutered === true} onPress={() => patch({ neutered: true })} />
        <Chip label="Neutered: No" selected={pet.neutered === false} onPress={() => patch({ neutered: false })} />
      </View>
      <TextField label="Colour / markings" value={pet.colorMarkings} onChangeText={(t) => patch({ colorMarkings: t })} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['indoor', 'outdoor', 'both'] as const).map((e) => (
          <Chip key={e} label={e} selected={pet.livingEnvironment === e} onPress={() => patch({ livingEnvironment: e })} />
        ))}
      </View>
      <TextField label="Microchip provider" value={pet.microchipProvider} onChangeText={(t) => patch({ microchipProvider: t })} />
      <TextField label="Microchip number" value={pet.microchipNumber} onChangeText={(t) => patch({ microchipNumber: t })} />
      <DateField
        label="Microchip date implanted"
        value={pet.microchipDate}
        onChange={(v) => patch({ microchipDate: v })}
        onClear={() => patch({ microchipDate: null })}
      />
      <TextField label="Microchip registry" value={pet.microchipRegistry} onChangeText={(t) => patch({ microchipRegistry: t })} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Save changes" onPress={handleSave} loading={loading} />
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
      <Button
        title={isRemembered ? 'Mark as active again' : 'This pet has passed away'}
        variant={isRemembered ? 'outline' : 'danger'}
        onPress={() => patch({ status: isRemembered ? 'active' : 'remembered' })}
      />
      {isRemembered && <MutedText>{`${pet.name} will be moved out of your active pets list. Their records are kept safe and can be restored anytime with this same button.`}</MutedText>}
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Register the route**

```typescript
// src/navigation/MainNavigator.tsx — add the import and one more Stack.Screen:
import { EditPetScreen } from './EditPetScreen';
// ...inside <Stack.Navigator>, anywhere after PetHome:
      <Stack.Screen name="EditPet" component={EditPetScreen} options={{ title: 'Edit Pet' }} />
```

- [ ] **Step 3: Add the entry point from `PetHomeScreen.tsx`**

```typescript
// src/navigation/PetHomeScreen.tsx — add near the top, after the existing imports:
import { Button } from '../components/ui'; // extend the existing '../components/ui' import line, don't duplicate

// ...inside the component's returned content, after the pet name / colour-swatch block, add:
      {pet && (
        <Button title="Edit" variant="outline" onPress={() => navigation.navigate('EditPet', { petId })} />
      )}
```

Read the current full `PetHomeScreen.tsx` before editing — merge the import into its existing `'../components/ui'` import line rather than adding a duplicate import statement, and place the Edit button in a sensible spot (immediately after the colour-swatch row, before the weight chart Card).

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Device verification**

On the phone: open a pet, tap Edit, change the name and save, confirm it's reflected on Home. Tap Edit again, tap "This pet has passed away", confirm the button flips to "Mark as active again" and the reassurance text appears; save; confirm the pet disappears from the Home screen's active list (this connects to Task 11 — if Task 11 isn't done yet when this task is verified standalone, the pet will still show; re-verify this specific behavior after Task 11 lands instead of blocking this task on it).

- [ ] **Step 6: Commit**

```bash
git add src/navigation/EditPetScreen.tsx src/navigation/MainNavigator.tsx src/navigation/PetHomeScreen.tsx
git commit -m "feat: add edit-pet screen with remembered/active toggle, no delete"
git push
```

---

### Task 11: Active-only filtering + stale-selection reconciliation

**Files:**
- Modify: `src/navigation/HomeScreen.tsx`, `src/components/ui/PetSelector.tsx`, `src/selection/PetSelectionContext.tsx`

**Interfaces:**
- Consumes: `Pet.status` (Task 2).
- Closes the gap flagged in `NEXTSTEPS.md` by Plan 3's final review: *"Plan 4 (pet profile depth / editing / delete) needs to reconcile a stale `selectedPetId`: if the currently-selected pet in `PetSelectionContext` gets deleted, nothing resets the selection today."* This plan has no hard delete, but "remembered" has the same practical effect on the selector (a pet the user can no longer select from the normal list) — the same reconciliation is needed.

- [ ] **Step 1: Filter `HomeScreen.tsx` to active pets**

```typescript
// src/navigation/HomeScreen.tsx — in the HomeScreen component, change:
//   const [pets, setPets] = useState<Pet[]>([]);
//   ...
//   const visiblePets = selectedPetId === 'all' ? pets : pets.filter((p) => p.id === selectedPetId);
// to filter subscribeToPets' callback to active-only pets (treating a missing `status` field —
// any pet created before this plan — as active, matching Task 2's documented default):
useEffect(() => {
  if (!household) return;
  return subscribeToPets(firestore, household.id, (all) =>
    setPets(all.filter((p) => (p.status ?? 'active') === 'active'))
  );
}, [household]);
```

Read the current full file before editing — this changes only the `subscribeToPets` callback passed in the existing `useEffect`, nothing else in the file (the `visiblePets` filter-by-selection logic below it is untouched).

- [ ] **Step 2: Same filter in `PetSelector.tsx`'s only caller — actually filter at the source, not in the component**

`PetSelector` itself takes `pets: Pet[]` as a prop and has no Firestore access of its own — since `HomeScreen` (Step 1) already passes it only active pets, `PetSelector.tsx` needs no code change for this. **Skip editing this file** — this step exists only to document why: the filtering happens once, at the single `subscribeToPets` call site in `HomeScreen`, not duplicated into every consumer of `pets`.

- [ ] **Step 3: Reconcile `selectedPetId` in `PetSelectionContext.tsx`**

```typescript
// src/selection/PetSelectionContext.tsx — read the current file first. Add a new exported
// function alongside the existing provider/hook that HomeScreen (Step 4 below) calls once it
// knows the active pet list, so the fix lives with the state, not scattered into every screen
// that might select a pet:
export function reconcileSelection(
  selectedPetId: string | 'all',
  activePetIds: string[],
  setSelectedPetId: (id: string | 'all') => void
): void {
  if (selectedPetId !== 'all' && !activePetIds.includes(selectedPetId)) {
    setSelectedPetId('all');
  }
}
```

- [ ] **Step 4: Call it from `HomeScreen.tsx`**

```typescript
// src/navigation/HomeScreen.tsx — add a second useEffect after the pets-subscription one,
// importing reconcileSelection from '../selection/PetSelectionContext' (extend the existing
// import line from that file rather than adding a new one):
useEffect(() => {
  reconcileSelection(selectedPetId, pets.map((p) => p.id), setSelectedPetId);
}, [pets, selectedPetId, setSelectedPetId]);
```

`setSelectedPetId` comes from `usePetSelection()`, already destructured in this file — extend that existing destructure to include it if it doesn't already (read the current file to check).

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Device verification**

Select a specific pet via the Home screen's selector (not "All Pets"), then go mark that pet as remembered via Edit (Task 10). Navigate back to Home — confirm the selector automatically falls back to "All Pets" rather than showing a broken/empty filtered view, and the remembered pet no longer appears anywhere on Home.

- [ ] **Step 7: Commit**

```bash
git add src/navigation/HomeScreen.tsx src/selection/PetSelectionContext.tsx
git commit -m "feat: filter Home/selector to active pets, reconcile stale selection"
git push
```

---

### Task 12: Guided empty states — shared component, applied to custom fields + two record lists

**Files:**
- Create: `src/components/ui/GuidedEmptyState.tsx`
- Modify: `src/components/ui/index.ts`, `src/navigation/VaccineListScreen.tsx`, `src/navigation/WeightLogScreen.tsx`

**Interfaces:**
- Produces: `<GuidedEmptyState emoji, title, message, actionLabel, onAction />` — replaces a bare `MutedText` empty-list message with an emoji, one sentence on why the section matters, and a button that does what the arrow-to-"+"-button in the reference apps does (since this app's "+" lives in the global add sheet, not a local one on these list screens, the guided empty state's own action button navigates directly to that screen's existing `Add...` route rather than pointing at the global button — a deliberate, documented adaptation, see Assumptions).

**Scope note:** the execution pack says "guided empty states start here" — this task establishes the reusable component and applies it to two illustrative places (custom fields, already wired into the wizard/edit screens by construction since Tasks 7/10 only show the "Add a custom field" button with no separate empty state needed there — so the two real applications are the vaccine and weight-log list screens, matching Ana's own annotated example of "for weight, or for any option, the app shows you how you can do it"). Retrofitting the remaining three record-list screens (medications, vet visits, expenses) with the same swap is a mechanical follow-up, deliberately left for whoever next touches those screens rather than bundled into this already-large plan — noted in Assumptions.

- [ ] **Step 1: Write `GuidedEmptyState.tsx`**

```typescript
// src/components/ui/GuidedEmptyState.tsx
import React from 'react';
import { View } from 'react-native';
import { Title, BodyText, MutedText } from './Typography';
import { Button } from './Button';
import { spacing } from '../../theme/theme';

interface GuidedEmptyStateProps {
  emoji: string;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function GuidedEmptyState({ emoji, title, message, actionLabel, onAction }: GuidedEmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
      <Title style={{ fontSize: 48 }}>{emoji}</Title>
      <BodyText style={{ fontWeight: '700', textAlign: 'center' }}>{title}</BodyText>
      <MutedText style={{ textAlign: 'center' }}>{message}</MutedText>
      <Button title={actionLabel} onPress={onAction} />
    </View>
  );
}
```

- [ ] **Step 2: Export it**

```typescript
// src/components/ui/index.ts — add:
export { GuidedEmptyState } from './GuidedEmptyState';
```

- [ ] **Step 3: Apply to `VaccineListScreen.tsx`**

```typescript
// src/navigation/VaccineListScreen.tsx — replace:
//   ListEmptyComponent={<MutedText>No vaccine records yet.</MutedText>}
// with:
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="💉"
            title="No vaccines logged yet"
            message="Track vaccinations here to spot what's due and keep a full record for the vet."
            actionLabel="Add a vaccine"
            onAction={() => navigation.navigate('AddVaccine', { petId })}
          />
        }
```

Add `GuidedEmptyState` to the file's existing `'../components/ui'` import line — read the current file's exact import line before editing, don't add a duplicate import statement.

- [ ] **Step 4: Apply to `WeightLogScreen.tsx`**

Read the current file first (it wasn't shown during planning) to find its existing empty-state text and list structure, then apply the same swap pattern as Step 3: a `GuidedEmptyState` with `emoji="⚖️"`, `title="No weight logged yet"`, `message="Track your pet's weight to spot health changes early."` (this exact sentence is Ana's own annotated example from the build plan — use it verbatim), and `actionLabel`/`onAction` wired to whatever this screen's existing add-weight action already is.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Device verification**

On the phone: open a pet with no vaccines and no weight logs, confirm both screens show the new guided empty state (emoji, sentence, button) instead of the old bare text, and the button navigates correctly.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/GuidedEmptyState.tsx src/components/ui/index.ts src/navigation/VaccineListScreen.tsx src/navigation/WeightLogScreen.tsx
git commit -m "feat: add guided empty state, apply to vaccines and weight log"
git push
```

---

## Assumptions and open questions

- **Breed lists are curated, not exhaustive.** `BREEDS_BY_SPECIES` (Task 5) has roughly 10-22 common breeds per species, not a kennel-club-complete database. This is a deliberate MVP scope cut: Ana's actual complaint (per the build plan) was about being *forced* into scrolling an alphabetical list with no escape, not about breed-list completeness — the pinned Mixed/Stray/Don't-know rows plus a free-text fallback at the bottom solve the real problem without needing to hand-maintain hundreds of breed names per species. If the owner wants a genuinely complete breed database later, that's a data-sourcing task, not a re-architecture — `BreedPicker`'s interface doesn't change.
- **`reptile` and `small_rodent` have no curated breed list at all** (`BREEDS_BY_SPECIES` has no entry for them) — `BreedPicker` handles this by showing only the pinned rows + free text, confirmed in its `ListEmptyComponent`. This seems right (there's no meaningful "breed" concept for most reptiles/rodents the way there is for dogs/cats) but flagging in case the owner disagrees.
- **`arrivalDate` has no "approximate age" option**, only exact/roughly/unknown (via `Skip`) — "age" doesn't make sense for "when did they join your care," only for birth date. `GracefulDateField`'s `options` prop is how each caller opts into the right subset.
- **The Review step's "jump back" (Task 9) doesn't restore a snapshot** — tapping a row just calls `setStep()`, and the wizard's `data` state is already shared across all steps by construction (one component, one `useState`), so nothing is "reset," the user just sees the same in-progress data at an earlier step. This matches the spec's "every row goes back to the right question when tapped, still editable" requirement without needing any separate undo/snapshot machinery.
- **Guided empty states are applied to 2 of 5 existing record-list screens in this plan** (vaccines, weight log — Task 12), not all five. Medications, vet visits, and expenses keep their existing bare-text empty states for now. This plan is already large; the remaining three are a mechanical follow-up (same component, same pattern) rather than a design question, and are explicitly NOT claimed as done by this plan.
- **`GuidedEmptyState`'s action button replaces the reference apps' "arrow pointing at the global + button"** rather than literally drawing an arrow at the tab bar's raised add button. This app's add flow is centralized (Plan 3's global "+" sheet) rather than per-screen, so a local "Add a vaccine" button that navigates directly to `AddVaccineScreen` is the equivalent, arguably more direct, adaptation — not a literal implementation of "a hand-drawn arrow," which wouldn't make sense pointing at a tab bar button several inches away from an empty list.
- **`NewPetInput` (Task 6) intentionally excludes `photoUrl`** — photo upload stays a separate step after `createPet` returns (unchanged from Plan 1-3's existing pattern: create the doc, then `updatePetPhoto` with the resulting `pet.id`), not folded into the create-time input object.
- **No screen exists yet to browse "remembered" pets** — once a pet is marked remembered, it's hidden from Home/the selector (Task 11) but nothing in this plan adds a dedicated "view remembered pets" list. Their data is fully preserved in Firestore and reachable via `PetHome`/`EditPet` if something still holds their `petId` (e.g., a deep link, or before Task 11's filtering took effect), but there's no in-app path to discover a remembered pet's `petId` after it's hidden. This is a real, acknowledged gap — matches the execution pack's minimal "a 'remembered' state for a pet that has died" ask without inventing a whole archive UI the spec didn't ask for; worth a small follow-up plan/task if the owner wants one.
- **The wizard (`AddPetScreen.tsx`, Tasks 7-9) is built as three sequential tasks modifying one file**, not three independent files — flagged explicitly in Task 7 because it's a real, deliberate deviation from this plan's usual one-task-one-clean-compile pattern (Plan 3's Task 8/9 had a similar, smaller coupling). `tsc` is clean after every task in this plan including 7 and 8; only the *feature* (a fully working wizard) isn't complete until Task 9. A reviewer evaluating Task 7 or 8 in isolation should judge them against "does this step's code work correctly," not "is Add-a-pet fully usable yet."
- **No new native dependency anywhere in this plan** — verified by design (every new component composes from already-installed `react-native`/existing project components); if a task's implementer finds they need one, that's a plan defect to flag, not something to add silently.
- **Household-member-limit UI is explicitly out of scope for this plan** — `canAddHouseholdMember` (Task 1) exists and is correct, but nothing in this plan calls it from a screen (no household-member-adding UI exists yet; that's Plan 7's "Vets directory and household members"). This matches the execution pack's own instruction: build the module now, wire it up later, "nothing else should have to change" when Plan 9 makes it read a real subscription.
