# Colourful Reskin — Design

**Primary spec:** `design_handoff_colorful_reskin/README.md` (this repo root) — a high-fidelity design handoff with exact tokens, layout specs, copy, and interaction rules for six screen areas. That document is the argued design; this file records the decisions it explicitly left open, the decisions it doesn't cover, and the constraints that bind the implementation plan. Read both — the plan argues from this file, which in turn argues from the README.

## Goal

Reskin the existing app onto a dark shell where each pet's identity colour becomes the dominant accent, across exactly the six areas the README specifies: Pets home, Pet health hub, the five record-list screens (one shared layout), the Add-Pet wizard, Calendar (+ Day Detail), and the tab bar / Add sheet. No data model, Firestore service, or navigation-structure change — this is a presentation-layer change, extending `src/theme/theme.ts` and the `src/components/ui/*` primitives already established in this codebase.

## Decisions resolved (README explicitly left these open)

1. **Pet card treatment: Tinted**, not Full colour. Neutral dark card (`shell.card`) + a 5px pet-colour left rail + a low-opacity watermark, matching the README's own screenshots (not its higher-drama prose default). Chosen specifically because it sidesteps the README's own flagged weak point — white text directly on the two light pet colours (`#F59E0B` amber, `#84CC16` lime) is hard to read at full-colour-background contrast; a rail avoids the problem entirely rather than requiring a per-colour text-contrast exception.
2. **Fonts: platform default, not Outfit/Nunito.** Keep every specified size, weight, and letter-spacing from the README's typography table exactly — only the font family changes, to the RN default (San Francisco on iOS, Roboto on Android). This avoids adding `@expo-google-fonts/outfit` + `@expo-google-fonts/nunito` and the prebuild/rebuild cycle that comes with any new dependency in this project's Windows build environment. The README explicitly names this substitution as acceptable.
3. **Animation: React Native's built-in `Animated` + `LayoutAnimation.easeInEaseOut()` only.** No `react-native-reanimated`. Card entry (fade + translateY(10)→0 + scale(0.98)→1, 250ms ease), screen fade (200ms), and the sheet slide-up (220ms, or `LayoutAnimation` as the README itself calls an acceptable shortcut) are all achievable with `Animated` at this scale. Matches this project's repeated "avoid a new native dependency" precedent (`WeightTrendChart`, the hand-rolled Calendar grids) — `react-native-reanimated` would be the first native-code dependency added purely for cosmetic polish.
4. **Add-Pet wizard lands on the new pet's hub after creation**, not `goBack()`. Matches the prototype's intent (showing off the just-assigned identity colour immediately) and is explicitly framed as "your choice" in the README, not a structural navigation change — the wizard's own step flow, `BackHandler` behavior, and review-row-jumps-to-step behavior are all unchanged.

## Explicitly out of scope (per the README's own "Not covered" section)

Vets directory, Household, Reminder Settings, and auth/household-setup screens are **not** touched by this plan. They need the same dark-shell treatment eventually, but the README provides no detailed spec for them, and Vets/Household were just rebuilt in Plan 7 (a separate, not-yet-merged branch) — reskinning them now would mean designing against a moving target with no spec to argue from. This is a deliberate scope boundary, not an oversight; a future plan should give them the same treatment once a spec exists.

## Known cross-branch risk

`src/navigation/AddSheet.tsx` is touched by both this reskin (full restyle of the sheet and its tiles) and Plan 7 (one new "Add a Vet" `ADD_ACTIONS` entry, not yet merged to `master`). Whichever branch merges second needs a small, mechanical reconciliation — re-adding one array entry inside the restyled sheet, or vice versa. Not blocking; flagged so it isn't a surprise during `finishing-a-development-branch`.

## Global constraints for the implementation plan

- Extend `src/theme/theme.ts`'s exported objects with the README's `shell.*` and `text.*` token tables (plus `accentLavender`) — do not replace or rename any existing `colors.*`/`spacing.*`/`radii.*` export; existing screens outside this reskin's scope (Vets, Household, auth) still read the current light-theme tokens and must keep working unchanged.
- Compose from `src/components/ui/*` wherever an existing primitive fits (`Card`, `Button`, `Chip`, `Typography`, `ScreenContainer`, `PetSelector`). Where the README's spec genuinely needs a shape none of them provide (e.g. the wizard's inverted white-background/tint-label chip, the hub's colour-swatch row), extend the existing component with a new variant/prop rather than hand-rolling a parallel one-off, unless the plan's own file-structure section calls for a new small component — follow whatever precedent already exists for similar one-off pieces in this codebase (e.g. `PermissionBar`, `GuidedEmptyState`).
- Every tappable target stays ≥44px tall, per the README's explicit minimum-sizes section — several current screens use 36px chips; this reskin corrects that everywhere it touches.
- Emoji stay as species/section/event icons (no new icon set) — matches current code and the README's own instruction.
- No new dependency of any kind (fonts or animation), per the two decisions above. `react-native-reanimated`/`@expo-google-fonts/*` should not appear in `package.json` as a result of this plan.
- Dedicated worktree at `C:\dev\<name>` (not `.claude/worktrees`), branched from current `master` — this plan does not depend on Plan 7 and should not wait for it, per the scope boundary above.
