# Colourful Reskin, Part A — build and device verification, 2026-09-18

Archived from `CLAUDE.md` / `NEXTSTEPS.md`. The durable rules (what the reskin
covers, its theme tokens and its two build constraints) stay in CLAUDE.md.

## What it was

A presentation-only dark-shell restyle of the onboarding-through-first-pet path,
built from `design_handoff_colorful_reskin/README.md` (a high-fidelity design
handoff covering six screen areas) via
`docs/superpowers/specs/2026-09-16-colorful-reskin-design.md` and
`docs/superpowers/plans/2026-09-16-colorful-reskin-part-a.md`. Split into two
plans by explicit owner choice: **Part A** (theme foundation, tab bar/FAB/Add
sheet, Pets home, Pet health hub, Add-Pet wizard) is done; **Part B** (the five
record-list screens + Calendar) is deferred, not yet brainstormed or planned.

No data model, Firestore service, or navigation-structure change.

## Build record

Built via `superpowers:subagent-driven-development` in a dedicated worktree at
`C:\dev\colorful-reskin` (branch `colorful-reskin`, from `master` `f52d47a`) —
9 tasks, 2 of which needed one fix round each (a test-mock scoping issue, and two
self-caught bugs: a missing Expenses tile and a dropped Edit-pet entry point),
then a final whole-branch review (opus) that found 1 Critical + 5 Important
genuine regressions — all traced to mistakes in this plan's own authored code
snippets rather than implementer error — fixed in one wave and independently
re-verified clean.

## Device verification

Every checklist item passed, including two rounds of real bugs only the phone
caught (commit `8b503a5`):

1. **Safe-area padding lost under the new `headerShown: false` screens**
   (Home / PetHome / AddPet) — removing the native header also removed its
   implicit top inset. Fixed with `useSafeAreaInsets()`.
2. **Home's due-strip `FlatList` expanded to fill ~700px** instead of its natural
   ~100–150px — the same bug class as Plan 6's `PetSelector` fix, fixed the same
   way (`flexGrow: 0`).

Also exercised and confirmed: a full end-to-end Add-Pet wizard run confirming the
plan's key resolved decision — completing the wizard calls
`navigation.replace('PetHome', { petId })` and lands directly on the new pet's own
hub showing its freshly assigned identity colour, not back on Home. Custom-field
add/remove/free-tier-cap, review-step row-tap-to-jump, graceful-date precision
chips, and hardware-back step-not-exit behaviour were all confirmed working.

A contrast bug found during the plan's final review: `petColors.ts`'s
`onPetColorInk(hex)` was added to pick readable text colour by relative luminance
anywhere text sits directly on a pet's identity colour — the two lightest
round-robin colours (`#F59E0B` amber, `#84CC16` lime) had been rendering
unreadable text.
