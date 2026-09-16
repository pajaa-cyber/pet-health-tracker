# Colourful Reskin, Part A — Shell, Home, Hub, Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the "onboarding through first pet" path onto the dark shell described in the design handoff: the theme foundation, tab bar/FAB/Add sheet, Pets home, Pet health hub, and the Add-Pet wizard. Part B (record-list screens + Calendar) follows once this is device-verified and merged.

**Architecture:** Extend `src/theme/theme.ts` with a new `shell`/`text` token set (additive — every existing `colors.*`/`spacing.*`/`radii.*` export is untouched, so screens outside this plan's scope keep working unchanged). Extend three existing shared primitives (`ScreenContainer`, `Chip`, `PetSelector`, `AvatarPicker`) with optional props that default to their current behavior, so every out-of-scope screen that already uses them (Vets, Household, auth, `EditPetScreen`) is unaffected. Every in-scope screen composes from those primitives plus the design handoff's exact per-screen spec.

**Tech Stack:** Same as the rest of this app (Expo prebuild/dev-client, React Native `View`/`Pressable`/`Text`/`StyleSheet`, React Navigation). No new dependency — platform-default fonts (not Google Fonts), React Native's built-in `Animated`/`LayoutAnimation` (not `react-native-reanimated`), per the design decisions below.

**Spec:** [design_handoff_colorful_reskin/README.md](../../../design_handoff_colorful_reskin/README.md) (the detailed, high-fidelity handoff — exact tokens, layout, copy, interactions) and [docs/superpowers/specs/2026-09-16-colorful-reskin-design.md](../specs/2026-09-16-colorful-reskin-design.md) (the decisions the README left open, resolved, plus scope boundaries and constraints). Read both — this plan argues from the design doc, which argues from the README.

## Global Constraints

- **No data model, Firestore service, or navigation-structure change.** Every route name, every `navigation.navigate(...)` target, every service function signature stays exactly as it is today. This is a presentation-layer change, with one narrow exception: Task 6 adds a small, purely-additive expense aggregation to `PetHomeScreen` (no new collection, no schema change — it reads the same `expenses` subcollection `ExpenseListScreen` already reads).
- **Fonts: platform default**, not Outfit/Nunito — keep every size/weight/letter-spacing from the README's typography table exactly, just on the RN default font family. No `@expo-google-fonts/*` dependency.
- **Animation: React Native's built-in `Animated` and `LayoutAnimation.easeInEaseOut()` only.** No `react-native-reanimated`. `package.json` must not gain either dependency as a result of this plan.
- **Card treatment: Tinted**, not Full colour — a neutral `shell.card` background + a pet-colour left rail + a low-opacity watermark, not a full-colour card background. This applies everywhere the README shows a pet-colour surface behind content (Home's pet cards specifically; the health hub's hero and Calendar's entry-card rail are unaffected by this choice — they're full-colour/rail by the README's own base spec, not the two-treatment card debate).
- **Every tappable target stays ≥44px tall** — several existing screens (`Chip`, in particular) use 36px. Fixed once, at the shared-component level, in Task 2.
- **Emoji stay as icons** — species (`SPECIES_EMOJI`), section (this plan's own per-screen colour+emoji table), event types. No new icon set.
- **Out of scope, do not touch:** `VetsScreen`, `HouseholdScreen`, `HouseholdSetupScreen`, `ReminderSettingsScreen`, `SignInScreen`/`SignUpScreen`, `EditPetScreen`, `DevStyleGuideScreen`. They keep reading the current light-theme tokens unchanged. Every shared-primitive extension in this plan (`ScreenContainer`, `Chip`, `PetSelector`, `AvatarPicker`) is additive with the current behavior as the default, specifically so these screens render identically to today without any change on their part.
- **`AddSheet.tsx` cross-branch note:** this branch is cut from `master` without the not-yet-merged Plan 7 (`plan-7-vets-household`), which separately adds an "Add a Vet" entry to `AddSheet.tsx`'s `ADD_ACTIONS` array. Whichever branch merges second needs a one-line reconciliation. Not this plan's problem to solve, just don't be surprised by it.
- TypeScript throughout.

---

## File Structure

```
src/
  theme/
    theme.ts                      # MODIFIED: + shell, text, accentLavender (additive)
  components/ui/
    ScreenContainer.tsx            # MODIFIED: + optional `background` prop
    Chip.tsx                       # MODIFIED: + optional colour-override props, minHeight 36->44
    PetSelector.tsx                # MODIFIED: + optional `variant: 'light' | 'dark'` prop
    AvatarPicker.tsx               # MODIFIED: + optional style-override props (border style/colour, background, caption)
  navigation/
    MainTabs.tsx                   # MODIFIED: dark tab bar, restyled FAB
    AddSheet.tsx                   # MODIFIED: dark sheet, colour-coded tiles
    HomeScreen.tsx                 # REWRITTEN: header, due strip, tinted pet cards, empty state
    PetHomeScreen.tsx              # REWRITTEN: hero, colour picker in hero, section tiles (+ Calendar tile), weight card, spend card
    AddPetScreen.tsx                # REWRITTEN: per-step tint backgrounds, inverted chips, wizard chrome
  pets/
    WeightTrendChart.tsx           # REWRITTEN: tap-to-select bars, pet-colour fill, takes a `color` prop
```

---

### Task 1: Theme tokens

**Files:**
- Modify: `src/theme/theme.ts`

**Interfaces:**
- Produces: `shell: { bg, tabBar, sheet, scrim, card, cardBorderDashed, control, onColour }`; `text: { primary, secondary, faint, onColourMuted }`; `accentLavender: string`. Every later task in this plan imports from these.

- [ ] **Step 1: Add the new token objects**

Open `src/theme/theme.ts` (read it first — you're adding to it, not replacing it; `colors`, `spacing`, `radii`, `typography`, `shadow` all stay exactly as they are). Add these new exports after the existing `shadow` export:

```typescript
// Dark-shell tokens for the colourful reskin (design_handoff_colorful_reskin/README.md).
// Additive only — every screen outside that reskin's scope (Vets, Household,
// auth, EditPetScreen) keeps reading `colors`/`spacing`/`radii`/`typography`
// exactly as before. Never read `colors.background`/`colors.text` etc. on a
// reskinned screen — use these instead.
export const shell = {
  bg: '#141122', // screen background (every reskinned screen except the wizard, which uses its own per-step tint)
  tabBar: '#1B1730',
  sheet: '#221D38', // the raised "+" add sheet
  scrim: 'rgba(13,11,22,0.60)',
  card: 'rgba(255,255,255,0.07)', // neutral card / tile / list row
  // README gives cardBorderDashed and onColour as ranges (0.18-0.22 and
  // 0.20-0.28); these are the fixed midpoint values this plan uses.
  cardBorderDashed: 'rgba(255,255,255,0.20)', // empty-state and "add" dashed borders
  control: 'rgba(255,255,255,0.12)', // icon buttons, unselected view chips, nav buttons
  onColour: 'rgba(255,255,255,0.24)', // chips/stat boxes on top of a pet-colour surface
};

export const text = {
  primary: '#FFFFFF', // titles, values
  secondary: 'rgba(255,255,255,0.55)', // meta, subtitles, counts
  faint: 'rgba(255,255,255,0.45)', // inactive tab labels, month labels
  onColourMuted: 'rgba(255,255,255,0.85)', // meta text on a colour surface
};

export const accentLavender = '#A78BFA'; // eyebrow labels, links
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors — nothing imports `shell`/`text`/`accentLavender` yet.

- [ ] **Step 3: Commit**

```bash
git add src/theme/theme.ts
git commit -m "feat: add dark-shell theme tokens for the colourful reskin"
git push
```

---

### Task 2: Shared primitive extensions — `ScreenContainer`, `Chip`

**Files:**
- Modify: `src/components/ui/ScreenContainer.tsx`
- Modify: `src/components/ui/Chip.tsx`
- Test: `__tests__/Chip.test.tsx` (new — the first component test in `src/components/ui`; there is no existing precedent for testing these, but a colour-resolution helper is easy to test in isolation and worth locking in given every later task depends on it)

**Interfaces:**
- Consumes: `shell`, `colors` (Task 1, existing).
- Produces: `ScreenContainer` gains `background?: string` (defaults to `colors.background`, unchanged for every caller that doesn't pass it). `Chip` gains `selectedBg?: string`, `selectedColor?: string`, `unselectedBg?: string`, `unselectedColor?: string` (all default to the current hardcoded values). Every later task passes `shell.bg`/tint colours to these on reskinned screens.

- [ ] **Step 1: Modify `ScreenContainer.tsx`**

Read the current file first. Add the `background` prop, applied to the *outer* background style (not the content padding, which is what `style` already reaches) — currently there is no way to override the screen's base background colour at all, which every reskinned screen needs to do.

```tsx
// src/components/ui/ScreenContainer.tsx
import React from 'react';
import { View, ScrollView, ViewProps, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/theme';

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  background?: string; // overrides the screen's base background colour (default colors.background) — the reskin passes shell.bg
}

// Most add/edit forms need `scroll` (content can exceed one screen once a
// DateField or two is added); list screens pass a FlatList as a direct
// child instead and leave scroll off, since ScrollView+FlatList nesting
// breaks FlatList's own virtualization.
export function ScreenContainer({ scroll, style, background, children, ...rest }: ScreenContainerProps) {
  const bgOverride = background ? { backgroundColor: background } : undefined;
  if (scroll) {
    return (
      <ScrollView
        style={[styles.background, bgOverride]}
        contentContainerStyle={[styles.content, style]}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.background, styles.content, bgOverride, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
});
```

- [ ] **Step 2: Modify `Chip.tsx`**

Read the current file first. Add the four optional colour-override props, and bump `minHeight` from 36 to 44 (a real accessibility fix the README calls out explicitly — this is a dimension-only change, harmless to every existing light-theme caller since it doesn't touch colour).

```tsx
// src/components/ui/Chip.tsx
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../../theme/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  selectedBg?: string;
  selectedColor?: string;
  unselectedBg?: string;
  unselectedColor?: string;
}

export function Chip({ label, selected, onPress, selectedBg, selectedColor, unselectedBg, unselectedColor }: ChipProps) {
  const bg = resolveChipBg(selected, selectedBg, unselectedBg);
  const labelColor = resolveChipColor(selected, selectedColor, unselectedColor);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

// Exported so the override logic itself — not just the rendered tree — is
// directly unit-testable without a React renderer.
export function resolveChipBg(selected: boolean, selectedBg?: string, unselectedBg?: string): string {
  return selected ? (selectedBg ?? colors.primary) : (unselectedBg ?? colors.surfaceTint);
}

export function resolveChipColor(selected: boolean, selectedColor?: string, unselectedColor?: string): string {
  return selected ? (selectedColor ?? '#FFFFFF') : (unselectedColor ?? colors.primaryDark);
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
```

- [ ] **Step 3: Write the failing test for the resolver functions**

```tsx
// __tests__/Chip.test.tsx
import { resolveChipBg, resolveChipColor } from '../src/components/ui/Chip';
import { colors } from '../src/theme/theme';

describe('Chip colour resolution', () => {
  it('uses the default primary/surfaceTint colours when no overrides are given', () => {
    expect(resolveChipBg(true)).toBe(colors.primary);
    expect(resolveChipBg(false)).toBe(colors.surfaceTint);
    expect(resolveChipColor(true)).toBe('#FFFFFF');
    expect(resolveChipColor(false)).toBe(colors.primaryDark);
  });

  it('uses the override colours when given, per selection state', () => {
    expect(resolveChipBg(true, '#111111', '#222222')).toBe('#111111');
    expect(resolveChipBg(false, '#111111', '#222222')).toBe('#222222');
    expect(resolveChipColor(true, '#333333', '#444444')).toBe('#333333');
    expect(resolveChipColor(false, '#333333', '#444444')).toBe('#444444');
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/Chip.test.tsx`
Expected: PASS, both cases.

- [ ] **Step 5: Verify the whole project still compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ScreenContainer.tsx src/components/ui/Chip.tsx __tests__/Chip.test.tsx
git commit -m "feat: extend ScreenContainer and Chip with dark-shell overrides"
git push
```

---

### Task 3: Shared primitive extensions — `PetSelector`, `AvatarPicker`

**Files:**
- Modify: `src/components/ui/PetSelector.tsx`
- Modify: `src/components/ui/AvatarPicker.tsx`

**Interfaces:**
- Consumes: `shell`, `text` (Task 1); `resolveChipBg`/`resolveChipColor` pattern is not reused here (these two components need per-property overrides, not a single selected/unselected pair) — but the same "optional prop, default = current behavior" shape applies.
- Produces: `PetSelector` gains `variant?: 'light' | 'dark'` (default `'light'`, byte-identical rendering to today). `AvatarPicker` gains `backgroundColor?`, `borderColor?`, `borderWidth?`, `borderStyle?: 'solid' | 'dashed'`, `caption?: 'default' | 'mono' | 'none'`, `captionColor?` (all default to today's exact values). Tasks 5 (Home), 6 (Hub), 7 (Wizard) consume both.

- [ ] **Step 1: Rewrite `PetSelector.tsx`**

Read the current file first. This is a full rewrite that must render byte-identically to today when `variant` is omitted or `'light'` — check that carefully against the current source before moving on.

```tsx
// src/components/ui/PetSelector.tsx
import React from 'react';
import { ScrollView, Pressable, Image, View, Text } from 'react-native';
import { Pet } from '../../types/pet';
import { usePetSelection } from '../../selection/PetSelectionContext';
import { MutedText, Subtitle } from './Typography';
import { colors, spacing, text } from '../../theme/theme';
import { petColor } from '../../theme/petColors';
import { SPECIES_EMOJI } from '../../pets/species';

interface PetSelectorProps {
  pets: Pet[];
  variant?: 'light' | 'dark';
}

export function PetSelector({ pets, variant = 'light' }: PetSelectorProps) {
  const { selectedPetId, setSelectedPetId } = usePetSelection();
  const dark = variant === 'dark';
  const avatarSize = dark ? 54 : 48;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Dark variant bleeds to the screen edges per the design handoff — the
      // screen's own 18px horizontal padding is cancelled here and re-applied
      // as content padding instead, so the strip's first/last avatar still
      // lines up flush with the edge rather than the ScrollView's own bounds.
      style={dark ? { flexGrow: 0, marginHorizontal: -18 } : { flexGrow: 0 }}
      contentContainerStyle={{
        gap: dark ? 10 : spacing.sm,
        paddingVertical: spacing.xs,
        paddingHorizontal: dark ? 18 : 0,
      }}
    >
      <Pressable
        onPress={() => setSelectedPetId('all')}
        accessibilityRole="button"
        accessibilityLabel="All Pets"
        style={{ alignItems: 'center', gap: spacing.xs }}>
        <View
          style={{
            width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
            backgroundColor: dark
              ? (selectedPetId === 'all' ? colors.primary : 'rgba(255,255,255,0.08)')
              : colors.surfaceTint,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: selectedPetId === 'all' ? 3 : 0,
            borderColor: dark ? 'rgba(255,255,255,0.85)' : colors.primary,
          }}
        >
          <Subtitle style={dark ? { color: text.primary } : undefined}>🐾</Subtitle>
        </View>
        {dark ? (
          <Text
            numberOfLines={1}
            style={{ maxWidth: 62, fontSize: 11, fontWeight: '700', color: selectedPetId === 'all' ? text.primary : 'rgba(255,255,255,0.5)' }}
          >
            All Pets
          </Text>
        ) : (
          <MutedText>All Pets</MutedText>
        )}
      </Pressable>
      {pets.map((pet) => {
        const selected = selectedPetId === pet.id;
        return (
          <Pressable
            key={pet.id}
            onPress={() => setSelectedPetId(pet.id)}
            accessibilityRole="button"
            accessibilityLabel={pet.name}
            style={{ alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{
                width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: 'hidden',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: dark
                  ? (selected ? petColor(pet) : 'rgba(255,255,255,0.08)')
                  : colors.surfaceTint,
                borderWidth: dark ? (selected ? 3 : 0) : 3,
                borderColor: dark ? 'rgba(255,255,255,0.85)' : (selected ? petColor(pet) : 'transparent'),
              }}
            >
              {pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} style={{ width: avatarSize, height: avatarSize }} resizeMode="cover" />
              ) : (
                <Subtitle style={dark ? { color: text.primary } : undefined}>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Subtitle>
              )}
            </View>
            {dark ? (
              <Text
                numberOfLines={1}
                style={{ maxWidth: 62, fontSize: 11, fontWeight: '700', color: selected ? text.primary : 'rgba(255,255,255,0.5)' }}
              >
                {pet.name}
              </Text>
            ) : (
              <MutedText numberOfLines={1} style={{ maxWidth: 64 }}>{pet.name}</MutedText>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Rewrite `AvatarPicker.tsx`**

Read the current file first. Same rule — default props must render byte-identically to today.

```tsx
// src/components/ui/AvatarPicker.tsx
import React, { useState } from 'react';
import { Pressable, Image, View, Text, ActivityIndicator, Alert } from 'react-native';
import { pickAndProcessImage, ImageSource } from '../../pets/imageUpload';
import { colors } from '../../theme/theme';

interface AvatarPickerProps {
  photoUri: string | null;
  onPicked: (dataUri: string) => void;
  size?: number;
  fallbackEmoji?: string;
  emojiSize?: number; // default size * 0.4 (today's behavior) — the wizard passes an explicit smaller size on its larger 116px circle
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  // 'default': "Add/Change photo", 12px, captionColor (default colors.primary).
  // 'mono': "ADD/CHANGE PHOTO", uppercase, monospace, 9px, letter-spacing 1 —
  // the wizard's step-0 treatment. 'none': no caption at all — the hub's
  // hero avatar, which has its own "Mark remembered" affordance nearby and
  // doesn't need a second line of text under the avatar.
  caption?: 'default' | 'mono' | 'none';
  captionColor?: string;
}

export function AvatarPicker({
  photoUri, onPicked, size = 96, fallbackEmoji = '🐾', emojiSize,
  backgroundColor = colors.surfaceTint, borderColor = colors.primaryLight, borderWidth = 2, borderStyle = 'solid',
  caption = 'default', captionColor = colors.primary,
}: AvatarPickerProps) {
  const [busy, setBusy] = useState(false);

  const handlePick = async (source: ImageSource) => {
    setBusy(true);
    try {
      const dataUri = await pickAndProcessImage(source);
      if (dataUri) onPicked(dataUri);
    } catch (e: any) {
      Alert.alert('Could not set photo', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePress = () => {
    Alert.alert('Pet photo', undefined, [
      { text: 'Take Photo', onPress: () => handlePick('camera') },
      { text: 'Choose from Library', onPress: () => handlePick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable onPress={handlePress} disabled={busy} style={{ alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth,
          borderColor,
          borderStyle,
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: emojiSize ?? size * 0.4 }}>{fallbackEmoji}</Text>
        )}
      </View>
      {caption === 'default' && (
        <Text style={{ fontSize: 12, color: captionColor, marginTop: 4, fontWeight: '600' }}>
          {photoUri ? 'Change photo' : 'Add photo'}
        </Text>
      )}
      {caption === 'mono' && (
        <Text style={{ fontSize: 9, color: captionColor, marginTop: 6, fontWeight: '700', letterSpacing: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}>
          {photoUri ? 'Change photo' : 'Add photo'}
        </Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manually diff against the previous behavior**

Read `EditPetScreen.tsx` and confirm it calls `<AvatarPicker photoUri={...} onPicked={...} />` with no other props (i.e. it will get every default) — if it passes anything beyond `photoUri`/`onPicked`/`fallbackEmoji`, double-check those still map onto the same defaults. Do not modify `EditPetScreen.tsx` in this task.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PetSelector.tsx src/components/ui/AvatarPicker.tsx
git commit -m "feat: add a dark variant to PetSelector and style overrides to AvatarPicker"
git push
```

---

### Task 4: Tab bar, FAB, and Add sheet

**Files:**
- Modify: `src/navigation/MainTabs.tsx`
- Modify: `src/navigation/AddSheet.tsx`

**Interfaces:**
- Consumes: `shell`, `text`, `colors` (Task 1, existing).
- Produces: no new exports — these are leaf screens/components other tasks don't import from.

**Ruling on a spec conflict:** the README's tab-bar section calls for plain emoji icons (🐾📅🩺👪). This codebase's tab bar has used `@expo/vector-icons`'s `Ionicons` instead of emoji since Plan 3, specifically because — per `CLAUDE.md`'s "UI/Design system" section — "the bottom tab bar and its raised '+' button... are the app's primary navigation controls" and emoji are "decorative, not tap targets a screen reader needs to announce meaningfully." The README's own rationale for emoji ("that is what the current code does") is factually describing a state this codebase deliberately moved away from. **This plan keeps `Ionicons`**, recoloured to the new dark-shell palette, rather than reverting a considered accessibility decision. Everywhere else the README calls for emoji (species, section, event-type icons — all genuinely decorative), it's followed exactly.

- [ ] **Step 1: Rewrite `MainTabs.tsx`**

Read the current file first — icon choices (`paw`/`calendar`/`medkit`/`people`), the `AddTab` empty-slot mechanism, and `petsTabBarStyle`'s route-name check are all unchanged; only colours/sizes change.

```tsx
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
import { colors, shell, text } from '../theme/theme';

const Tab = createBottomTabNavigator();

// Only the Pets tab has a nested stack with sub-screens the tab bar should
// hide behind. Its root route is named 'PetList' — anything else focused
// means we've pushed deeper and the tab bar should disappear.
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
          top: -16, alignSelf: 'center', width: 60, height: 60, borderRadius: 30,
          backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 24, elevation: 10,
        }}
        accessibilityRole="button"
        accessibilityLabel="Add"
      >
        <Ionicons name="add" size={30} color={colors.accentText} />
      </Pressable>
      <AddSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

const BASE_TAB_BAR_STYLE = { backgroundColor: shell.tabBar, borderTopColor: 'rgba(255,255,255,0.08)', borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10, height: 64 };

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: text.primary,
        tabBarInactiveTintColor: text.faint,
        tabBarStyle: BASE_TAB_BAR_STYLE,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 10 },
      }}
    >
      <Tab.Screen
        name="PetsTab"
        component={MainNavigator}
        options={({ route }) => ({
          title: 'Pets',
          tabBarStyle: [BASE_TAB_BAR_STYLE, petsTabBarStyle(route)],
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

Note: `VetsTab`/`HouseholdTab` screens themselves are unchanged (out of scope) — only the tab *bar itself* (background, active/inactive colours) changes, which is shared chrome, not those screens' own content.

- [ ] **Step 2: Rewrite `AddSheet.tsx`**

Read the current file first — `ADD_ACTIONS`' routing rules (`needsPet`, `topLevel`) and `handlePress`'s cross-tab navigation are unchanged; only presentation changes, plus a new pets subscription to resolve the context line's pet name.

```tsx
// src/navigation/AddSheet.tsx
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View, FlatList, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePetSelection } from '../selection/PetSelectionContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { spacing, shell, text } from '../theme/theme';

interface AddAction {
  label: string;
  emoji: string;
  color: string;
  route: string;
  needsPet: boolean;
  topLevel?: boolean;
}

const ADD_ACTIONS: AddAction[] = [
  { label: 'Add a Pet', emoji: '🐾', color: '#7C3AED', route: 'AddPet', needsPet: false },
  { label: 'Add a Vaccine', emoji: '💉', color: '#EF4444', route: 'AddVaccine', needsPet: true },
  { label: 'Add a Medication', emoji: '💊', color: '#3B82F6', route: 'AddMedication', needsPet: true },
  { label: 'Log a Weight', emoji: '⚖️', color: '#84CC16', route: 'WeightLog', needsPet: true },
  { label: 'Add a Vet Visit', emoji: '🩺', color: '#14B8A6', route: 'AddVetVisit', needsPet: true },
  { label: 'Add an Expense', emoji: '💰', color: '#F97316', route: 'AddExpense', needsPet: true },
  { label: 'Add to Calendar', emoji: '📅', color: '#EC4899', route: 'AddEvent', needsPet: false, topLevel: true },
];

export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const { selectedPetId } = usePetSelection();
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  const selectedPet = selectedPetId === 'all' ? null : pets.find((p) => p.id === selectedPetId) ?? null;

  const handlePress = (action: AddAction) => {
    onClose();
    if (action.topLevel) {
      navigation.navigate(action.route);
      return;
    }
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
      <Pressable style={{ flex: 1, backgroundColor: shell.scrim, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: shell.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14, gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: text.primary }}>What are we adding?</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 16, color: text.primary, fontWeight: '700' }}>×</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
            {selectedPet ? `Adding to ${selectedPet.name}.` : 'No pet selected — we will ask which one.'}
          </Text>
          <FlatList
            data={ADD_ACTIONS}
            numColumns={2}
            keyExtractor={(a) => a.route}
            scrollEnabled={false}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handlePress(item)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={{
                  flex: 1, minHeight: 88, borderRadius: 18, padding: 13, justifyContent: 'flex-end',
                  backgroundColor: item.color + '26', // ~15% alpha tint, consistent with the section-tile treatment (Task 6)
                }}
              >
                <Text style={{ fontSize: 21, marginBottom: 6 }}>{item.emoji}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', lineHeight: 17, color: text.primary }}>{item.label}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

The Modal's own `animationType="slide"` already provides the "slides up from translateY(100%)" behaviour the README asks for — no `Animated`/`LayoutAnimation` code needed for this specific transition.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/MainTabs.tsx src/navigation/AddSheet.tsx
git commit -m "feat: reskin the tab bar, FAB, and Add sheet onto the dark shell"
git push
```

---

### Task 5: Pets home screen

**Files:**
- Modify: `src/navigation/HomeScreen.tsx`

**Interfaces:**
- Consumes: `shell`, `text`, `accentLavender` (Task 1); `PetSelector` with `variant="dark"` (Task 3); `useUpcomingReminders(pets): UpcomingReminder[]` (existing, `src/reminders/useUpcomingReminders.ts` — do not re-derive this, it already fans out per-pet listeners correctly for a dynamic pet list); `subscribeToExpenses` (existing, `src/pets/expenseService.ts`); `subscribeToWeightLogs` (existing).

**A note on data flow, since this screen touches five different record collections:** `useUpcomingReminders(pets)` is used once, at the screen level, to drive the due strip and each card's due pill — it already fans out per-pet vaccine/medication/vet-visit listeners internally. Each `PetCard` additionally subscribes to its own vaccines/medications/vet-visits (for the "Records" stat's count) and, new in this task, weight logs and expenses (for the "Weight"/"Spend" stats). This means vaccine/medication/vet-visit data is fetched twice — once by the shared hook, once per visible card. That overlap already exists in today's `HomeScreen` (the hook is new; the per-card subscriptions for the due pill are not) and matches a known, already-logged gap in this codebase (`CLAUDE.md`'s "listener fan-out duplicated across components... worth hoisting into a shared provider whenever it next causes a real problem") — not something this presentation-layer plan should take on.

- [ ] **Step 1: Rewrite `HomeScreen.tsx`**

Read the current file first — `reconcileSelection`, `activePets`, and the `PetCard`→`PetHome` navigation are unchanged.

```tsx
// src/navigation/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Image, View, Text, Animated } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { subscribeToWeightLogs } from '../pets/weightLogService';
import { subscribeToExpenses } from '../pets/expenseService';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { usePetSelection, reconcileSelection } from '../selection/PetSelectionContext';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';
import { WeightLog } from '../types/weightLog';
import { Expense } from '../types/expense';
import { ScreenContainer, Button, PetSelector } from '../components/ui';
import { shell, text, accentLavender, spacing, radii } from '../theme/theme';
import { petColor } from '../theme/petColors';
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';

function formatEuros(cents: number): string {
  const value = cents / 100;
  return Number.isInteger(value) ? `€${value}` : `€${value.toFixed(2)}`;
}

function daysUntil(dueDate: number): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.ceil((dueDate - Date.now()) / DAY_MS);
}

function DueStripCard({ reminder, pet }: { reminder: ReturnType<typeof useUpcomingReminders>[number]; pet: Pet }) {
  const bg = reminder.overdue ? '#DC2626' : petColor(pet);
  const n = daysUntil(reminder.dueDate);
  return (
    <View style={{ minWidth: 168, borderRadius: 18, padding: 12, paddingTop: 14, backgroundColor: bg, gap: 4 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>
        {reminder.overdue ? 'OVERDUE' : `IN ${n} DAY${n === 1 ? '' : 'S'}`}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{reminder.label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>{pet.name}</Text>
    </View>
  );
}

function PetCard({ pet, navigation, nextDue }: { pet: Pet; navigation: any; nextDue: ReturnType<typeof useUpcomingReminders>[number] | undefined }) {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [vetVisits, setVetVisits] = useState<VetVisit[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const { household } = useHousehold();
  const anim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!household) return;
    const unsubs = [
      subscribeToVaccines(firestore, household.id, pet.id, setVaccines),
      subscribeToMedications(firestore, household.id, pet.id, setMedications),
      subscribeToVetVisits(firestore, household.id, pet.id, setVetVisits),
      subscribeToWeightLogs(firestore, household.id, pet.id, setWeightLogs),
      subscribeToExpenses(firestore, household.id, pet.id, setExpenses),
    ];
    return () => unsubs.forEach((u) => u());
  }, [household, pet.id]);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [anim]);

  const recordsCount = vaccines.length + medications.length + vetVisits.length;
  const latestWeight = [...weightLogs].sort((a, b) => b.date - a.date)[0]?.weight ?? null;
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const yearSpendCents = expenses.filter((e) => e.date >= yearStart).reduce((sum, e) => sum + e.amountCents, 0);

  const color = petColor(pet);
  const overdue = nextDue?.overdue ?? false;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
        ],
      }}
    >
      <Pressable
        onPress={() => navigation.navigate('PetHome', { petId: pet.id })}
        accessibilityRole="button"
        accessibilityLabel={pet.name}>
        <View style={{ borderRadius: 26, padding: 18, backgroundColor: shell.card, borderLeftWidth: 5, borderLeftColor: color, overflow: 'hidden' }}>
          <Text style={{ position: 'absolute', right: -6, top: -14, fontSize: 104, opacity: 0.08 }}>
            {SPECIES_EMOJI[pet.species] ?? '🐾'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: shell.onColour, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 27 }}>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: text.primary }}>{pet.name}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: text.secondary }}>
                {speciesDisplay(pet)}{pet.breed ? ` · ${pet.breed}` : ''}{pet.birthDate != null ? ` · ${Math.floor((Date.now() - pet.birthDate) / (365.25 * 24 * 60 * 60 * 1000))} yr` : ''}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
            <View
              style={{
                borderRadius: radii.pill, paddingVertical: 8, paddingHorizontal: 14,
                backgroundColor: nextDue == null ? shell.onColour : overdue ? '#FFFFFF' : color,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: nextDue == null ? text.primary : overdue ? '#DC2626' : '#FFFFFF' }}>
                {nextDue == null ? '✅ Nothing due — all clear' : overdue ? `⚠️ ${nextDue.label} overdue` : `⏰ ${nextDue.label} in ${daysUntil(nextDue.dueDate)} days`}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1, borderRadius: 14, backgroundColor: shell.onColour, paddingVertical: 9, paddingHorizontal: 11, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{latestWeight != null ? `${latestWeight} kg` : '—'}</Text>
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Weight</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 14, backgroundColor: shell.onColour, paddingVertical: 9, paddingHorizontal: 11, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{recordsCount}</Text>
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Records</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 14, backgroundColor: shell.onColour, paddingVertical: 9, paddingHorizontal: 11, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{formatEuros(yearSpendCents)}</Text>
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Spend</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ borderRadius: 26, backgroundColor: shell.card, borderWidth: 2, borderColor: shell.cardBorderDashed, borderStyle: 'dashed', alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Text style={{ fontSize: 44 }}>🐾</Text>
      <Text style={{ fontSize: 19, fontWeight: '800', color: text.primary }}>No pets here yet</Text>
      <Text style={{ fontSize: 13, lineHeight: 19, color: text.secondary, textAlign: 'center', maxWidth: 220 }}>
        Add your first one and everyone in the household sees it straight away.
      </Text>
      <Button title="Add a pet" variant="accent" onPress={onAdd} style={{ borderRadius: radii.pill, minHeight: 48 }} />
    </View>
  );
}

export function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { selectedPetId, setSelectedPetId } = usePetSelection();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    reconcileSelection(selectedPetId, pets.map((p) => p.id), setSelectedPetId);
  }, [pets, selectedPetId, setSelectedPetId]);

  const visiblePets = selectedPetId === 'all' ? pets : pets.filter((p) => p.id === selectedPetId);
  const reminders = useUpcomingReminders(visiblePets);
  const firstName = (user?.email ?? 'there').split('@')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const initial = displayName.charAt(0).toUpperCase();

  const nextDueForPet = (petId: string) => reminders.find((r) => r.petId === petId);

  return (
    <ScreenContainer style={{ flex: 1, gap: spacing.md }} background={shell.bg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          {household && (
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase', color: accentLavender }}>
              {household.name.trim().toUpperCase()} HOUSEHOLD
            </Text>
          )}
          <Text style={{ fontSize: 27, fontWeight: '800', color: text.primary, lineHeight: 30 }}>Hey {displayName} 👋</Text>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{initial}</Text>
        </View>
      </View>

      {pets.length > 0 && <PetSelector pets={pets} variant="dark" />}

      {reminders.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={reminders}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => {
            const pet = visiblePets.find((p) => p.id === item.petId);
            return pet ? <DueStripCard reminder={item} pet={pet} /> : null;
          }}
        />
      )}

      <FlatList
        style={{ flex: 1 }}
        data={visiblePets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.md }}
        renderItem={({ item }) => <PetCard pet={item} navigation={navigation} nextDue={nextDueForPet(item.id)} />}
        ListEmptyComponent={<EmptyState onAdd={() => navigation.navigate('AddPet')} />}
      />
    </ScreenContainer>
  );
}
```

Worth flagging for the task reviewer, not a fix needed now: `formatEuros` and `daysUntil` are small pure helpers local to this file — if Part B's record-list screens (`ExpenseListScreen` in particular) need the same euro formatting, hoist them into a shared module then; duplicating two three-line functions once is cheaper than a premature shared-utils file.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/HomeScreen.tsx
git commit -m "feat: reskin the Pets home screen — header, due strip, tinted pet cards"
git push
```

---

### Task 6: `WeightTrendChart` — interactive bars

**Files:**
- Modify: `src/pets/WeightTrendChart.tsx`
- Modify: `src/navigation/WeightLogScreen.tsx` (its one call site, so it keeps compiling — out of this reskin's screen scope otherwise, but this one-line change is required by the interface change below)

**Interfaces:**
- Produces: `WeightTrendChart({ logs, color }: { logs: WeightLog[]; color: string })`. `color` is a new required prop — every caller must pass one. Task 7 (`PetHomeScreen`) passes `petColor(pet)`.

- [ ] **Step 1: Rewrite `WeightTrendChart.tsx`**

Read the current file first.

```tsx
// src/pets/WeightTrendChart.tsx
import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { WeightLog } from '../types/weightLog';
import { MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

const CHART_HEIGHT = 124;

export function WeightTrendChart({ logs, color }: { logs: WeightLog[]; color: string }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (logs.length === 0) {
    return <MutedText>No weight entries yet.</MutedText>;
  }

  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const weights = sorted.map((l) => l.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: spacing.xs }}>
      {sorted.map((log, i) => {
        const barHeight = 26 + ((log.weight - min) / range) * 70;
        const selected = selectedIdx === i;
        return (
          <Pressable
            key={log.id}
            onPress={() => setSelectedIdx(selected ? null : i)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
          >
            {selected && (
              <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)' }}>{log.weight} kg</Text>
            )}
            <View
              style={{
                width: '100%',
                height: barHeight,
                backgroundColor: selected ? '#FFFFFF' : color,
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
              }}
            />
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
              {new Date(log.date).toLocaleDateString(undefined, { month: 'short' })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Update `WeightLogScreen.tsx`'s call site**

Read the current file first — it's out of this plan's screen-reskin scope, so change only the one line that now needs a `color` prop, nothing else on the screen.

```tsx
<WeightTrendChart logs={logs} color={colors.primary} />
```

(`colors.primary` — `WeightLogScreen` isn't reskinned in this plan, so it keeps using the light-theme brand colour, not a pet identity colour. Its own dark-shell treatment is Part B's job.) `WeightLogScreen.tsx` currently has no import from `../theme/theme` at all — add one: `import { colors } from '../theme/theme';`.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/pets/WeightTrendChart.tsx src/navigation/WeightLogScreen.tsx
git commit -m "feat: make WeightTrendChart interactive with a pet-colour fill"
git push
```

---

### Task 7: Pet health hub

**Files:**
- Modify: `src/navigation/PetHomeScreen.tsx`

**Interfaces:**
- Consumes: `shell`, `text` (Task 1); `WeightTrendChart({ logs, color })` (Task 6); `updatePet`, `updatePetColor`, `updatePetPhoto`, `subscribeToPets` (existing, `src/pets/petService.ts`); `subscribeToVaccines`/`subscribeToMedications`/`subscribeToVetVisits`/`subscribeToExpenses` (existing).

**Scope note (the "one narrow exception" the Global Constraints mention):** today's `PetHomeScreen` only subscribes to weight logs. This task adds four more subscriptions (vaccines, medications, vet visits, expenses) so the six section tiles can show real per-category counts and the new spend card can show real per-category totals. No new collection, no schema change, no new write path — every one of these is a collection `ExpenseListScreen`/`VaccineListScreen`/etc. already reads elsewhere in the app; this task just reads the same data from a new place.

**A data-honesty note on the tag chips:** the README's copy for the neutered chip is literally "Neutered"/"Not neutered" — but `Pet.neutered` is `boolean | null`, and this codebase has an explicit standing rule (`CLAUDE.md`: "each nullable = 'don't know'/'not set', never forced to a lie"). Showing "Not neutered" for a pet whose neutered status was never actually recorded would violate that rule. This task adds a third state for `null` ("Neutering not set") rather than following the README's two-state copy literally where doing so would misrepresent unknown data as a known "no."

- [ ] **Step 1: Rewrite `PetHomeScreen.tsx`**

Read the current file first — `route.params.petId`, the `pets` subscription pattern, and the navigation targets for each section (`VaccineList`, `MedicationList`, `VetVisitList`, `WeightLog`, `ExpenseList`) are unchanged; `CalendarTab` is the one new navigation target.

```tsx
// src/navigation/PetHomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Pressable, Image, Text, FlatList } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs } from '../pets/weightLogService';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { subscribeToExpenses } from '../pets/expenseService';
import { subscribeToPets, updatePetPhoto, updatePetColor, updatePet } from '../pets/petService';
import { usePetSelection } from '../selection/PetSelectionContext';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';
import { Expense, ExpenseCategory } from '../types/expense';
import { Pet } from '../types/pet';
import { WeightTrendChart } from '../pets/WeightTrendChart';
import { ScreenContainer } from '../components/ui';
import { shell, text, spacing, colors } from '../theme/theme';
import { PET_COLORS, petColor } from '../theme/petColors';
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';

interface SectionTile {
  key: string;
  label: string;
  emoji: string;
  color: string;
  count: (data: HubData) => string;
}

interface HubData {
  vaccines: Vaccine[];
  medications: Medication[];
  vetVisits: VetVisit[];
  weightLogs: WeightLog[];
}

function recordsLabel(n: number): string {
  return `${n} record${n === 1 ? '' : 's'}`;
}

const SECTIONS: SectionTile[] = [
  { key: 'VaccineList', label: 'Vaccines', emoji: '💉', color: '#EF4444', count: (d) => recordsLabel(d.vaccines.length) },
  { key: 'MedicationList', label: 'Medications', emoji: '💊', color: '#3B82F6', count: (d) => recordsLabel(d.medications.length) },
  { key: 'VetVisitList', label: 'Vet visits', emoji: '🩺', color: '#14B8A6', count: (d) => recordsLabel(d.vetVisits.length) },
  { key: 'WeightLog', label: 'Weight', emoji: '⚖️', color: '#84CC16', count: (d) => recordsLabel(d.weightLogs.length) },
];

const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: 'Food', vet: 'Vet', grooming: 'Grooming', insurance: 'Insurance', supplies: 'Supplies', other: 'Other',
};

function formatEuros(cents: number): string {
  const value = cents / 100;
  return Number.isInteger(value) ? `€${value}` : `€${value.toFixed(2)}`;
}

function TagChip({ label }: { label: string }) {
  return (
    <View style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.24)', paddingVertical: 5, paddingHorizontal: 11 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
    </View>
  );
}

export function PetHomeScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const { setSelectedPetId } = usePetSelection();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [vetVisits, setVetVisits] = useState<VetVisit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [statusSaving, setStatusSaving] = useState(false);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    const unsubs = [
      subscribeToWeightLogs(firestore, household.id, petId, setWeightLogs),
      subscribeToVaccines(firestore, household.id, petId, setVaccines),
      subscribeToMedications(firestore, household.id, petId, setMedications),
      subscribeToVetVisits(firestore, household.id, petId, setVetVisits),
      subscribeToExpenses(firestore, household.id, petId, setExpenses),
    ];
    return () => unsubs.forEach((u) => u());
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  if (!pet || !household) {
    return (
      <ScreenContainer style={{ flex: 1 }} background={shell.bg}>
        <Text style={{ color: text.secondary }}>Loading…</Text>
      </ScreenContainer>
    );
  }

  const color = petColor(pet);
  const hubData: HubData = { vaccines, medications, vetVisits, weightLogs };
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const yearExpenses = expenses.filter((e) => e.date >= yearStart);
  const totalCents = yearExpenses.reduce((sum, e) => sum + e.amountCents, 0);
  const byCategory = (Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[])
    .map((cat) => ({ cat, cents: yearExpenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amountCents, 0) }))
    .filter((c) => c.cents > 0);

  const age = pet.birthDate != null ? Math.floor((Date.now() - pet.birthDate) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  const neuteredLabel = pet.neutered === true ? 'Neutered' : pet.neutered === false ? 'Not neutered' : 'Neutering not set';
  const isRemembered = pet.status === 'remembered';

  const toggleRemembered = async () => {
    setStatusSaving(true);
    try {
      await updatePet(firestore, household.id, petId, { status: isRemembered ? 'active' : 'remembered' });
    } finally {
      setStatusSaving(false);
    }
  };

  const openCalendarForThisPet = () => {
    setSelectedPetId(petId);
    navigation.navigate('CalendarTab');
  };

  return (
    <ScreenContainer scroll background={shell.bg} style={{ padding: 0, gap: spacing.md }}>
      <View style={{ backgroundColor: color, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 22, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' }}>
        <Text style={{ position: 'absolute', right: -16, bottom: -34, fontSize: 150, opacity: 0.2 }}>
          {SPECIES_EMOJI[pet.species] ?? '🐾'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 18, color: '#FFFFFF' }}>←</Text>
          </Pressable>
          <Pressable
            onPress={toggleRemembered}
            disabled={statusSaving}
            accessibilityRole="button"
            accessibilityLabel={isRemembered ? 'Bring back' : 'Mark remembered'}
            style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 8, paddingHorizontal: 14 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>{isRemembered ? 'Bring back' : 'Mark remembered'}</Text>
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: spacing.xs, marginTop: spacing.md }}>
          <Pressable
            onPress={() => {}}
            style={{ width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.30)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            {pet.photoUrl ? (
              <Image source={{ uri: pet.photoUrl }} style={{ width: 82, height: 82 }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 40 }}>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Text>
            )}
          </Pressable>
          <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF' }}>{pet.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' }}>
            <TagChip label={`${speciesDisplay(pet)}${age != null ? ` · ${age} yr` : ''}`} />
            <TagChip label={pet.breed || 'No breed set'} />
            <TagChip label={neuteredLabel} />
            <TagChip label={pet.livingEnvironment ? pet.livingEnvironment.charAt(0).toUpperCase() + pet.livingEnvironment.slice(1) : 'Environment not set'} />
          </View>
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
            Identity colour
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
            {PET_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => updatePetColor(firestore, household.id, petId, c)}
                accessibilityRole="button"
                accessibilityLabel={`Set colour to ${c}`}
                style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: '#FFFFFF' }}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {SECTIONS.map((s) => (
            <Pressable key={s.key} onPress={() => navigation.navigate(s.key, { petId })} style={{ width: '47%' }}>
              <View style={{ borderRadius: 20, backgroundColor: shell.card, padding: 14, minHeight: 100, justifyContent: 'flex-start', gap: spacing.xs }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: s.color + '40', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 19 }}>{s.emoji}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{s.label}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{s.count(hubData)}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable onPress={openCalendarForThisPet} style={{ width: '47%' }}>
            <View style={{ borderRadius: 20, backgroundColor: shell.card, padding: 14, minHeight: 100, justifyContent: 'flex-start', gap: spacing.xs }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: '#EC489940', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 19 }}>📅</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>Calendar</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>View this pet's calendar</Text>
            </View>
          </Pressable>
        </View>

        <View style={{ borderRadius: 22, backgroundColor: shell.card, padding: 16, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: text.primary }}>Weight trend</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color }}>
              {weightLogs.length > 0 ? `${[...weightLogs].sort((a, b) => b.date - a.date)[0].weight} kg` : 'No entries yet'}
            </Text>
          </View>
          <WeightTrendChart logs={weightLogs} color={color} />
        </View>

        <View style={{ borderRadius: 22, backgroundColor: shell.card, padding: 16, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: text.primary }}>Spend this year</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>{formatEuros(totalCents)}</Text>
          </View>
          {byCategory.length === 0 ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>No expenses logged this year.</Text>
          ) : (
            byCategory.map(({ cat, cents }) => (
              <View key={cat} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: text.primary }}>{EXPENSE_CATEGORY_LABEL[cat]}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>{formatEuros(cents)}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                  <View style={{ height: 8, borderRadius: 4, width: `${Math.min(100, (cents / totalCents) * 100)}%`, backgroundColor: color }} />
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/PetHomeScreen.tsx
git commit -m "feat: reskin the Pet health hub — hero, colour picker, tiles, weight and spend cards"
git push
```

---

### Task 8: Add-Pet wizard

**Files:**
- Modify: `src/components/ui/GracefulDateField.tsx` (small addition — see below)
- Modify: `src/navigation/AddPetScreen.tsx`

**Interfaces:**
- Consumes: `Chip` with colour overrides (Task 2); `AvatarPicker` with style overrides (Task 3); `shell`/`text` (Task 1).
- Produces: `GracefulDateField` gains an optional `tint?: string` prop (undefined = today's exact light styling). No other file imports `AddPetScreen`'s internals — this task has no downstream consumers in this plan.

**Two deliberately bounded scope decisions, so the reviewer doesn't read them as gaps:**

1. **`DateField.tsx`'s native date-picker trigger keeps its current light styling** (a white box, dark text) even inside the wizard's coloured steps. `DateField` is shared with several out-of-scope screens (`AddVaccineScreen`, `AddMedicationScreen`, etc.), and its own popup is the *OS's* native date picker, which cannot be restyled at all regardless. A white trigger button floating on a coloured step background is a coherent, common pattern (it matches how the README's own text-input spec already uses a light/white-ish fill) — not a mismatch worth chasing by forking `DateField` for one screen.
2. **`BreedPicker`'s own modal keeps its current light styling** for the same reason (shared with `EditPetScreen`, out of scope) — its trigger button is restyled (see the wizard-local `WizardButton` below), but what opens when you tap it is unchanged.

- [ ] **Step 1: Add a `tint` prop to `GracefulDateField.tsx`**

Read the current file first. This only needs to recolour what the component directly controls (its own label/explanation text and the precision `Chip` row) — the embedded `DateField`/`TextField` sub-fields are covered by decision 1 above and stay as they are.

```tsx
// src/components/ui/GracefulDateField.tsx
import React from 'react';
import { View } from 'react-native';
import { DateField } from '../DateField';
import { TextField } from './TextField';
import { Chip } from './Chip';
import { MutedText } from './Typography';
import { spacing } from '../../theme/theme';
import { monthsToApproxBirthDate } from '../../pets/dateGrace';
import type { DatePrecision } from '../../types/pet';

const PRECISION_LABEL: Record<DatePrecision, string> = {
  exact: 'Exact date',
  roughly: 'I know roughly when',
  approxAge: 'I only know an approximate age',
  unknown: "I don't know",
};

const PRECISION_REASSURANCE: Record<DatePrecision, string> = {
  exact: '',
  roughly: 'A rough guess is completely fine.',
  approxAge: "We'll estimate a date from the age you give — you can change it later.",
  unknown: "That's okay — you can add this anytime from the pet's profile.",
};

interface GracefulDateFieldProps {
  label: string;
  explanation?: string;
  options: DatePrecision[];
  precision: DatePrecision | null;
  date: number | null;
  approximateAgeMonths: number | null;
  onChange: (result: { precision: DatePrecision; date: number | null; approximateAgeMonths: number | null }) => void;
  // Wizard-only: recolours the label/explanation text and the precision
  // Chip row for a coloured step background. undefined = today's exact
  // light styling, used by every non-wizard caller.
  tint?: string;
}

export function GracefulDateField({
  label, explanation, options, precision, date, approximateAgeMonths, onChange, tint,
}: GracefulDateFieldProps) {
  const selectPrecision = (p: DatePrecision) => {
    if (p === 'exact' || p === 'roughly') {
      onChange({ precision: p, date: date ?? Date.now(), approximateAgeMonths: null });
    } else if (p === 'approxAge') {
      onChange({ precision: p, date: null, approximateAgeMonths: approximateAgeMonths ?? 0 });
    } else {
      onChange({ precision: p, date: null, approximateAgeMonths: null });
    }
  };

  const labelStyle = tint ? { color: 'rgba(255,255,255,0.85)' } : undefined;

  return (
    <View style={{ gap: spacing.sm }}>
      <MutedText style={[{ fontWeight: '600' as const }, labelStyle]}>{label}</MutedText>
      {explanation && <MutedText style={labelStyle}>{explanation}</MutedText>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {options.map((p) => (
          <Chip
            key={p}
            label={PRECISION_LABEL[p]}
            selected={precision === p}
            onPress={() => selectPrecision(p)}
            selectedBg={tint ? '#FFFFFF' : undefined}
            selectedColor={tint}
            unselectedBg={tint ? 'rgba(255,255,255,0.18)' : undefined}
            unselectedColor={tint ? '#FFFFFF' : undefined}
          />
        ))}
      </View>
      {precision && PRECISION_REASSURANCE[precision] && <MutedText style={labelStyle}>{PRECISION_REASSURANCE[precision]}</MutedText>}
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

- [ ] **Step 2: Verify the `GracefulDateField` change alone compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. `AddPetScreen.tsx` doesn't pass `tint` yet — confirm it still compiles with the prop omitted (it's optional).

- [ ] **Step 3: Rewrite `AddPetScreen.tsx`**

Read the current file first in full — every step's `data`/`update`/`next`/`back`/`handleSave`/`BackHandler` logic is **unchanged**; only `renderStep()`'s JSX and the screen's outer chrome change. This is the largest single file in this plan — go step by step against the README's "Add-pet wizard" section rather than trying to hold the whole thing in your head at once.

```tsx
// src/navigation/AddPetScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, BackHandler, Pressable, Text, TextInput } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createPet, updatePetPhoto, subscribeToPets, NewPetInput } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet, PetSpecies, DatePrecision, ArrivalPrecision } from '../types/pet';
import { SPECIES_LIST, SPECIES_LABEL, SPECIES_EMOJI } from '../pets/species';
import { ScreenContainer, ErrorText, Chip, AvatarPicker, GracefulDateField, BreedPicker } from '../components/ui';
import { shell, spacing } from '../theme/theme';
import { canAddCustomField, customFieldLimitMessage } from '../limits/limits';
import { DateField } from '../components/DateField';

type WizardData = NewPetInput & { photoDataUri: string | null };

const INITIAL: WizardData = {
  name: '', species: 'dog', speciesOther: null, breed: '',
  birthDate: Date.now(), birthDatePrecision: 'exact', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null,
  sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active', photoDataUri: null,
};

const TOTAL_STEPS = 9;
const WIZARD_TINTS = ['#5B4BE8', '#EC1E63', '#F97316', '#14B8A6', '#7C3AED', '#0EA5E9', '#F43F5E', '#0F9D58', '#5B4BE8'];

// A local, wizard-only outline button — the shared `Button` component's
// variants don't have a "white outline on an arbitrary coloured
// background" option, and adding one there for a single screen isn't
// worth widening that component's API. Used for every wizard "secondary"
// action: the breed-picker trigger, Skip, and the custom-fields Remove/Add
// buttons.
function WizardButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 44, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}

// The wizard's dark text-input treatment — rgba(255,255,255,0.18) fill, no
// border, white text. Hand-rolled rather than extending the shared
// `TextField` (bordered, white-bg, dark text) because the two look nothing
// alike; `TextField` stays exactly as it is for every other screen.
function WizardTextField({ label, value, onChangeText, placeholder, keyboardType }: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.45)"
        keyboardType={keyboardType}
        style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 14, fontSize: 16, fontWeight: '600', color: '#FFFFFF', minHeight: 48 }}
      />
    </View>
  );
}

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
  const tint = WIZARD_TINTS[step];

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        back();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [step]);

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
      // Lands on the new pet's hub (Part A's design decision) rather than
      // going back — shows off the just-assigned identity colour immediately.
      navigation.replace('PetHome', { petId: pet.id });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const petName = data.name.trim() || 'your pet';

  // Every chip on every step uses the same selected/unselected colour pair —
  // Chip itself already branches on each chip's own `selected` prop, so this
  // is a plain constant, not a function of any individual chip's state.
  const stepChip = { selectedBg: '#FFFFFF', selectedColor: tint, unselectedBg: 'rgba(255,255,255,0.18)', unselectedColor: '#FFFFFF' };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>Let's add a pet</Text>
            <AvatarPicker
              photoUri={data.photoDataUri}
              onPicked={(uri) => update({ photoDataUri: uri })}
              size={116}
              emojiSize={34}
              backgroundColor="rgba(255,255,255,0.2)"
              borderColor="rgba(255,255,255,0.55)"
              borderWidth={3}
              borderStyle="dashed"
              caption="mono"
              captionColor="rgba(255,255,255,0.85)"
            />
            <TextInput
              value={data.name}
              onChangeText={(t) => update({ name: t })}
              placeholder="Pet's name"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={{
                fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
                borderBottomWidth: 2, borderBottomColor: 'rgba(255,255,255,0.5)', paddingBottom: 8, backgroundColor: 'transparent',
              }}
            />
          </>
        );
      case 1:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`What kind of animal is ${petName}?`}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SPECIES_LIST.map((s) => (
                <Chip
                  key={s}
                  label={`${SPECIES_EMOJI[s]} ${SPECIES_LABEL[s]}`}
                  selected={data.species === s}
                  onPress={() => update({ species: s, speciesOther: s === 'other' ? data.speciesOther : null })}
                  {...stepChip}
                />
              ))}
            </View>
            {data.species === 'other' && (
              <WizardTextField
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
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`${petName}'s breed`}</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>
              Not sure, or not a specific breed? That's completely fine — pick Mixed, Stray or rescued, or Don't know.
            </Text>
            <WizardButton title={data.breed || 'Choose a breed (optional)'} onPress={() => setBreedPickerOpen(true)} />
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
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`When was ${petName} born?`}</Text>
            <GracefulDateField
              label="Birth date"
              options={['exact', 'roughly', 'approxAge', 'unknown']}
              precision={data.birthDatePrecision}
              date={data.birthDate}
              approximateAgeMonths={data.approximateAgeMonths}
              onChange={({ precision, date, approximateAgeMonths }) =>
                update({ birthDatePrecision: precision as DatePrecision, birthDate: date, approximateAgeMonths })
              }
              tint={tint}
            />
          </>
        );
      case 4:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`When did ${petName} join your care?`}</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>Optional — skip this if you'd rather not answer.</Text>
            <GracefulDateField
              label="Arrival date"
              options={['exact', 'roughly', 'unknown']}
              precision={data.arrivalDatePrecision}
              date={data.arrivalDate}
              approximateAgeMonths={null}
              onChange={({ precision, date }) =>
                update({ arrivalDatePrecision: precision as ArrivalPrecision, arrivalDate: date })
              }
              tint={tint}
            />
            <WizardButton title="Skip" onPress={() => update({ arrivalDatePrecision: null, arrivalDate: null })} />
          </>
        );
      case 5:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`About ${petName}`}</Text>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)' }}>Sex — helps tailor care reminders.</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['male', 'female', 'unknown'] as const).map((s) => (
                  <Chip key={s} label={s} selected={data.sex === s} onPress={() => update({ sex: s })} {...stepChip} />
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)' }}>Neutered / spayed — some vaccines and medications are dosed differently.</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Chip label="Yes" selected={data.neutered === true} onPress={() => update({ neutered: true })} {...stepChip} />
                <Chip label="No" selected={data.neutered === false} onPress={() => update({ neutered: false })} {...stepChip} />
                <Chip label="Don't know" selected={data.neutered === null} onPress={() => update({ neutered: null })} {...stepChip} />
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)' }}>
                Helps identify your pet if they're ever lost, and confirms it's them for vets or a microchip registry.
              </Text>
              <WizardTextField
                label="Colour / markings (optional)"
                value={data.colorMarkings}
                onChangeText={(t) => update({ colorMarkings: t })}
              />
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)' }}>
                Where do they spend their time? This changes flea/tick/worm risk, so protection can be tailored to match.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['indoor', 'outdoor', 'both'] as const).map((e) => (
                  <Chip key={e} label={e} selected={data.livingEnvironment === e} onPress={() => update({ livingEnvironment: e })} {...stepChip} />
                ))}
              </View>
            </View>
          </>
        );
      case 6:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>Microchip</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>Optional — add this now or anytime from the pet's profile.</Text>
            <WizardTextField label="Provider" value={data.microchipProvider} onChangeText={(t) => update({ microchipProvider: t })} />
            <WizardTextField label="Chip number" value={data.microchipNumber} onChangeText={(t) => update({ microchipNumber: t })} />
            <DateField
              label="Date implanted"
              value={data.microchipDate}
              onChange={(v) => update({ microchipDate: v })}
              onClear={() => update({ microchipDate: null })}
            />
            <WizardTextField label="Registry" value={data.microchipRegistry} onChangeText={(t) => update({ microchipRegistry: t })} />
          </>
        );
      case 7: {
        const atLimit = !canAddCustomField(data);
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>Custom fields</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>
              Add your own fields — favourite food, walking route, anything you want to remember.
            </Text>
            {data.customFields.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <WizardTextField
                    label="Label"
                    value={f.label}
                    onChangeText={(t) => update({ customFields: data.customFields.map((cf, j) => (j === i ? { ...cf, label: t } : cf)) })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <WizardTextField
                    label="Value"
                    value={f.value}
                    onChangeText={(t) => update({ customFields: data.customFields.map((cf, j) => (j === i ? { ...cf, value: t } : cf)) })}
                  />
                </View>
                <Pressable
                  onPress={() => update({ customFields: data.customFields.filter((_, j) => j !== i) })}
                  accessibilityRole="button"
                  accessibilityLabel="Remove custom field"
                  style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>×</Text>
                </Pressable>
              </View>
            ))}
            <WizardButton
              title={atLimit ? customFieldLimitMessage() : 'Add a custom field'}
              disabled={atLimit}
              onPress={() => update({ customFields: [...data.customFields, { label: '', value: '' }] })}
            />
          </>
        );
      }
      case 8: {
        const Row = ({ label, value, jumpTo }: { label: string; value: string; jumpTo: number }) => (
          <Pressable
            onPress={() => setStep(jumpTo)}
            accessibilityRole="button"
            style={{ borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>{label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>{value || '—'}</Text>
          </Pressable>
        );
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>Review</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>Tap anything to change it.</Text>
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
    }
  };

  return (
    <ScreenContainer scroll background={tint} style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 26, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>
          Step {step + 1} of {TOTAL_STEPS}
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: 8, paddingHorizontal: 14 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Close</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: i <= step ? '#FFFFFF' : 'rgba(255,255,255,0.3)' }} />
        ))}
      </View>

      {renderStep()}
      {error && <ErrorText style={{ color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.25)', padding: spacing.sm, borderRadius: 12 }}>{error}</ErrorText>}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={step > 0 ? back : () => navigation.goBack()} accessibilityRole="button">
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>{step > 0 ? 'Back' : 'Cancel'}</Text>
        </Pressable>
        <Pressable
          onPress={step < TOTAL_STEPS - 1 ? next : handleSave}
          disabled={loading}
          accessibilityRole="button"
          style={{
            backgroundColor: '#FFFFFF', borderRadius: 999, minHeight: 56, paddingVertical: 16, paddingHorizontal: 26,
            flexDirection: 'row', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: tint }}>{step === TOTAL_STEPS - 1 ? 'Add pet' : 'Next'}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: tint }}>›</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
```

Two deliberate deviations from a literal transcription of the current file, both already covered above — call them out to the reviewer rather than let them look like accidents:
- `handleSave` now calls `navigation.replace('PetHome', { petId: pet.id })` instead of `navigation.goBack()` — Part A's resolved design decision (land on the new pet's hub). `replace`, not `navigate`, so the wizard isn't left on the back stack behind the hub.
- The footer's left button is `WizardButton`-styled inline (not the `WizardButton` component itself, since it needs no border/pill background per the README's plain-text "Back"/"Cancel" spec) — don't "fix" this into a `WizardButton` call during review; it's intentionally different from the breed-picker/Skip/custom-field buttons.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/GracefulDateField.tsx src/navigation/AddPetScreen.tsx
git commit -m "feat: reskin the Add-Pet wizard with per-step tint backgrounds"
git push
```

---

### Task 9: Whole-plan verification and the on-device checklist

**Files:** none new — this task is verification, not code.

- [ ] **Step 1: Full verification pass**

Run: `npx tsc --noEmit` — expect zero errors across the whole project.
Run: `npx jest` — expect every existing test to still pass, plus the new `__tests__/Chip.test.tsx` from Task 2.
Run: `npm ls react-native-reanimated @expo-google-fonts/outfit @expo-google-fonts/nunito 2>&1 | cat` — expect all three to report "not installed"/"empty", confirming the no-new-dependency constraint held.

- [ ] **Step 2: On-device checklist**

Build and launch from this worktree (`npx expo run:android`) and check, on the real phone:

**Out-of-scope screens are genuinely unaffected** (check this first — a regression here is worse than any in-scope polish issue):
- Vets tab, Household tab, sign-in/sign-up, and `EditPetScreen` all still render in their original light theme, unchanged — the shared-primitive extensions (Task 2/3) must not have leaked the dark styling into them.
- The Vets tab's pet selector still renders in its original small-avatar, bordered-ring light style (`variant="light"`, the default) — this is the single highest-risk regression point, since `PetSelector` is shared between an in-scope screen (Home) and an out-of-scope one (Vets).

**Tab bar, FAB, Add sheet:**
- Tab bar background is dark, active tab is white, inactive tabs are dimmed — icons are still real icons (paw/calendar/medkit/people), not emoji.
- Tap the FAB — it opens the reskinned dark sheet with coloured 2-column tiles. The context line reads "Adding to {pet}." when a specific pet is selected, or the "no pet selected" copy under "All Pets".
- Every tile still routes correctly — spot-check "Add a Pet" (opens the wizard) and "Add to Calendar" (reaches `AddEventScreen`, unchanged from before this plan).

**Pets home:**
- Header shows the household name eyebrow and "Hey {name} 👋".
- Pet selector (dark variant) — switching between "All Pets" and a specific pet filters the due strip and pet-card list correctly.
- A pet with something due shows a due-strip card and a due pill on its own card; a pet with nothing due shows "✅ Nothing due — all clear".
- An overdue item shows a red (`#DC2626`) background on its due-strip card, and — a deliberately different treatment on the pet card's own pill, per the design handoff — a white background with red text there instead.
- Stat boxes show real numbers — weight, records count, and a real year-to-date spend total (add a test expense first if the seeded data has none).
- Cards visibly animate in (fade + slight rise) on screen load, not a hard cut.
- Delete every pet (or filter to a household with none) and confirm the empty state renders — dashed border, "No pets here yet", the accent "Add a pet" pill button.

**Pet health hub:**
- Open a pet — hero shows the pet's identity colour full-bleed, species watermark, back button, "Mark remembered" pill.
- Tap "Mark remembered", confirm the pill flips to "Bring back" and (per the existing `EditPetScreen` behaviour this plan doesn't change) the pet now shows as remembered elsewhere in the app; tap "Bring back" to restore it.
- Tap through all 8 identity-colour swatches — hub, and the Home card you came from, both update live.
- All six section tiles show real counts and route correctly, including the new Calendar tile — confirm it lands on the Calendar tab with this pet already selected in the pet selector.
- Weight trend chart: tap a bar, confirm it turns white and shows its value above; tap again to deselect.
- Spend card shows a real per-category breakdown with proportional bars, or "No expenses logged this year" if there are none.

**Add-Pet wizard:**
- Each of the 9 steps shows its own distinct tint background (colours cycle, step 0 and step 8 share the same tint).
- Progress bar fills correctly as you advance.
- Chips: unselected translucent white, selected flips to solid white with tint-coloured text.
- Step 0: dashed avatar circle, centred underlined name field.
- Steps 3/4 (graceful dates): precision chips match the wizard's white/tint style; tapping "Exact"/"Roughly" opens the (intentionally still-light) native date picker without looking jarringly broken.
- Custom fields: add one, remove it via the "×" button, confirm the free-tier limit message appears and disables the add button after 3.
- Review step: tapping any row jumps back to that step with the previous answer intact.
- Hardware/gesture back button steps the wizard backward exactly like the in-app "Back" — confirm on at least 2 steps, then confirm it exits the wizard entirely from step 0.
- Complete the wizard — confirm it lands on the new pet's hub (not back on Home), showing the pet's freshly assigned identity colour.

If anything fails, it's a real bug in this branch — fix it directly with small, targeted commits before moving to Part B.

- [ ] **Step 3: Update `NEXTSTEPS.md`/`CLAUDE.md`**

Once the checklist passes, record in `CLAUDE.md` (a new "Colourful reskin (Part A)" paragraph, matching the style of the "UI/Design system" section it extends) what this plan built and the resolved design decisions (Tinted cards, platform-default fonts, `Animated`-only, land-on-hub), and update `NEXTSTEPS.md` to point at Part B (`docs/superpowers/specs/2026-09-16-colorful-reskin-design.md`'s remaining scope: the five record-list screens + Calendar/`DayDetailScreen`) as the next plan to write.

