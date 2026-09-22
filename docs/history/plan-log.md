# Plan build log

Archived from `NEXTSTEPS.md`. One entry per completed plan: how it was built and
what was left behind. Architecture references live in `CLAUDE.md`; per-plan device
verification detail has its own dated file in this folder.

Plan numbering follows the execution pack's Phase→Plan mapping (Phase 1 = Plan 3,
Phase 2 = Plan 4, Phase 3 = Plan 5, Phase 4 = Plan 6, Phase 5 = Plan 7). This is
*not* the original design spec's own draft numbering.

---

## Plan 3 — "App shell and home screen" — merged to `master`

Built via `superpowers:subagent-driven-development`, 10 tasks, plus a final
whole-branch review and one fix wave. Plan doc:
`docs/superpowers/plans/2026-09-14-app-shell-and-home-screen.md`.

**What it built:**

- Bottom tab bar (Pets / Calendar / Vets / Household) + a raised "+" add sheet.
- Home screen rebuilt as one card per pet, filterable by a shared
  `usePetSelection()` / `<PetSelector>` primitive.
- Every pet has a `colorKey` identity colour — always read via `petColor(pet)`.
- Real `Ionicons` for the tab bar and add button; emoji for decorative glyphs.

**Resolved by Plan 5:** `src/pets/upcomingSummary.ts` — the placeholder whose
"nearest by absolute distance" due-date picking let a two-year-overdue vaccine
lose to one due next month — is deleted; `HomeScreen` now uses the real
`computeUpcoming`, which ranks overdue above upcoming by construction.

**Resolved by Plan 4:** the stale-`selectedPetId`-on-delete concern, via
`reconcileSelection()`.

**Still open, minor:** `HomeScreen` has its own local "Add a pet" button *and* the
global "+" sheet also offers "Add a Pet" — harmless duplication, worth a keep/drop
call whenever convenient.

---

## Plan 4 — "Pet profile depth" — merged to `master`

Built via `superpowers:subagent-driven-development`, 12 tasks, plus a final
whole-branch review ("Ready to merge: With fixes" — 6 Important, 0 Critical) and
one fix wave, re-reviewed clean. Plan doc:
`docs/superpowers/plans/2026-09-14-pet-profile-depth.md`.

**What it built:**

- `Pet` widened to 23 fields, all optional/nullable, zero migration needed:
  8-species selection, a curated breed picker (Mixed / Stray / Don't-know pinned
  above the alphabetical list), graceful date precision for birth date and a
  separate arrival-date question, sex / neutered / colour / living environment,
  microchip details, and free-tier-limited custom fields.
- `src/limits/limits.ts` — the one shared place every free-tier cap is read from.
- A 9-step Add Pet wizard, a new Edit Pet screen, and
  `Pet.status: 'active' | 'remembered'` (reversible; no delete-pet feature
  anywhere, by design).
- Guided empty states on the vaccine and weight-log screens.

**Parked:** the weight-log empty state's "Log weight" button is a no-op when
tapped (`GuidedEmptyState`'s action props are required, and widening the component
was bigger than the fix wave) — fix whenever that component is next touched.

**Test data left in the live Firestore project** (housekeeping, not a code issue):
a pet named "Zara" was marked remembered, and a "TestPet12" was created, both
during device testing. No in-app cleanup path exists — clean up by hand in the
Firebase console.

---

## Plan 5 — "Reminders and notifications" — merged to `master`, device-verified

Full build record and the four review findings:
[`2026-09-15-plan-5-verification.md`](./2026-09-15-plan-5-verification.md).

**What it built:**

- `src/reminders/computeUpcoming.ts` — a pure calculation module (zero
  Firebase/React dependency) working out every upcoming vaccine due date,
  medication dose and vet-visit follow-up from existing records.
- Local notifications via a new `expo-notifications` dependency, recomputed and
  rescheduled whenever data or settings change (`ReminderRescheduler.tsx`).
- Done/Skip/Snooze on every reminder. Skip reads as a normal action, not a failure
  (outline-styled button, "Last skipped" phrasing). Vaccine and
  vet-visit-follow-up Done/Skip deliberately collapse to the same effect.
- A permission bar and a Reminder Settings screen (lead time, time of day, and the
  required honest line that reminders are scheduled on *this* phone from what
  *this* phone has seen). Settings and snoozes are stored locally per device via a
  new `@react-native-async-storage/async-storage` dependency, never Firestore.
- The reminders list lives in the `CalendarScreen` tab, replacing its old "coming
  soon" placeholder.
- `firestore.rules`' vetVisits create allowlist gained one field (`followUpDate`) —
  the only rules change this plan needed.

---

## Plan 6 — "Calendar" — merged to `master`, device-verified

Full build record and the eight device-found bugs:
[`2026-09-15-plan-6-verification.md`](./2026-09-15-plan-6-verification.md).

---

## Colourful Reskin, Part A — device-verified

[`2026-09-18-colorful-reskin-part-a.md`](./2026-09-18-colorful-reskin-part-a.md).

---

## Colourful Reskin, Part B — merged to `master`, device-verified

[`2026-09-22-colorful-reskin-part-b.md`](./2026-09-22-colorful-reskin-part-b.md).

---

## Bolt-connected purple theme — merged and verified on-device, 2026-09-15

After Plan 6 merged, the owner connected this GitHub repo to Bolt (bolt.new),
which pushed three commits directly to `master` outside any Claude Code session:
a purple colour-theme rebrand (`src/theme/theme.ts`), an accessibility contrast
fix (a new `accentText` token so text on the orange accent surface isn't
hardcoded white), and a `.gitignore` addition (`.env`). Merged cleanly into the
Plan 6 branch with zero conflicts — the one shared file, `AddSheet.tsx`, had
non-overlapping changes.

Rebuilt from `master` and confirmed live on the real device: purple
header/buttons/accents, orange Calendar-tab icon and "+" button unchanged, and
all of Plan 6's layout fixes still holding with the new palette. No code changes
were needed beyond what Bolt pushed — every screen reads colours by token name,
so the rebrand took effect automatically.
