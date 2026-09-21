# Colourful Reskin, Part B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the dark-shell reskin onto the five record-list screens and the Calendar tab (+ Day Detail) — the two areas Part A explicitly deferred.

**Architecture:** Presentation-layer only. Extends the theme tokens and `src/components/ui/*` primitives Part A already built (`shell.*`/`text.*` from `theme.ts`, dark `PetSelector`, `Chip`'s tinted props, `onPetColorInk`) onto seven files: five record-list screens (one shared visual layout), `CalendarScreen.tsx`, and `DayDetailScreen.tsx` (plus their `WeekView`/`MonthView`/`EntryCard` sub-components). No data model, Firestore service, or navigation-structure change.

**Tech Stack:** React Native / Expo, existing `src/theme/theme.ts` tokens, RN's built-in `Animated` (no `react-native-reanimated`), platform-default fonts (no new font dependency).

**Spec:** `design_handoff_colorful_reskin/README.md` sections 3 ("Record lists") and 5 ("Calendar") — the primary design handoff. `docs/superpowers/specs/2026-09-16-colorful-reskin-design.md` (Part A's design doc, all its resolved decisions apply unchanged) and `docs/superpowers/specs/2026-09-21-colorful-reskin-part-b-design.md` (this plan's own design doc, records what's new/reused).

## Global Constraints

- No data model, Firestore service, or navigation-structure change. This is presentation-layer only.
- **Row/screen CONTENT (what data is shown, how it's computed) stays exactly as it is today on every record-list screen.** The README's illustrative row copy (e.g. medications showing "{x} of {y} doses logged") does NOT match what these screens currently compute and is not a mandate to add new derived fields — only the visual container (card shape, colours, typography, spacing) changes. This mirrors Part A's own "no logic change" discipline.
- **`WeightLogScreen` keeps its current structure** (a chart + inline add-weight form, no per-entry list) — it does not gain a new list-of-rows UI. The README's "weight → {kg} kg / {month year}" row description does not apply here since there is no entry-list to reskin.
- Every tappable target stays ≥44px tall, per the README's explicit minimum-sizes section — same rule Part A enforced.
- Compose from `src/components/ui/*` wherever an existing primitive fits (`ScreenContainer`'s `background` prop, dark `PetSelector` variant, `Chip`'s tinted-selection props, `GuidedEmptyState`). Where no existing primitive fits a repeated shape, add a small new one to `src/components/ui/` rather than duplicating markup across files (this plan adds exactly one: `DashedAddButton`).
- No new dependency of any kind. Fonts stay platform-default; all animation uses React Native's built-in `Animated`.
- Follow Part A's established dark-shell precedent exactly: raw numeric `borderRadius`/spacing values matching the README's literal numbers (18, 16, 14, 11, 22, 99, etc.), not the light-theme `radii.*`/`spacing.*` scale, which several existing dark-shell components (`PetHomeScreen.tsx`, `MainTabs.tsx`) already establish as the pattern for this reskin.
- **On-device verification is blocked at plan-authoring time (no reachable device).** Every task still gets its normal code review; Task 9 (the final on-device checklist) stays open/pending until a device is available — do not mark it complete without actually running it on a phone, and do not silently skip it.
- Known risk: if `known-gaps-fixes` (a separate, already-reviewed branch touching `CalendarScreen.tsx`/`DayDetailScreen.tsx` with error-surface handling) merges to `master` before this branch, this branch will need a small rebase reconciliation on those two files — the error-handling additions and this plan's reskin touch different parts of the same functions' bodies, not the same lines.

## File Structure

- **New:** `src/components/ui/DashedAddButton.tsx` — the dashed full-width "Add a ___" footer button shared by all 5 record-list screens.
- **New:** `src/components/ui/RecordListHeader.tsx` — the shared round-back-button + title + "`{Pet} · {n} entries`" sub-header, used identically by all 5 record-list screens.
- **New:** `src/calendar/useCalendarEntryActions.ts` — a shared hook extracting `handleDone`/`handleSkip`/`handleToggleComplete`/`handleEdit`, currently duplicated verbatim between `CalendarScreen.tsx` and `DayDetailScreen.tsx`. Extracted now because this plan adds new "bring back a skipped event" behavior to both screens — writing it once and sharing avoids duplicating new logic twice, not a speculative refactor.
- **Modify:** `src/components/ui/Button.tsx` — adds optional `borderColor`/`textColor`/`bg` override props (mirrors the override-prop pattern Part A already used on `Chip`), needed for the dark `outline` buttons this plan uses (EntryCard's "Skip"/"Bring back", record-list footer contexts).
- **Modify:** `src/calendar/calendarEntries.ts` — `daysWithEntries` return type changes from `number[]` to `Map<number, string[]>` (day → the pet ids with an entry that day), so `WeekView`/`MonthView` can render one dot per pet (up to 3) instead of one generic accent dot. Only consumers: `WeekView.tsx`, `MonthView.tsx`, and this file's own test — all updated in the same task.
- **Modify:** `src/navigation/VaccineListScreen.tsx`, `MedicationListScreen.tsx`, `VetVisitListScreen.tsx` — dark-shell reskin using the two new shared components.
- **Modify:** `src/navigation/ExpenseListScreen.tsx` — dark-shell reskin, including its category-filter chip row (existing behaviour, restyled).
- **Modify:** `src/navigation/WeightLogScreen.tsx` — dark-shell reskin of its existing chart + form structure.
- **Modify:** `src/calendar/EntryCard.tsx` — dark-shell reskin plus the "Not done" (undo completion) and "Bring back" (undo skip) button-state additions the README calls for.
- **Modify:** `src/calendar/WeekView.tsx`, `src/calendar/MonthView.tsx` — dark-shell reskin, multi-pet-dot rendering.
- **Modify:** `src/navigation/CalendarScreen.tsx` — full dark-shell reskin (custom header, view chips, range row, inline month agenda restored, wired to the new shared hook).
- **Modify:** `src/navigation/DayDetailScreen.tsx` — dark-shell reskin, `headerShown: false`, wired to the new shared hook.
- **Modify:** `src/navigation/MainNavigator.tsx` — `headerShown: false` on the 5 record-list `Stack.Screen` entries (`VaccineList`, `MedicationList`, `VetVisitList`, `WeightLog`, `ExpenseList`) only.
- **Modify:** `src/navigation/RootNavigator.tsx` — `headerShown: false` on the `DayDetail` `Stack.Screen` entry only.

---

### Task 1: Shared primitives — `DashedAddButton`, `Button` colour overrides

**Files:**
- Create: `src/components/ui/DashedAddButton.tsx`
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/index.ts`
- Test: `__tests__/DashedAddButton.test.tsx`

**Interfaces:**
- Produces: `<DashedAddButton label={string} onPress={() => void} />`; `Button`'s new optional props `bg?: string`, `textColor?: string`, `borderColor?: string`.
- Consumes: nothing new.

- [ ] **Step 1: Add colour-override props to `Button`**

Edit `src/components/ui/Button.tsx`:

```tsx
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/theme';

type Variant = 'primary' | 'accent' | 'outline' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
  bg?: string;
  textColor?: string;
  borderColor?: string;
}

const variantStyles: Record<Variant, { bg: string; border?: string; text: string }> = {
  primary: { bg: colors.primary, text: '#FFFFFF' },
  accent: { bg: colors.accent, text: colors.accentText },
  outline: { bg: 'transparent', border: colors.primary, text: colors.primary },
  danger: { bg: colors.danger, text: '#FFFFFF' },
};

export function Button({ title, variant = 'primary', loading, disabled, style, bg, textColor, borderColor, ...rest }: ButtonProps) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  const resolvedBg = bg ?? v.bg;
  const resolvedBorder = borderColor ?? v.border;
  const resolvedText = textColor ?? v.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: resolvedBg,
          borderColor: resolvedBorder ?? 'transparent',
          borderWidth: resolvedBorder ? 1.5 : 0,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={resolvedText} /> : <Text style={[styles.text, { color: resolvedText }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
```

Every existing call site keeps working unchanged (all three new props are optional and default to the variant's existing colours).

- [ ] **Step 2: Create `DashedAddButton`**

Create `src/components/ui/DashedAddButton.tsx`:

```tsx
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { shell, text } from '../../theme/theme';

interface DashedAddButtonProps {
  label: string;
  onPress: () => void;
}

// The record-list screens' full-width dashed "Add a vaccine" / "Log a
// weight" / etc. footer button (README §3). A dedicated small component
// because it's reused identically (only the label differs) across 5
// screens — extracting it once avoids duplicating the same styled
// Pressable 5 times, per this plan's file-structure rationale.
export function DashedAddButton({ label, onPress }: DashedAddButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: shell.cardBorderDashed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: text.primary,
  },
});
```

- [ ] **Step 3: Create `RecordListHeader`**

Create `src/components/ui/RecordListHeader.tsx`:

```tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shell, text, spacing } from '../../theme/theme';

interface RecordListHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

// The shared header every record-list screen uses (README §3): a round
// back button + title + "{Pet} · {n} entries" sub-line. These screens run
// with headerShown: false (no native header), so this also carries the
// top safe-area inset itself — the same fix Part A's final review had to
// add after the native header's implicit padding disappeared.
export function RecordListHeader({ title, subtitle, onBack }: RecordListHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.backButton}
      >
        <Text style={styles.backGlyph}>←</Text>
      </Pressable>
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: shell.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 18,
    color: text.primary,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: text.primary,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: text.secondary,
    marginTop: 2,
  },
});
```

- [ ] **Step 4: Export both from `components/ui/index.ts`**

Edit `src/components/ui/index.ts`, add:

```ts
export { DashedAddButton } from './DashedAddButton';
export { RecordListHeader } from './RecordListHeader';
```

- [ ] **Step 5: Write a test for `DashedAddButton`**

Create `__tests__/DashedAddButton.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DashedAddButton } from '../src/components/ui/DashedAddButton';

describe('DashedAddButton', () => {
  it('renders the given label', () => {
    const { getByText } = render(<DashedAddButton label="Add a vaccine" onPress={() => {}} />);
    expect(getByText('Add a vaccine')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<DashedAddButton label="Add a vaccine" onPress={onPress} />);
    fireEvent.press(getByText('Add a vaccine'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

Check `package.json`/existing test files first for whether `@testing-library/react-native` is already a dependency and the established RN-component test pattern (e.g. `__tests__/Chip.test.tsx` from Part A) — match whatever pattern is already in use rather than introducing a new one. If `@testing-library/react-native` is not installed, do not add it; instead test only the exported pure logic (there is none here beyond the render/press wiring) or skip a component-render test and note why in the report — do not add a new test dependency for one small component.

- [ ] **Step 6: Run tests, typecheck, commit**

```bash
npx tsc --noEmit
npx jest __tests__/DashedAddButton.test.tsx __tests__/Chip.test.tsx
git add src/components/ui/Button.tsx src/components/ui/DashedAddButton.tsx src/components/ui/RecordListHeader.tsx src/components/ui/index.ts __tests__/DashedAddButton.test.tsx
git commit -m "feat: add DashedAddButton, RecordListHeader, and Button colour overrides"
```

---

### Task 2: Reskin Vaccine, Medication, and Vet Visit list screens

**Files:**
- Modify: `src/navigation/VaccineListScreen.tsx`
- Modify: `src/navigation/MedicationListScreen.tsx`
- Modify: `src/navigation/VetVisitListScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`

**Interfaces:**
- Consumes: `DashedAddButton`, `RecordListHeader` (Task 1); `ScreenContainer`'s `background` prop, `shell`/`text`/`spacing` tokens, `petColor`/`onPetColorInk` (Part A).
- Produces: nothing new for later tasks.

These three screens share the exact same target shape (README §3): `ScreenContainer` on `shell.bg`, `RecordListHeader`, a list of `shell.card` rows each with a 5–8px pet-colour left rail, and a `DashedAddButton` footer. Row CONTENT (what text each row shows) is unchanged from today's code — only the container.

- [ ] **Step 1: Reskin `VaccineListScreen.tsx`**

Replace the full file with:

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Vaccine } from '../types/vaccine';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function VaccineListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToVaccines(firestore, household.id, petId, setVaccines);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Vaccines"
        subtitle={`${pet?.name ?? 'Pet'} · ${vaccines.length} ${vaccines.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={vaccines}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
            <View style={{ width: 6, backgroundColor: rail }} />
            <View style={{ flex: 1, padding: 14, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{item.name}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                Given {new Date(item.dateGiven).toLocaleDateString()}
              </Text>
              {item.nextDueDate && (
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  Next due {new Date(item.nextDueDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="💉"
            title="No vaccines logged yet"
            message="Track vaccinations here to spot what's due and keep a full record for the vet."
            actionLabel="Add a vaccine"
            onAction={() => navigation.navigate('AddVaccine', { petId })}
          />
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a vaccine" onPress={() => navigation.navigate('AddVaccine', { petId })} />
      </View>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Reskin `MedicationListScreen.tsx`**

Replace the full file with:

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToMedications, logMedicationDose, skipMedicationDose } from '../pets/medicationService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Medication } from '../types/medication';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, Button, ErrorText } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function MedicationListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToMedications(firestore, household.id, petId, setMedications);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const handleMarkGiven = async (medicationId: string) => {
    if (!household || !user) return;
    setError(null);
    try {
      await logMedicationDose(firestore, household.id, petId, medicationId, user.uid);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSkip = async (medicationId: string) => {
    if (!household || !user) return;
    setError(null);
    try {
      await skipMedicationDose(firestore, household.id, petId, medicationId, user.uid);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const displayNameFor = (userId: string) =>
    household?.members.find((m) => m.userId === userId)?.displayName ?? userId;

  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Medications"
        subtitle={`${pet?.name ?? 'Pet'} · ${medications.length} ${medications.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      {error && (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorText>{error}</ErrorText>
        </View>
      )}
      <FlatList
        data={medications}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => {
          const lastAction = item.log.length > 0 ? item.log[item.log.length - 1] : null;
          return (
            <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
              <View style={{ width: 6, backgroundColor: rail }} />
              <View style={{ flex: 1, padding: 14, gap: spacing.xs }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{item.name} — {item.dosage}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {item.schedule.timesPerDay}x/day, every {item.schedule.intervalDays}d
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {lastAction
                    ? `${lastAction.skipped ? 'Last skipped' : 'Last given'}: ${new Date(lastAction.givenAt).toLocaleString()} by ${displayNameFor(lastAction.givenBy)}`
                    : 'No doses logged yet'}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  <Button title="Mark dose as given" variant="accent" onPress={() => handleMarkGiven(item.id)} style={{ flex: 1 }} />
                  <Button
                    title="Skip this dose"
                    variant="outline"
                    borderColor="rgba(255,255,255,0.25)"
                    textColor={text.primary}
                    onPress={() => handleSkip(item.id)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: text.secondary, fontSize: 14, textAlign: 'center', paddingTop: spacing.xl }}>
            No medications yet.
          </Text>
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a medication" onPress={() => navigation.navigate('AddMedication', { petId })} />
      </View>
    </ScreenContainer>
  );
}
```

- [ ] **Step 3: Reskin `VetVisitListScreen.tsx`**

Replace the full file with:

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { VetVisit } from '../types/vetVisit';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function VetVisitListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [visits, setVisits] = useState<VetVisit[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToVetVisits(firestore, household.id, petId, setVisits);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Vet visits"
        subtitle={`${pet?.name ?? 'Pet'} · ${visits.length} ${visits.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('VetVisitDocuments', { petId, visitId: item.id })}>
            <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
              <View style={{ width: 6, backgroundColor: rail }} />
              <View style={{ flex: 1, padding: 14, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{item.reason}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
                {item.notes ? (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{item.notes}</Text>
                ) : null}
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {item.documentUrls.length} document{item.documentUrls.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={{ color: text.secondary, fontSize: 14, textAlign: 'center', paddingTop: spacing.xl }}>
            No vet visits recorded yet.
          </Text>
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a vet visit" onPress={() => navigation.navigate('AddVetVisit', { petId })} />
      </View>
    </ScreenContainer>
  );
}
```

- [ ] **Step 4: Hide the native header on these 3 screens**

Edit `src/navigation/MainNavigator.tsx` — add `headerShown: false` to exactly these 3 `Stack.Screen` entries (do not touch any other entry):

```tsx
<Stack.Screen name="VaccineList" component={VaccineListScreen} options={{ headerShown: false }} />
```
```tsx
<Stack.Screen name="MedicationList" component={MedicationListScreen} options={{ headerShown: false }} />
```
```tsx
<Stack.Screen name="VetVisitList" component={VetVisitListScreen} options={{ headerShown: false }} />
```

- [ ] **Step 5: Typecheck, test, commit**

```bash
npx tsc --noEmit
npx jest __tests__ --testPathIgnorePatterns=firestore.rules
git add src/navigation/VaccineListScreen.tsx src/navigation/MedicationListScreen.tsx src/navigation/VetVisitListScreen.tsx src/navigation/MainNavigator.tsx
git commit -m "feat: reskin Vaccine, Medication, and Vet Visit list screens"
```

---

### Task 3: Reskin the Expense list screen

**Files:**
- Modify: `src/navigation/ExpenseListScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`

**Interfaces:**
- Consumes: `DashedAddButton`, `RecordListHeader` (Task 1); `Chip`'s tinted-selection props (Part A).

- [ ] **Step 1: Reskin `ExpenseListScreen.tsx`**

Replace the full file with:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToExpenses } from '../pets/expenseService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Expense, ExpenseCategory } from '../types/expense';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, Chip } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

const CATEGORIES: (ExpenseCategory | 'all')[] = ['all', 'food', 'vet', 'grooming', 'insurance', 'supplies', 'other'];

export function ExpenseListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all');
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToExpenses(firestore, household.id, petId, setExpenses);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const filtered = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter]
  );
  const totalCents = useMemo(() => filtered.reduce((sum, e) => sum + e.amountCents, 0), [filtered]);
  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Expenses"
        subtitle={`${pet?.name ?? 'Pet'} · ${expenses.length} ${expenses.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={c === filter}
              onPress={() => setFilter(c)}
              selectedBg="#FFFFFF"
              selectedColor={shell.bg}
              unselectedBg="rgba(255,255,255,0.10)"
              unselectedColor="rgba(255,255,255,0.8)"
            />
          ))}
        </View>
        <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>
          Total: ${(totalCents / 100).toFixed(2)}
        </Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
            <View style={{ width: 6, backgroundColor: rail }} />
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary, textTransform: 'capitalize' }}>
                  {item.category}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{item.note}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: text.primary }}>
                ${(item.amountCents / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: text.secondary, fontSize: 14, textAlign: 'center', paddingTop: spacing.xl }}>
            No expenses yet.
          </Text>
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add an expense" onPress={() => navigation.navigate('AddExpense', { petId })} />
      </View>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Hide the native header**

Edit `src/navigation/MainNavigator.tsx`:

```tsx
<Stack.Screen name="ExpenseList" component={ExpenseListScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit
npx jest __tests__ --testPathIgnorePatterns=firestore.rules
git add src/navigation/ExpenseListScreen.tsx src/navigation/MainNavigator.tsx
git commit -m "feat: reskin the Expense list screen"
```

---

### Task 4: Reskin the Weight log screen

**Files:**
- Modify: `src/navigation/WeightLogScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`

**Interfaces:**
- Consumes: `RecordListHeader` (Task 1); `WeightTrendChart`'s light/dark override props (Part A, already supports `color`/`labelColor`/`valueLabelColor`/`selectedBarColor`).

Per this plan's Global Constraints, this screen keeps its existing structure (chart + inline add-weight form) — no new entries list is added.

- [ ] **Step 1: Reskin `WeightLogScreen.tsx`**

Replace the full file with:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs, createWeightLog } from '../pets/weightLogService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { WeightTrendChart } from '../pets/WeightTrendChart';
import { DateField } from '../components/DateField';
import { ScreenContainer, RecordListHeader, TextField, Button, ErrorText, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function WeightLogScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToWeightLogs(firestore, household.id, petId, setLogs);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const handleAdd = async () => {
    if (!household) return;
    setError(null);
    const parsed = parseFloat(weight);
    if (isNaN(parsed)) {
      setError('Enter a valid weight');
      return;
    }
    setLoading(true);
    try {
      await createWeightLog(firestore, household.id, petId, date, parsed);
      setWeight('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const color = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer scroll background={shell.bg} style={{ padding: 0 }}>
      <RecordListHeader
        title="Weight"
        subtitle={`${pet?.name ?? 'Pet'} · ${logs.length} ${logs.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {logs.length === 0 ? (
          <GuidedEmptyState
            emoji="⚖️"
            title="No weight logged yet"
            message="Track your pet's weight to spot health changes early."
            actionLabel="Log weight"
            onAction={() => {}}
          />
        ) : (
          <View style={{ borderRadius: 22, backgroundColor: shell.card, padding: 16 }}>
            <WeightTrendChart
              logs={logs}
              color={color}
              labelColor={text.secondary}
              valueLabelColor={text.primary}
              selectedBarColor={color}
            />
          </View>
        )}
        <TextField label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <DateField label="Date" value={date} onChange={setDate} />
        {error && <ErrorText>{error}</ErrorText>}
        <Button title="Log weight" onPress={handleAdd} loading={loading} variant="accent" />
      </View>
    </ScreenContainer>
  );
}
```

`TextField`/`DateField`/`ErrorText` are still light-styled components not reskinned by this plan (they weren't reskinned for the wizard's own text fields either — the wizard built its own `WizardTextField` instead of modifying the shared one). Leaving them as-is here matches that precedent: this screen's chart/header/button go dark, the two input controls keep their current appearance. Flag this in the task report as a known visual seam rather than silently "fixing" it beyond this plan's scope — an all-dark input treatment for this one screen isn't in the README's spec for this area and isn't worth a new component just for this.

- [ ] **Step 2: Hide the native header**

Edit `src/navigation/MainNavigator.tsx`:

```tsx
<Stack.Screen name="WeightLog" component={WeightLogScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit
npx jest __tests__ --testPathIgnorePatterns=firestore.rules
git add src/navigation/WeightLogScreen.tsx src/navigation/MainNavigator.tsx
git commit -m "feat: reskin the Weight log screen"
```

---

### Task 5: Reskin `EntryCard`, add Not-done / Bring-back states

**Files:**
- Modify: `src/calendar/EntryCard.tsx`
- Test: `__tests__/EntryCard.test.tsx` (new, if a React Native Testing Library pattern already exists in this repo — otherwise skip a render test and say why in the report, matching Task 1's Step 5 guidance)

**Interfaces:**
- Consumes: `Button`'s new colour-override props (Task 1); `onPetColorInk` (Part A).
- Produces: `EntryCard`'s prop shape changes — `onDone` becomes a **toggle** callback also called to undo completion (parent decides the resulting status, `EntryCard` just calls the same callback either way and shows "Not done" instead of "Done" once `entry.completed` is true); `onSkip` similarly becomes a toggle, showing "Bring back" once `entry.skipped` is true. This is a **behavioural addition the README explicitly calls for** (§5 point 7's "Not done (undo)" / "Bring back once skipped"), not a visual-only change — flagged here because Task 7/8 (which wire the actual toggle logic) depend on this exact contract.

- [ ] **Step 1: Reskin and extend `EntryCard.tsx`**

Replace the full file with:

```tsx
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { CalendarEntry } from './calendarEntries';
import { EVENT_TYPE_EMOJI } from './eventTypes';
import { ReminderType } from '../reminders/computeUpcoming';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { Button } from '../components/ui';
import { colors, shell, text, spacing } from '../theme/theme';

const REMINDER_EMOJI: Record<ReminderType, string> = {
  vaccine: '💉',
  medication: '💊',
  vetVisitFollowUp: '🩺',
};

interface EntryCardProps {
  entry: CalendarEntry;
  pets: Pet[];
  // For a reminder: marks it done (reminders have no undo — see
  // reminderActions.ts, clearing the underlying due date makes the
  // reminder disappear entirely, so there is no "Not done" state for
  // these). For an event: toggles completed <-> upcoming: the parent
  // decides the resulting status, this component just relabels the
  // button ("Done" vs "Not done") from entry.completed.
  onDone?: () => void;
  // Toggles skipped <-> upcoming for an event, or performs the
  // one-directional skip for a reminder (see onDone's note — reminders
  // have no reverse). Relabelled ("Skip" vs "Bring back") from
  // entry.skipped.
  onSkip: () => void;
  onEdit?: () => void;
}

export function EntryCard({ entry, pets, onDone, onSkip, onEdit }: EntryCardProps) {
  const emoji = entry.event ? EVENT_TYPE_EMOJI[entry.event.type] : entry.reminder ? REMINDER_EMOJI[entry.reminder.type] : '📌';
  const entryPets = pets.filter((p) => entry.petIds.includes(p.id));
  const rail = entryPets.length > 0 ? petColor(entryPets[0]) : shell.control;

  return (
    <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden', opacity: entry.completed || entry.skipped ? 0.65 : 1 }}>
      <View style={{ width: 5, backgroundColor: rail }} />
      <View style={{ flex: 1, padding: 14, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {entry.source === 'event' && (
            <Pressable
              onPress={onDone}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: entry.completed }}
              accessibilityLabel={entry.completed ? 'Mark as not done' : 'Mark as done'}
              hitSlop={8}
              style={{
                width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                borderColor: entry.completed ? colors.success : 'rgba(255,255,255,0.35)',
                backgroundColor: entry.completed ? colors.success : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {entry.completed && <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>✓</Text>}
            </Pressable>
          )}
          <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary, textDecorationLine: entry.completed ? 'line-through' : 'none', flexShrink: 1 }}>
            {emoji} {entry.label}
          </Text>
          {entry.overdue && <StatusBadge label="Overdue" color="#DC2626" />}
          {entry.completed && <StatusBadge label="Done" color="#059669" />}
          {entry.skipped && <StatusBadge label="Skipped" color="rgba(255,255,255,0.2)" />}
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: entry.overdue ? '#FCA5A5' : text.secondary }}>
          {new Date(entry.date).toLocaleDateString()}
        </Text>
        {entryPets.length > 0 && (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}
            accessible
            accessibilityLabel={`For ${entryPets.map((p) => p.name).join(', ')}`}
          >
            {entryPets.map((pet) => (
              <View key={pet.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: petColor(pet) }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>{pet.name}</Text>
              </View>
            ))}
          </View>
        )}
        {entry.source === 'reminder' ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Button title="Done" variant="accent" onPress={onDone} style={{ flex: 1 }} />
            <Button
              title="Skip"
              variant="outline"
              borderColor="rgba(255,255,255,0.25)"
              textColor={text.primary}
              onPress={onSkip}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Button
              title={entry.completed ? 'Not done' : 'Mark done'}
              variant={entry.completed ? 'outline' : 'accent'}
              borderColor={entry.completed ? 'rgba(255,255,255,0.25)' : undefined}
              textColor={entry.completed ? text.primary : undefined}
              onPress={onDone}
              style={{ flex: 1 }}
            />
            <Button
              title={entry.skipped ? 'Bring back' : 'Skip'}
              variant="outline"
              borderColor="rgba(255,255,255,0.25)"
              textColor={text.primary}
              onPress={onSkip}
              style={{ flex: 1 }}
            />
            <Button
              title="Edit"
              variant="outline"
              borderColor="rgba(255,255,255,0.25)"
              textColor={text.primary}
              onPress={onEdit}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 10 }}>{label}</Text>
    </View>
  );
}
```

Note the event action row now has 3 buttons (Mark done/Not done, Skip/Bring back, Edit) where the README's interaction table implies 2 primary + 1 secondary — kept all 3 since dropping Edit would remove existing, working functionality (`onEdit`) with no replacement path, which this plan's "no navigation/logic removal" discipline doesn't allow. If 3 buttons visually crowd on a real device (the same failure class Plan 6's device pass found once with reminder cards), that's a Task 9 on-device finding to fix then — flag it in this task's report as a specific thing to watch for, don't preemptively redesign around an untested guess.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

This will show errors in `CalendarScreen.tsx`/`DayDetailScreen.tsx` if their existing `onDone`/`onSkip` handlers don't match the (unchanged in shape, just now-toggling-in-effect) prop types — they still won't, since those screens aren't updated until Tasks 7–8. That's expected; those two files still typecheck today because `onDone`/`onSkip` signatures (`() => void`) didn't actually change, only their calling convention's meaning did. Confirm no new type errors appear; if any do, they indicate a real prop-shape mismatch to fix in this task, not to defer.

- [ ] **Step 3: Commit**

```bash
git add src/calendar/EntryCard.tsx
git commit -m "feat: reskin EntryCard, add Not-done and Bring-back toggle states"
```

---

### Task 6: Extend `daysWithEntries`, reskin `WeekView` and `MonthView`

**Files:**
- Modify: `src/calendar/calendarEntries.ts`
- Modify: `__tests__/calendarEntries.test.ts`
- Modify: `src/calendar/WeekView.tsx`
- Modify: `src/calendar/MonthView.tsx`

**Interfaces:**
- Produces: `daysWithEntries(entries, rangeStart, rangeEndExclusive): Map<number, string[]>` (was `number[]`) — day-start timestamp → the deduped pet ids with an entry that day, in first-seen order. Only consumers are `WeekView.tsx`, `MonthView.tsx`, and this file's own test (confirmed via repo-wide search before this task was written — do not assume, re-check with a search if anything looks off).

- [ ] **Step 1: Extend `daysWithEntries`**

In `src/calendar/calendarEntries.ts`, replace the existing `daysWithEntries` function:

```ts
export function daysWithEntries(entries: CalendarEntry[], rangeStart: number, rangeEndExclusive: number): Map<number, string[]> {
  const days = new Map<number, string[]>();
  for (const e of entries) {
    if (e.date < rangeStart || e.date >= rangeEndExclusive) continue;
    const day = startOfDay(e.date);
    const existing = days.get(day) ?? [];
    for (const petId of e.petIds) {
      if (!existing.includes(petId)) existing.push(petId);
    }
    days.set(day, existing);
  }
  return days;
}
```

- [ ] **Step 2: Update its test**

In `__tests__/calendarEntries.test.ts`, find the `describe('daysWithEntries', ...)` block and update both assertions to check the Map's keys instead of an array:

```ts
expect(Array.from(daysWithEntries(entries, day1, day3 + DAY_MS).keys()).sort((a, b) => a - b)).toEqual([day1, day3]);
```
```ts
expect(Array.from(daysWithEntries(entries, inRange, inRange + DAY_MS).keys())).toEqual([inRange]);
```

Read the full existing test block first (`__tests__/calendarEntries.test.ts`, search for `describe('daysWithEntries'`) to match its exact existing variable names (`entries`, `day1`, `day3`, `DAY_MS`, `inRange`) — the two snippets above show the assertion changes only, not the whole block; keep every other line (the `entries` array setup, `it(...)` titles) exactly as it already is. Add one new test case confirming multi-pet dedup, e.g. two entries on the same day for two different pets returns both pet ids, and two entries on the same day for the *same* pet returns that id only once:

```ts
it('deduplicates and collects distinct pet ids per day', () => {
  const day = 1_700_000_000_000;
  const entries = [
    makeEntry({ date: day, petIds: ['pet-1'] }),
    makeEntry({ date: day, petIds: ['pet-2'] }),
    makeEntry({ date: day, petIds: ['pet-1'] }),
  ];
  const result = daysWithEntries(entries, day, day + DAY_MS);
  expect(result.get(day)).toEqual(['pet-1', 'pet-2']);
});
```

Use whatever entry-construction helper (`makeEntry`, a literal object, etc.) the existing tests in this file already use — check the top of the file for it rather than inventing a new one.

- [ ] **Step 3: Reskin `WeekView.tsx` with multi-pet dots**

Replace the full file with:

```tsx
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { CalendarEntry, daysWithEntries, addDays } from './calendarEntries';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { shell, text, spacing } from '../theme/theme';

interface WeekViewProps {
  weekStart: number;
  selectedDate: number;
  entries: CalendarEntry[];
  pets: Pet[];
  onSelectDate: (day: number) => void;
}

const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function WeekView({ weekStart, selectedDate, entries, pets, onSelectDate }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayPetMap = daysWithEntries(entries, weekStart, addDays(weekStart, 7));
  const today = TODAY();

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map((day, i) => {
        const isSelected = day === selectedDate;
        const isToday = day === today;
        const dotPetIds = (dayPetMap.get(day) ?? []).slice(0, 3);
        return (
          <Pressable
            key={day}
            onPress={() => onSelectDate(day)}
            accessibilityRole="button"
            accessibilityLabel={new Date(day).toDateString()}
            style={{
              flex: 1, minHeight: 72, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 2, paddingBottom: 8,
              alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: isSelected ? '#FFFFFF' : shell.card,
              borderWidth: isToday && !isSelected ? 1.5 : 0,
              borderColor: 'rgba(255,255,255,0.45)',
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: isSelected ? shell.bg : text.faint }}>
              {WEEKDAY_LABELS[i]}
            </Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: isSelected ? shell.bg : text.primary }}>
              {new Date(day).getDate()}
            </Text>
            <View style={{ flexDirection: 'row', gap: 3, minHeight: 6 }}>
              {dotPetIds.map((petId) => {
                const pet = pets.find((p) => p.id === petId);
                return (
                  <View
                    key={petId}
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pet ? petColor(pet) : text.faint }}
                  />
                );
              })}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: Reskin `MonthView.tsx` with multi-pet dots**

Replace the full file with:

```tsx
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { CalendarEntry, daysWithEntries, startOfWeek, addDays } from './calendarEntries';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { shell, text, spacing } from '../theme/theme';

const GRID_DAYS = 42; // 6 weeks — keeps the grid a fixed height across every month
const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

interface MonthViewProps {
  monthStart: number;
  selectedDate: number;
  entries: CalendarEntry[];
  pets: Pet[];
  onSelectDate: (day: number) => void;
}

export function MonthView({ monthStart, selectedDate, entries, pets, onSelectDate }: MonthViewProps) {
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: GRID_DAYS }, (_, i) => addDays(gridStart, i));
  const dayPetMap = daysWithEntries(entries, gridStart, addDays(gridStart, GRID_DAYS));
  const monthIndex = new Date(monthStart).getMonth();
  const today = TODAY();

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)' }}>
            {label}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((day) => {
          const inMonth = new Date(day).getMonth() === monthIndex;
          const isSelected = day === selectedDate;
          const isToday = day === today;
          const dotPetIds = (dayPetMap.get(day) ?? []).slice(0, 3);
          return (
            <Pressable
              key={day}
              onPress={() => onSelectDate(day)}
              accessibilityRole="button"
              accessibilityLabel={new Date(day).toDateString()}
              style={{
                width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 2,
              }}
            >
              <View
                style={{
                  width: '100%', height: '100%', minHeight: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 3,
                  backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                  borderWidth: isToday && !isSelected ? 1.5 : 0,
                  borderColor: 'rgba(255,255,255,0.45)',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', opacity: inMonth ? 1 : 0.3, color: isSelected ? shell.bg : text.primary }}>
                  {new Date(day).getDate()}
                </Text>
                <View style={{ flexDirection: 'row', gap: 2, minHeight: 5 }}>
                  {dotPetIds.map((petId) => {
                    const pet = pets.find((p) => p.id === petId);
                    return (
                      <View
                        key={petId}
                        style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: pet ? petColor(pet) : text.faint }}
                      />
                    );
                  })}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

Both components now take a new required `pets: Pet[]` prop (needed to resolve a pet id to its identity colour) — Task 7 updates `CalendarScreen.tsx`'s two call sites to pass it (it already has `pets` in scope).

- [ ] **Step 5: Typecheck and test**

```bash
npx tsc --noEmit
```

Expect errors in `CalendarScreen.tsx` at the `<WeekView .../>` and `<MonthView .../>` call sites (missing the new required `pets` prop) — that's expected and fixed in Task 7, not this task. Confirm no *other* new type errors appear.

```bash
npx jest __tests__/calendarEntries.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/calendar/calendarEntries.ts __tests__/calendarEntries.test.ts src/calendar/WeekView.tsx src/calendar/MonthView.tsx
git commit -m "feat: multi-pet day dots in WeekView/MonthView, extend daysWithEntries"
```

---

### Task 7: Reskin `CalendarScreen`, add the shared entry-actions hook

**Files:**
- Create: `src/calendar/useCalendarEntryActions.ts`
- Modify: `src/navigation/CalendarScreen.tsx`

**Interfaces:**
- Consumes: `EntryCard`'s toggle contract (Task 5), `WeekView`/`MonthView`'s new `pets` prop (Task 6), dark `PetSelector` variant + `Chip` tinted props (Part A).
- Produces: `useCalendarEntryActions(household, user)` → `{ handleDone, handleSkip, handleToggleComplete, handleEdit, error }`, consumed by both this task and Task 8.

- [ ] **Step 1: Create the shared hook**

Create `src/calendar/useCalendarEntryActions.ts`:

```ts
import { useState } from 'react';
import { markDone, skip } from '../reminders/reminderActions';
import { updateEvent } from '../calendar/eventService';
import { CalendarEntry } from './calendarEntries';
import { firestore } from '../firebase/config';
import type { Household } from '../types/household';

// Extracted from CalendarScreen and DayDetailScreen, which previously
// duplicated this exact set of handlers verbatim. Pulled out now because
// this plan adds a new "toggle skip" path (Bring back) to both screens —
// writing it once and sharing avoids the same new logic being written
// twice and drifting apart, the same risk the duplication already carried
// for the pre-existing handlers (flagged as a known gap in CLAUDE.md).
export function useCalendarEntryActions(household: Household | null, userId: string | null, navigation: any) {
  const [error, setError] = useState<string | null>(null);

  const handleDone = async (entry: CalendarEntry) => {
    if (!household) return;
    setError(null);
    try {
      if (entry.reminder) {
        if (!userId) return;
        await markDone(firestore, household.id, entry.reminder, userId);
      } else if (entry.event) {
        await updateEvent(firestore, household.id, entry.event.id, { status: entry.completed ? 'upcoming' : 'completed' });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSkip = async (entry: CalendarEntry) => {
    if (!household) return;
    setError(null);
    try {
      if (entry.reminder) {
        if (!userId) return;
        await skip(firestore, household.id, entry.reminder, userId);
      } else if (entry.event) {
        await updateEvent(firestore, household.id, entry.event.id, { status: entry.skipped ? 'upcoming' : 'skipped' });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (entry: CalendarEntry) => {
    if (!entry.event) return;
    navigation.navigate('EditEvent', { eventId: entry.event.id });
  };

  return { handleDone, handleSkip, handleEdit, error };
}
```

Note `handleDone` folds in what was previously a separate `handleToggleComplete` — `EntryCard`'s completion checkbox and its "Mark done"/"Not done" button both call the same `onDone` prop (Task 5 already wired the checkbox to `onDone` directly, with no separate `onToggleComplete` prop), so this hook only needs to expose one handler for both.

- [ ] **Step 2: Reskin `CalendarScreen.tsx`**

Replace the full file with:

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { useNotificationPermission } from '../reminders/useNotificationPermission';
import { getSnoozes, isSnoozed } from '../reminders/snoozeStore';
import { useCalendarEvents } from '../calendar/useCalendarEvents';
import {
  mergeCalendarEntries, entriesForDay, entriesForPet, overdueEntries,
  startOfWeek, startOfMonth, addDays, CalendarEntry,
} from '../calendar/calendarEntries';
import { startOfDay } from '../reminders/computeUpcoming';
import { useCalendarEntryActions } from '../calendar/useCalendarEntryActions';
import { EntryCard } from '../calendar/EntryCard';
import { WeekView } from '../calendar/WeekView';
import { MonthView } from '../calendar/MonthView';
import { usePetSelection } from '../selection/PetSelectionContext';
import { Pet } from '../types/pet';
import {
  ScreenContainer, Chip, PermissionBar, PetSelector, GuidedEmptyState, ErrorText,
} from '../components/ui';
import { shell, text, accentLavender, spacing } from '../theme/theme';

type ViewMode = 'week' | 'month' | 'overdue';

function shiftMonth(date: number, delta: number): number {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return startOfMonth(d.getTime());
}

export function CalendarScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { granted, request } = useNotificationPermission();
  const { selectedPetId } = usePetSelection();
  const insets = useSafeAreaInsets();
  const [pets, setPets] = useState<Pet[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(startOfDay(Date.now()));
  const { handleDone, handleSkip, handleEdit, error } = useCalendarEntryActions(household, user?.uid ?? null, navigation);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    getSnoozes().then(setSnoozes);
  }, []);

  const reminders = useUpcomingReminders(pets);
  const events = useCalendarEvents();
  const now = Date.now();

  const allEntries = mergeCalendarEntries(reminders, events, now)
    .filter((e) => e.reminder == null || !isSnoozed(snoozes, e.reminder.id, now));
  const petFilteredEntries = entriesForPet(allEntries, selectedPetId);

  const handlePrev = () => {
    setSelectedDate((prev) => (viewMode === 'month' ? shiftMonth(prev, -1) : addDays(prev, -7)));
  };

  const handleNext = () => {
    setSelectedDate((prev) => (viewMode === 'month' ? shiftMonth(prev, 1) : addDays(prev, 7)));
  };

  const handleToday = () => setSelectedDate(startOfDay(Date.now()));

  const renderEntry = ({ item }: { item: CalendarEntry }) => (
    <EntryCard
      entry={item}
      pets={pets}
      onDone={() => handleDone(item)}
      onSkip={() => handleSkip(item)}
      onEdit={item.source === 'event' ? () => handleEdit(item) : undefined}
    />
  );

  const overdueList = overdueEntries(petFilteredEntries);
  const dayList = entriesForDay(petFilteredEntries, selectedDate);
  const listData = viewMode === 'overdue' ? overdueList : dayList;

  const rangeLabel =
    viewMode === 'month'
      ? new Date(selectedDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `${new Date(startOfWeek(selectedDate)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${new Date(addDays(startOfWeek(selectedDate), 6)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  const agendaHeading = viewMode === 'overdue'
    ? 'Overdue'
    : new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const agendaCount = listData.length;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <FlatList
        style={{ flex: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.md, gap: spacing.md, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: accentLavender }}>
                  Everything, one place
                </Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: text.primary }}>Calendar</Text>
              </View>
              <Chip
                label="⚙︎ Reminders"
                selected={false}
                onPress={() => navigation.navigate('ReminderSettings')}
                unselectedBg={shell.control}
                unselectedColor={text.primary}
              />
            </View>
            {granted === false && (
              <PermissionBar message="Reminders need notifications. Tap to enable." onPress={request} />
            )}
            {error && <ErrorText>{error}</ErrorText>}
            <PetSelector pets={pets} variant="dark" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip
                label="Week"
                selected={viewMode === 'week'}
                onPress={() => setViewMode('week')}
                selectedBg="#FFFFFF"
                selectedColor={shell.bg}
                unselectedBg="rgba(255,255,255,0.10)"
                unselectedColor="rgba(255,255,255,0.8)"
              />
              <Chip
                label="Month"
                selected={viewMode === 'month'}
                onPress={() => setViewMode('month')}
                selectedBg="#FFFFFF"
                selectedColor={shell.bg}
                unselectedBg="rgba(255,255,255,0.10)"
                unselectedColor="rgba(255,255,255,0.8)"
              />
              <Chip
                label={`Overdue (${overdueList.length})`}
                selected={viewMode === 'overdue'}
                onPress={() => setViewMode('overdue')}
                selectedBg="#FFFFFF"
                selectedColor={shell.bg}
                unselectedBg="rgba(255,255,255,0.10)"
                unselectedColor="rgba(255,255,255,0.8)"
              />
            </View>
            {viewMode !== 'overdue' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Pressable44 label="‹" onPress={handlePrev} />
                <Pressable
                  onPress={handleToday}
                  accessibilityRole="button"
                  style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: text.primary }}>{rangeLabel} · Today</Text>
                </Pressable>
                <Pressable44 label="›" onPress={handleNext} />
              </View>
            )}
            {viewMode === 'week' && (
              <WeekView weekStart={startOfWeek(selectedDate)} selectedDate={selectedDate} entries={petFilteredEntries} pets={pets} onSelectDate={setSelectedDate} />
            )}
            {viewMode === 'month' && (
              <MonthView monthStart={startOfMonth(selectedDate)} selectedDate={selectedDate} entries={petFilteredEntries} pets={pets} onSelectDate={setSelectedDate} />
            )}
            <View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: text.primary }}>{agendaHeading}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                {agendaCount} thing{agendaCount === 1 ? '' : 's'} {viewMode === 'overdue' ? 'waiting' : 'on this day'}
              </Text>
            </View>
          </View>
        }
        data={listData}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm }}
        renderItem={renderEntry}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji={viewMode === 'overdue' ? '✅' : '🗓️'}
            title={viewMode === 'overdue' ? 'Nothing overdue' : 'Nothing here'}
            message={
              viewMode === 'overdue'
                ? 'Every reminder and event is on track.'
                : 'Vaccines, doses, follow-ups, and anything you log will show up here on the day they fall.'
            }
            actionLabel="Reminder settings"
            onAction={() => navigation.navigate('ReminderSettings')}
          />
        }
      />
    </ScreenContainer>
  );
}

function Pressable44({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 18, fontWeight: '800', color: text.primary }}>{label}</Text>
    </Pressable>
  );
}
```

Add the missing `Pressable` import (`View, Pressable, Text` from `react-native` — the snippet above uses `Pressable` inside `Pressable44` and the range row; add it to the top `import { FlatList, View, Text } from 'react-native';` line, making it `import { FlatList, View, Text, Pressable } from 'react-native';`).

This restores an **inline agenda list in Month mode** (README §5: "Unlike today's build, the agenda does render under the month grid — the dark rows are compact enough and the screen scrolls") by putting the whole header (including the Week/Month grid) into `ListHeaderComponent` and letting the FlatList's own `data`/`renderItem` handle the agenda for all 3 view modes uniformly, including Month — reversing Plan 6's own light-theme fix that special-cased Month mode to show a hint instead. `DayDetailScreen`/"View full day" still exists (Task 8) as a secondary full-screen agenda view, just no longer the *only* way to see a day's entries in Month mode.

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit
npx jest __tests__ --testPathIgnorePatterns=firestore.rules
git add src/calendar/useCalendarEntryActions.ts src/calendar/EntryCard.tsx src/navigation/CalendarScreen.tsx
git commit -m "feat: reskin CalendarScreen, restore inline Month agenda, add shared entry-actions hook"
```

---

### Task 8: Reskin `DayDetailScreen`

**Files:**
- Modify: `src/navigation/DayDetailScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `useCalendarEntryActions` (Task 7), `EntryCard`'s toggle contract (Task 5).

- [ ] **Step 1: Reskin `DayDetailScreen.tsx`**

Replace the full file with:

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { getSnoozes, isSnoozed } from '../reminders/snoozeStore';
import { useCalendarEvents } from '../calendar/useCalendarEvents';
import { mergeCalendarEntries, entriesForPet, entriesForDay } from '../calendar/calendarEntries';
import { useCalendarEntryActions } from '../calendar/useCalendarEntryActions';
import { EntryCard } from '../calendar/EntryCard';
import { usePetSelection } from '../selection/PetSelectionContext';
import { Pet } from '../types/pet';
import { ScreenContainer, GuidedEmptyState, ErrorText } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function DayDetailScreen({ route, navigation }: any) {
  const { date } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const { selectedPetId } = usePetSelection();
  const insets = useSafeAreaInsets();
  const [pets, setPets] = useState<Pet[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const { handleDone, handleSkip, handleEdit, error } = useCalendarEntryActions(household, user?.uid ?? null, navigation);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    getSnoozes().then(setSnoozes);
  }, []);

  const reminders = useUpcomingReminders(pets);
  const events = useCalendarEvents();
  const now = Date.now();

  const allEntries = mergeCalendarEntries(reminders, events, now)
    .filter((e) => e.reminder == null || !isSnoozed(snoozes, e.reminder.id, now));
  const petFilteredEntries = entriesForPet(allEntries, selectedPetId);
  const dayEntries = entriesForDay(petFilteredEntries, date).slice().sort((a, b) => a.date - b.date);

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm }}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 18, color: text.primary }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '800', color: text.primary }}>
          {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>
      {error && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
          <ErrorText>{error}</ErrorText>
        </View>
      )}
      <FlatList
        style={{ flex: 1 }}
        data={dayEntries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <Text style={{ width: 56, paddingTop: 16, fontSize: 12, fontWeight: '600', color: text.secondary }}>
              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={{ flex: 1 }}>
              <EntryCard
                entry={item}
                pets={pets}
                onDone={() => handleDone(item)}
                onSkip={() => handleSkip(item)}
                onEdit={item.source === 'event' ? () => handleEdit(item) : undefined}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="🗓️"
            title="Nothing this day"
            message="Vaccines, doses, follow-ups, and anything you log will show up here."
            actionLabel="Add to Calendar"
            onAction={() => navigation.navigate('AddEvent')}
          />
        }
      />
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Hide the native header**

Edit `src/navigation/RootNavigator.tsx`, change the `DayDetail` `Stack.Screen` entry from:

```tsx
<Stack.Screen
  name="DayDetail"
  component={DayDetailScreen}
  options={{ headerShown: true, title: '', headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }}
/>
```

to:

```tsx
<Stack.Screen name="DayDetail" component={DayDetailScreen} options={{ headerShown: false }} />
```

Do not touch the neighboring `EditEvent` `Stack.Screen` entry (still out of this plan's scope — Reminder Settings/EditEvent are not part of the reskin per both design docs' "Not covered" boundary... actually confirm: is `EditEventScreen` covered? Re-check the design doc — it is **not** listed in either README §3/§5 scope, so leave `EditEventScreen`'s native header exactly as it is).

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit
npx jest __tests__ --testPathIgnorePatterns=firestore.rules
git add src/navigation/DayDetailScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: reskin DayDetailScreen"
```

---

### Task 9: Final verification and docs

**Files:**
- Modify: `CLAUDE.md`, `NEXTSTEPS.md`

This task has no code changes of its own — it verifies the whole branch and updates the two permanent-reference docs. **Device verification cannot run today** (no device was reachable when this plan was written) — do not fabricate or skip this, leave it explicitly open.

- [ ] **Step 1: Full local verification**

```bash
npx tsc --noEmit
npx jest __tests__ --testPathIgnorePatterns=firestore.rules
firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"
```

All three must be clean (this plan makes no `firestore.rules` change, so the rules suite should show the same pass count as before this plan started — confirm it does, as a sanity check that nothing in this plan accidentally touched rules-relevant behavior).

- [ ] **Step 2: Dependency check**

```bash
git diff master -- package.json
```

Expect no changes — this plan adds zero new dependencies. If anything shows up here, that's a real problem to fix before proceeding, not something to wave through.

- [ ] **Step 3: Whole-branch dry read for the "no data/logic change" constraint**

Re-read every modified file's diff against `master` (`git diff master`) specifically looking for anything that changed *what* data is fetched, computed, or written (not just how it's displayed) beyond the two explicitly-sanctioned additions this plan made on purpose:
1. `daysWithEntries`'s richer return shape (Task 6) — a real, but explicitly-scoped and README-directed, logic extension.
2. `EntryCard`'s toggle-based Done/Skip and the corresponding `useCalendarEntryActions` hook (Tasks 5, 7) — a real, but explicitly-scoped and README-directed, behavior addition (undo completion/skip for events).

Anything else that looks like a data/logic change beyond these two is a plan-execution bug to flag and fix, not accept.

- [ ] **Step 4: Update `CLAUDE.md`**

Add a new paragraph after the existing "Colourful Reskin (Part A)" paragraph (in the UI/Design system section), following that paragraph's own structure and level of detail. Cover: what Part B added (record lists' shared layout, Calendar's full reskin including the restored inline Month agenda and the new Not-done/Bring-back toggle behavior), the two `daysWithEntries`/`useCalendarEntryActions` logic points from Step 3, and — once Task 9's device pass actually happens in a future session — that session should append what it found, matching how every prior plan's device-verification note was written after the fact, not before.

Update the **Status** line near the top of `CLAUDE.md` to mention this plan (mirroring how the Part A mention was added there).

- [ ] **Step 5: Update `NEXTSTEPS.md`**

Add a new top section (above the current top section) recording: what this plan built, that it's code-complete/tests-green but **not yet device-verified** (explicitly, since no device was reachable), and what a future session needs to do to close it out (drive the on-device checklist the same way every prior plan's Task 9 did — via `adb`/`uiautomator`, not just visual screenshots — then update the docs again with what it found).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md NEXTSTEPS.md
git commit -m "docs: record Colourful Reskin Part B completion, device verification still pending"
```

- [ ] **Step 7: Push**

```bash
git push -u origin colorful-reskin-b
```

Per this project's work-durability rule (CLAUDE.md), push before ending the session rather than leaving a plan's finished work only on local disk.

**Do not proceed to `superpowers:finishing-a-development-branch` / merge this branch until the on-device checklist has actually run and passed** — this plan's own Global Constraints explicitly forbid treating "code complete" as equivalent to "done" for this project. Leave the branch open, pushed, and documented as pending, exactly as Plan 7 currently sits.
