# Colourful Reskin, Part B — Design

**Primary spec:** `design_handoff_colorful_reskin/README.md` (this repo root) — the same design handoff Part A implemented, sections 3 ("Record lists") and 5 ("Calendar"). **Prior spec:** `docs/superpowers/specs/2026-09-16-colorful-reskin-design.md` — Part A's design doc, which this one extends rather than re-argues. Read all three — this file records only what's specific to Part B; every decision Part A already resolved applies here unchanged.

## Goal

Finish the dark-shell reskin onto the two areas Part A explicitly deferred: the five record-list screens (one shared layout, per-screen row content) and the Calendar tab (week/month grids, agenda, day detail). No data model, Firestore service, or navigation-structure change — same constraint as Part A, and for the same reason: this is presentation-layer only, extending the theme tokens and `src/components/ui/*` primitives Part A already built.

## Decisions inherited from Part A, not re-opened here

The README leaves no new open decisions for record lists or Calendar — every one it does leave open was already resolved by Part A's design doc, and applies identically to these screens:

1. **Tinted card treatment** — record-list rows and calendar entry cards both already spec a pet-colour left rail (5–8px) on a neutral `shell.card` background, not a full-colour card. This is the README's own literal spec for these screens (§3, §5), not a judgment call — it already matches Part A's resolved choice, so there's nothing to decide.
2. **Fonts: platform default**, not Outfit/Nunito — same substitution, same reason (no new dependency, no prebuild/rebuild cycle).
3. **Animation: React Native's built-in `Animated` only** — the entry-card `popIn` (fade + translateY(10)→0 + scale(0.98)→1, 250ms ease) and screen fade (200ms) are both achievable at this scale with `Animated`, matching Part A's precedent. No `react-native-reanimated`.
4. **No new dependency of any kind.**

## What's actually new in Part B

Nothing at the decision level — this is new *surface area* (7 screens/components), not new *judgment calls*. The work is applying tokens and primitives that already exist (`shell.*`/`text.*` from `theme.ts`, the dark `PetSelector` variant, `Chip`'s tinted-selection props, `onPetColorInk` for text-on-pet-colour contrast) to:

- `VaccineListScreen.tsx`, `MedicationListScreen.tsx`, `VetVisitListScreen.tsx`, `WeightLogScreen.tsx`, `ExpenseListScreen.tsx` — one shared visual layout (README §3: round back button, title + "`{Pet} · {n} entries`" sub, `shell.card` rows with rail + title/sub/value, dashed "Add a ___" footer), five different row-content configs.
- `CalendarScreen.tsx`, `DayDetailScreen.tsx`, and their `WeekView`/`MonthView` sub-components (README §5: header, pet selector, Week/Month/Overdue chips, `‹ Today ›` range row, week strip / month grid with pet-colour dots, agenda entry cards wired to the existing `markDone`/`skip`/`updateEvent`, empty state).

One genuine implementation note the README calls out explicitly: **Month view's agenda now renders inline below the grid** ("Unlike today's build, the agenda does render under the month grid — the dark rows are compact enough and the screen scrolls") — this reverses Part A-era Plan 6's own fix (which replaced an unrenderable inline list with a "View full day" hint specifically because the *light-theme* rows didn't fit). The dark rows are visually denser, so this plan restores the inline agenda in Month mode per the README's explicit instruction, and keeps the "View full day" link as a secondary affordance (not covered by removing it — DayDetailScreen still needs to exist and be reachable) rather than removing it outright.

## Explicitly out of scope

Same boundary as Part A, per the README's own "Not covered" section: Vets, Household, Reminder Settings, and auth/household-setup screens. Not touched by this plan.

## Known risk: the `known-gaps-fixes` branch

`CalendarScreen.tsx` and `DayDetailScreen.tsx` were both touched by an unmerged branch (`known-gaps-fixes`, not yet merged to `master` as of this doc) that added `error`/`ErrorText` state and try/catch around `handleDone`/`handleSkip`/`handleToggleComplete`. This plan's worktree should branch from `master` as it stands today (that branch not yet merged) — if `known-gaps-fixes` merges first, this branch will need a small, mechanical rebase reconciliation on those two files (the error-handling additions and the visual reskin touch different parts of the same functions' bodies, not the same lines). Flagged so it isn't a surprise during `finishing-a-development-branch`.

## Global constraints for the implementation plan

- Extend nothing new in `theme.ts` — Part A's `shell.*`/`text.*`/`accentLavender` tokens already cover everything these screens need. If a genuine gap turns up during implementation, add to `theme.ts` following Part A's existing pattern, but expect not to need to.
- Compose from `src/components/ui/*` wherever an existing primitive fits, exactly as Part A did — the dark `PetSelector` variant and `Chip`'s tinted props already exist for this purpose.
- Every tappable target stays ≥44px tall, per the README's explicit minimum-sizes section — same rule Part A enforced.
- Emoji stay as species/section/event icons — no new icon set.
- No new dependency of any kind.
- Dedicated worktree at `C:\dev\<name>` (not `.claude/worktrees`), branched from current `master`.
- **On-device verification is blocked** at plan-authoring time (no reachable device). Build and review to completion; the plan's on-device checklist task stays open/pending until a device is available, matching how every other plan in this project treats verification as a distinct, non-skippable final step — not something to fake or skip silently.
