# Pet Health Tracker — Reminders and Notifications Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The phone tells you before a vaccine is due or a tablet needs giving. A single pure calculation module works out everything coming up — vaccine due dates, medication doses, vet-visit follow-ups — from the records already in the app; local notifications are scheduled from it; a permission bar asks for notification access where it matters; and Done/Skip/Snooze make handling a reminder (including skipping one) a normal, guilt-free action.

**Architecture:** `src/reminders/computeUpcoming.ts` is a pure function with zero Firebase/phone/screen dependency — the single most important requirement in this plan, because it's what makes a later server-side version (Phase 6, gated behind Phase 0's billing resolution) a short phase instead of a rewrite. Everything else in this plan is a thin, testable shell around it: a multi-pet Firestore fan-out hook feeds it live data, a pure timing function turns its output into notification trigger times, and `expo-notifications` (a new native dependency) actually schedules them. Reminder settings (how far in advance, what time of day) and snoozes are stored locally per device via `@react-native-async-storage/async-storage` (also new) rather than Firestore — deliberate, since it matches the plan's own required honesty line: reminders, and now the settings that shape them, are scheduled on this phone from what this phone has seen, not synced across a household. The reminders list itself temporarily lives in the existing `CalendarScreen` tab (today a placeholder) rather than a new tab, since the execution pack pairs "reminders and calendar screens" and Plan 6 owns the real week/month calendar UI that will grow around this list.

**Tech Stack:** Same as Plans 1-4 (Expo prebuild/dev-client, `@react-native-firebase/firestore` modular API, React Navigation, Jest with mocked Firestore for service logic + `@firebase/rules-unit-testing` against the real emulator for rules), plus two new native dependencies this plan introduces: `expo-notifications` and `@react-native-async-storage/async-storage`. Both need `npx expo prebuild --platform android` and a fresh `npx expo run:android` — see "Dependencies and rebuild" below.

**Spec:** [docs/superpowers/specs/2026-09-13-execution-pack.md](../specs/2026-09-13-execution-pack.md) (Phase 3 planning prompt) and [docs/superpowers/specs/2026-09-13-build-plan.md](../specs/2026-09-13-build-plan.md) (Section 5 — Ana's annotations on the reminder permission bar). Also inherits Plans 1-4's specs/constraints.

## Global Constraints

- The calculation module (`computeUpcoming`) must have **zero dependency on Firebase, React Native, or any screen** — plain TypeScript, plain data in, plain data out, fully unit-testable in Node. This is what lets the exact same code run on a server later. If any task's review finds Firebase or a React import inside this module, that is a Critical finding, not a style note.
- Local notifications are **recomputed and rescheduled whenever the underlying data changes** — not scheduled once and left stale.
- The permission bar appears at the top of the reminders screen — which, per Task 12's note, is `CalendarScreen.tsx` itself for now, satisfying the spec's "reminders and calendar screens" pairing by them being the same screen until Plan 6 splits/grows it — shown only when notification permission has not been granted, tapping it requests permission.
- Skipping is a normal action, not a failure state — its copy, styling, and history must not read as an error.
- Settings must include a visible, honest line explaining that reminders are scheduled on this phone from what this phone has seen — not a footnote, not skippable.
- Every new `VetVisit`/`Medication` field is optional/nullable so existing documents keep working with no migration, following Plan 4's established pattern.
- Every security-rules change follows CLAUDE.md's pattern: `isHouseholdMember(householdId)` gate + a `create`-time `hasOnly([...])` field allowlist — never `hasAll`/`diff()` outside `isJoining()`. An `update` rule already has no field restriction for these collections (see CLAUDE.md's "Pet records data model" note) — a field only ever written via `updateDoc` needs no rules change at all.
- Do not replace the existing design system (`src/theme/theme.ts`, `src/components/ui/`) — extend it.
- Do not build the actual week/month calendar UI (event cards, week strip, filter pills) — that is Plan 6's entire scope. This plan's only claim on `CalendarScreen.tsx` is the permission bar and, temporarily, the reminders list itself.
- TypeScript throughout.

---

## File Structure

```
src/
  reminders/
    computeUpcoming.ts          # NEW: pure calculation module (vaccines, medications, follow-ups)
    notificationTiming.ts       # NEW: pure — reminder + settings -> notification trigger time
    notificationScheduler.ts    # NEW: impure — expo-notifications cancel/reschedule
    settingsStore.ts            # NEW: AsyncStorage-backed lead-days/time-of-day settings
    snoozeStore.ts              # NEW: AsyncStorage-backed per-reminder snooze map
    reminderActions.ts          # NEW: Done/Skip/Snooze dispatcher over the three record types
    useNotificationPermission.ts # NEW: hook wrapping expo-notifications permission state
    useUpcomingReminders.ts     # NEW: multi-pet Firestore fan-out -> computeUpcoming
    ReminderRescheduler.tsx     # NEW: invisible root-mounted component, reschedules on data/settings change
  components/
    ui/
      PermissionBar.tsx         # NEW: reusable "needs a permission" banner
      index.ts                  # MODIFIED: export PermissionBar
  navigation/
    CalendarScreen.tsx          # REWRITTEN: permission bar + live reminders list (not the real calendar)
    ReminderSettingsScreen.tsx  # NEW: lead-days + time-of-day + the honesty line
    RootNavigator.tsx           # MODIFIED: register ReminderSettings route, mount ReminderRescheduler
    HomeScreen.tsx              # MODIFIED: PetCard uses computeUpcoming instead of upcomingSummary
    AddVetVisitScreen.tsx       # MODIFIED: follow-up date field
    MedicationListScreen.tsx    # MODIFIED: Skip button, "last action" display
  pets/
    upcomingSummary.ts          # DELETED: Plan 3's nearest-due-date placeholder (real bug, must not survive)
    vaccineService.ts           # MODIFIED: add updateVaccine()
    medicationService.ts        # MODIFIED: add skipMedicationDose()
    vetVisitService.ts          # MODIFIED: createVetVisit gains followUpDate, add updateVetVisit()
  types/
    medication.ts                # MODIFIED: MedicationDoseLog gains skipped?: boolean
    vetVisit.ts                   # MODIFIED: followUpDate: number | null
firestore.rules                    # MODIFIED: vetVisits' create allowlist gains followUpDate
package.json                        # MODIFIED: expo-notifications, @react-native-async-storage/async-storage
__tests__/
  computeUpcoming.test.ts             # NEW
  notificationTiming.test.ts          # NEW
  settingsStore.test.ts               # NEW
  snoozeStore.test.ts                 # NEW
  reminderActions.test.ts             # NEW
  vaccineService.test.ts              # MODIFIED
  medicationService.test.ts           # MODIFIED
  vetVisitService.test.ts             # MODIFIED
  upcomingSummary.test.ts             # DELETED
  firestore.rules.test.ts             # MODIFIED
```

---

### Task 1: Type updates for reminders

**Files:**
- Modify: `src/types/vetVisit.ts`
- Modify: `src/types/medication.ts`

**Interfaces:**
- Produces: `VetVisit.followUpDate: number | null`; `MedicationDoseLog.skipped?: boolean`.

This task is pure type surface — no behavior changes, nothing to unit-test beyond the project still compiling. It exists as its own task because every later task (starting with Task 2's calculation module) needs these fields to exist in the type system first, and a reviewer should be able to check "did this only touch types" in isolation.

- [ ] **Step 1: Add `followUpDate` to `VetVisit`**

Read the current file first (`src/types/vetVisit.ts`) — it's four lines. Add one field:

```typescript
// src/types/vetVisit.ts
export interface VetVisit {
  id: string;
  petId: string;
  date: number; // epoch millis
  reason: string;
  notes: string;
  documentUrls: string[];
  followUpDate: number | null; // "come back on/around this date" — null if none was set
}
```

- [ ] **Step 2: Add `skipped` to `MedicationDoseLog`**

Read the current file first (`src/types/medication.ts`). Add one optional field to the existing interface — do not touch `MedicationSchedule` or `Medication`:

```typescript
// src/types/medication.ts
export interface MedicationDoseLog {
  givenBy: string; // userId
  givenAt: number; // epoch millis
  skipped?: boolean; // true if this entry records a skipped dose, not a given one
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: **new** errors, not zero — every existing `VetVisit` object literal in the codebase (test fixtures, `vetVisitService.ts`'s `createVetVisit`) is now missing `followUpDate`. This is expected and intentional; Tasks 3 fixes `vetVisitService.ts` itself. List the exact files/lines that now fail so the next task's implementer isn't surprised, but do not fix them in this task — that's Task 3's job, and fixing them here would smuggle behavior changes into a "types only" task a reviewer can't cleanly gate.

- [ ] **Step 4: Commit**

```bash
git add src/types/vetVisit.ts src/types/medication.ts
git commit -m "feat: add VetVisit.followUpDate and MedicationDoseLog.skipped fields"
git push
```

---

### Task 2: The calculation module — `computeUpcoming`

**Files:**
- Create: `src/reminders/computeUpcoming.ts`
- Test: `__tests__/computeUpcoming.test.ts`

**Interfaces:**
- Consumes: `Pet` (`src/types/pet.ts`, only `id`/`name` used), `Vaccine` (`src/types/vaccine.ts`), `Medication` (`src/types/medication.ts`, including Task 1's `MedicationDoseLog.skipped`), `VetVisit` (`src/types/vetVisit.ts`, including Task 1's `followUpDate`).
- Produces: `ReminderType = 'vaccine' | 'medication' | 'vetVisitFollowUp'`; `UpcomingReminder = { id: string; petId: string; petName: string; type: ReminderType; sourceId: string; label: string; dueDate: number; overdue: boolean }`; `UpcomingInput = { pets: Pick<Pet, 'id' | 'name'>[]; vaccines: Vaccine[]; medications: Medication[]; vetVisits: VetVisit[] }`; `computeUpcoming(input: UpcomingInput, now: number, horizonDays: number): UpcomingReminder[]`; `nextMedicationDoseDue(medication: Medication, now: number): number | null`. Every later task that touches a reminder (Tasks 8, 9, 10, 11, 12, 14) imports `UpcomingReminder`/`computeUpcoming` from here — these exact names and shapes are load-bearing.

**This is the most important task in the plan.** `computeUpcoming` must have **zero import from `@react-native-firebase/*`, `react`, `react-native`, or any file under `src/navigation/` or `src/components/`** — plain data in, plain data out. `nextMedicationDoseDue` is exported separately (not just used internally) so it can be unit-tested on its own, since it carries the plan's one real judgment call: medications use a simple `{timesPerDay, intervalDays}` struct, not RFC5545 RRULE (see CLAUDE.md's "Pet records data model" note — this is the same deliberate MVP scope, extended the same way here), so "next dose due" is approximated as evenly-spaced doses `intervalDays / timesPerDay` days apart from the last logged action (given or skipped — either one moves the schedule forward), or from `startDate` if none has been logged yet.

- [ ] **Step 1: Write the failing tests — the six mandated cases plus supporting ones**

```typescript
// __tests__/computeUpcoming.test.ts
import { computeUpcoming, nextMedicationDoseDue, UpcomingInput } from '../src/reminders/computeUpcoming';
import { Vaccine } from '../src/types/vaccine';
import { Medication } from '../src/types/medication';
import { VetVisit } from '../src/types/vetVisit';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-15T00:00:00Z').getTime();

const vaccine = (overrides: Partial<Vaccine> = {}): Vaccine => ({
  id: 'vax-1', petId: 'pet-1', name: 'Rabies', dateGiven: NOW - 365 * DAY_MS, nextDueDate: NOW + 10 * DAY_MS, vetName: 'Dr. Smith',
  ...overrides,
});

const medication = (overrides: Partial<Medication> = {}): Medication => ({
  id: 'med-1', petId: 'pet-1', name: 'Amoxicillin', dosage: '250mg',
  schedule: { timesPerDay: 1, intervalDays: 1 }, startDate: NOW - 5 * DAY_MS, endDate: null, log: [],
  ...overrides,
});

const vetVisit = (overrides: Partial<VetVisit> = {}): VetVisit => ({
  id: 'visit-1', petId: 'pet-1', date: NOW - 30 * DAY_MS, reason: 'Checkup', notes: '', documentUrls: [], followUpDate: NOW + 14 * DAY_MS,
  ...overrides,
});

const emptyInput = (): UpcomingInput => ({
  pets: [{ id: 'pet-1', name: 'Neo' }], vaccines: [], medications: [], vetVisits: [],
});

describe('computeUpcoming', () => {
  it('excludes a vaccine with no due date', () => {
    const input = { ...emptyInput(), vaccines: [vaccine({ nextDueDate: null })] };
    expect(computeUpcoming(input, NOW, 30)).toEqual([]);
  });

  it('includes an overdue item and flags it overdue', () => {
    const input = { ...emptyInput(), vaccines: [vaccine({ nextDueDate: NOW - 5 * DAY_MS })] };
    const result = computeUpcoming(input, NOW, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ overdue: true, dueDate: NOW - 5 * DAY_MS, type: 'vaccine' });
  });

  it('excludes a medication that has ended', () => {
    const input = { ...emptyInput(), medications: [medication({ endDate: NOW - DAY_MS })] };
    expect(computeUpcoming(input, NOW, 30)).toEqual([]);
  });

  it('returns nothing for a pet added today with no history', () => {
    expect(computeUpcoming(emptyInput(), NOW, 30)).toEqual([]);
  });

  it('includes a due date in a different month, within the horizon', () => {
    const dueNextMonth = new Date('2026-10-03T00:00:00Z').getTime(); // 18 days out from NOW
    const input = { ...emptyInput(), vaccines: [vaccine({ nextDueDate: dueNextMonth })] };
    const result = computeUpcoming(input, NOW, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ overdue: false, dueDate: dueNextMonth });
  });

  it('handles a leap day due date without corrupting the timestamp', () => {
    const leapNow = new Date('2028-02-20T00:00:00Z').getTime();
    const leapDay = new Date('2028-02-29T12:00:00Z').getTime();
    const input = { ...emptyInput(), vaccines: [vaccine({ nextDueDate: leapDay })] };
    const result = computeUpcoming(input, leapNow, 15);
    expect(result).toHaveLength(1);
    expect(result[0].dueDate).toBe(leapDay);
    expect(result[0].overdue).toBe(false);
  });

  it('excludes a reminder due beyond the horizon', () => {
    const input = { ...emptyInput(), vaccines: [vaccine({ nextDueDate: NOW + 60 * DAY_MS })] };
    expect(computeUpcoming(input, NOW, 30)).toEqual([]);
  });

  it('always includes overdue items regardless of horizon', () => {
    const input = { ...emptyInput(), vaccines: [vaccine({ nextDueDate: NOW - 400 * DAY_MS })] };
    const result = computeUpcoming(input, NOW, 1);
    expect(result).toHaveLength(1);
    expect(result[0].overdue).toBe(true);
  });

  it('sorts overdue before upcoming, and each group by soonest first', () => {
    const input = {
      ...emptyInput(),
      vaccines: [
        vaccine({ id: 'v-upcoming-far', nextDueDate: NOW + 20 * DAY_MS }),
        vaccine({ id: 'v-overdue-old', nextDueDate: NOW - 20 * DAY_MS }),
        vaccine({ id: 'v-upcoming-near', nextDueDate: NOW + 5 * DAY_MS }),
        vaccine({ id: 'v-overdue-recent', nextDueDate: NOW - 2 * DAY_MS }),
      ],
    };
    const result = computeUpcoming(input, NOW, 30);
    expect(result.map((r) => r.sourceId)).toEqual([
      'v-overdue-old', 'v-overdue-recent', 'v-upcoming-near', 'v-upcoming-far',
    ]);
  });

  it('includes a vet-visit follow-up as its own reminder type', () => {
    const input = { ...emptyInput(), vetVisits: [vetVisit()] };
    const result = computeUpcoming(input, NOW, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'vetVisitFollowUp', overdue: false, sourceId: 'visit-1' });
  });

  it('excludes a vet visit with no follow-up date', () => {
    const input = { ...emptyInput(), vetVisits: [vetVisit({ followUpDate: null })] };
    expect(computeUpcoming(input, NOW, 30)).toEqual([]);
  });

  it('includes an upcoming medication dose computed from startDate when none logged yet', () => {
    const input = { ...emptyInput(), medications: [medication({ startDate: NOW + 3 * DAY_MS })] };
    const result = computeUpcoming(input, NOW, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'medication', dueDate: NOW + 3 * DAY_MS, overdue: false });
  });

  it('labels each reminder with the owning pet name', () => {
    const input: UpcomingInput = {
      pets: [{ id: 'pet-1', name: 'Neo' }, { id: 'pet-2', name: 'Djidji' }],
      vaccines: [vaccine({ petId: 'pet-2' })], medications: [], vetVisits: [],
    };
    const result = computeUpcoming(input, NOW, 30);
    expect(result[0].petName).toBe('Djidji');
  });
});

describe('nextMedicationDoseDue', () => {
  it('returns startDate when no doses have been logged', () => {
    const med = medication({ startDate: NOW + 2 * DAY_MS });
    expect(nextMedicationDoseDue(med, NOW)).toBe(NOW + 2 * DAY_MS);
  });

  it('returns the last dose time plus the spacing for a daily, once-a-day schedule', () => {
    const lastDose = NOW - 6 * 60 * 60 * 1000; // 6 hours ago
    const med = medication({
      schedule: { timesPerDay: 1, intervalDays: 1 },
      log: [{ givenBy: 'user-1', givenAt: lastDose }],
    });
    expect(nextMedicationDoseDue(med, NOW)).toBe(lastDose + DAY_MS);
  });

  it('spaces twice-daily doses twelve hours apart', () => {
    const lastDose = NOW - 60 * 60 * 1000;
    const med = medication({
      schedule: { timesPerDay: 2, intervalDays: 1 },
      log: [{ givenBy: 'user-1', givenAt: lastDose }],
    });
    expect(nextMedicationDoseDue(med, NOW)).toBe(lastDose + 12 * 60 * 60 * 1000);
  });

  it('advances the schedule from a skipped dose the same as a given one', () => {
    const lastAction = NOW - 2 * 60 * 60 * 1000;
    const med = medication({
      schedule: { timesPerDay: 1, intervalDays: 1 },
      log: [{ givenBy: 'user-1', givenAt: lastAction, skipped: true }],
    });
    expect(nextMedicationDoseDue(med, NOW)).toBe(lastAction + DAY_MS);
  });

  it('uses the most recent log entry, not the first', () => {
    const med = medication({
      schedule: { timesPerDay: 1, intervalDays: 1 },
      log: [
        { givenBy: 'user-1', givenAt: NOW - 5 * DAY_MS },
        { givenBy: 'user-1', givenAt: NOW - DAY_MS },
        { givenBy: 'user-1', givenAt: NOW - 3 * DAY_MS },
      ],
    });
    expect(nextMedicationDoseDue(med, NOW)).toBe(NOW - DAY_MS + DAY_MS);
  });

  it('returns null once the medication has ended', () => {
    const med = medication({ endDate: NOW - DAY_MS });
    expect(nextMedicationDoseDue(med, NOW)).toBeNull();
  });

  it('is not ended when endDate is still in the future', () => {
    const med = medication({ endDate: NOW + DAY_MS, startDate: NOW - 10 * DAY_MS, log: [] });
    expect(nextMedicationDoseDue(med, NOW)).toBe(NOW - 10 * DAY_MS);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/computeUpcoming.test.ts`
Expected: FAIL with "Cannot find module '../src/reminders/computeUpcoming'"

- [ ] **Step 3: Implement the module**

```typescript
// src/reminders/computeUpcoming.ts
//
// PURE MODULE — no imports from @react-native-firebase/*, react, react-native,
// or anything under src/navigation or src/components. This is what lets the
// exact same code run server-side later (see CLAUDE.md's "Pet profile depth"
// note and the Phase 3 spec) — do not weaken this.
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';

export type ReminderType = 'vaccine' | 'medication' | 'vetVisitFollowUp';

export interface UpcomingReminder {
  id: string; // stable across recomputation: `${type}:${sourceId}` — notification scheduling depends on this being stable
  petId: string;
  petName: string;
  type: ReminderType;
  sourceId: string; // the Vaccine/Medication/VetVisit document id this reminder came from
  label: string;
  dueDate: number; // epoch millis
  overdue: boolean;
}

export interface UpcomingInput {
  pets: Pick<Pet, 'id' | 'name'>[];
  vaccines: Vaccine[];
  medications: Medication[];
  vetVisits: VetVisit[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeUpcoming(input: UpcomingInput, now: number, horizonDays: number): UpcomingReminder[] {
  const horizonMs = now + horizonDays * DAY_MS;
  const petName = (petId: string) => input.pets.find((p) => p.id === petId)?.name ?? 'Pet';
  const reminders: UpcomingReminder[] = [];

  for (const vax of input.vaccines) {
    if (vax.nextDueDate == null || vax.nextDueDate > horizonMs) continue;
    reminders.push({
      id: `vaccine:${vax.id}`,
      petId: vax.petId,
      petName: petName(vax.petId),
      type: 'vaccine',
      sourceId: vax.id,
      label: `${vax.name} vaccine`,
      dueDate: vax.nextDueDate,
      overdue: vax.nextDueDate < now,
    });
  }

  for (const med of input.medications) {
    const dueDate = nextMedicationDoseDue(med, now);
    if (dueDate == null || dueDate > horizonMs) continue;
    reminders.push({
      id: `medication:${med.id}`,
      petId: med.petId,
      petName: petName(med.petId),
      type: 'medication',
      sourceId: med.id,
      label: `${med.name} dose`,
      dueDate,
      overdue: dueDate < now,
    });
  }

  for (const visit of input.vetVisits) {
    if (visit.followUpDate == null || visit.followUpDate > horizonMs) continue;
    reminders.push({
      id: `vetVisitFollowUp:${visit.id}`,
      petId: visit.petId,
      petName: petName(visit.petId),
      type: 'vetVisitFollowUp',
      sourceId: visit.id,
      label: visit.reason ? `Follow-up: ${visit.reason}` : 'Follow-up visit',
      dueDate: visit.followUpDate,
      overdue: visit.followUpDate < now,
    });
  }

  // Ascending due date naturally puts every overdue item (an earlier
  // timestamp) before every upcoming one, and the most-overdue item first
  // within that group — this is the fix for Plan 3's upcomingSummary.ts
  // bug, which picked the item "nearest by absolute distance" and let a
  // two-year-overdue vaccine lose to one due next month.
  return reminders.sort((a, b) => a.dueDate - b.dueDate);
}

// Medications use a simple {timesPerDay, intervalDays} struct, not RFC5545
// RRULE (CLAUDE.md's "Pet records data model" note) — this function makes
// the same deliberate MVP simplification for reminder timing: doses are
// assumed evenly spaced at (intervalDays / timesPerDay) days apart. "Next
// dose due" is either the first dose (startDate, if none logged yet) or
// the most recent logged action's time plus that spacing — a skipped dose
// advances the schedule exactly like a given one does, so skipping a dose
// doesn't leave the reminder permanently stuck in the past. A medication
// past its endDate never produces a reminder.
export function nextMedicationDoseDue(medication: Medication, now: number): number | null {
  if (medication.endDate != null && medication.endDate < now) return null;
  if (medication.log.length === 0) return medication.startDate;
  const doseSpacingMs = (medication.schedule.intervalDays / medication.schedule.timesPerDay) * DAY_MS;
  const lastAction = medication.log.reduce((latest, entry) => (entry.givenAt > latest.givenAt ? entry : latest));
  return lastAction.givenAt + doseSpacingMs;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/computeUpcoming.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/reminders/computeUpcoming.ts __tests__/computeUpcoming.test.ts
git commit -m "feat: add pure computeUpcoming reminder calculation module"
git push
```

---

### Task 3: Vet-visit follow-up date

**Files:**
- Modify: `src/pets/vetVisitService.ts`
- Modify: `src/navigation/AddVetVisitScreen.tsx`
- Modify: `firestore.rules`
- Modify: `__tests__/vetVisitService.test.ts`
- Modify: `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Consumes: `VetVisit.followUpDate` (Task 1).
- Produces: `createVetVisit(db, householdId, petId, date, reason, notes, followUpDate: number | null): Promise<VetVisit>` (signature change — one new trailing param); `updateVetVisit(db, householdId, petId, visitId, updates: Partial<VetVisit>): Promise<void>` — Task 9's `reminderActions.ts` calls this to clear `followUpDate` on Done/Skip.

- [ ] **Step 1: Update the failing tests first**

Read `__tests__/vetVisitService.test.ts` in full before editing — only the `createVetVisit` call and its expected object need the new field; add one new test for `updateVetVisit`.

```typescript
// __tests__/vetVisitService.test.ts — replace the "creates a vet visit" test body and add one new test
// (keep the existing mock setup, mockCreatedDocRef/mockVisitDocRef/etc. unchanged)

  it('creates a vet visit with an empty documentUrls array and an optional follow-up date', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const visit = await createVetVisit(fakeDb, 'h1', 'pet-1', 1000, 'Annual checkup', 'All healthy', 2000);

    expect(visit).toEqual({
      id: 'visit-1', petId: 'pet-1', date: 1000, reason: 'Annual checkup', notes: 'All healthy',
      documentUrls: [], followUpDate: 2000,
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, visit);
  });

  it('updates a vet visit, e.g. to clear a follow-up date', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateVetVisit(fakeDb, 'h1', 'pet-1', 'visit-1-existing', { followUpDate: null });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockVisitDocRef, { followUpDate: null });
  });
```

Also update the import line: `import { createVetVisit, subscribeToVetVisits, addVetVisitDocument, updateVetVisit } from '../src/pets/vetVisitService';`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/vetVisitService.test.ts`
Expected: FAIL — `createVetVisit` called with 7 args against a 6-arg signature, and `updateVetVisit` is not exported.

- [ ] **Step 3: Implement**

Read `src/pets/vetVisitService.ts` in full first. Add the new param to `createVetVisit` and a new `updateVetVisit` function; leave `subscribeToVetVisits` and `addVetVisitDocument` untouched:

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
  notes: string,
  followUpDate: number | null
): Promise<VetVisit> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'vetVisits'));
  const visit: VetVisit = { id: docRef.id, petId, date, reason, notes, documentUrls: [], followUpDate };
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
    (snap) => callback(snap.docs.map((d) => d.data() as VetVisit)),
    (error) => {
      console.error('subscribeToVetVisits listener error', error);
      callback([]);
    }
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

export async function updateVetVisit(
  db: Firestore,
  householdId: string,
  petId: string,
  visitId: string,
  updates: Partial<VetVisit>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId, 'vetVisits', visitId), updates);
}
```

- [ ] **Step 4: Update the only call site — `AddVetVisitScreen.tsx`**

Read the current file first (`src/navigation/AddVetVisitScreen.tsx`, 41 lines). Add a follow-up date field using the existing `DateField` component (`src/components/DateField.tsx`), which already supports `onClear` for an optional date — pass `null` as the default so a visit with no follow-up needed doesn't force one:

```typescript
// src/navigation/AddVetVisitScreen.tsx
import React, { useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { createVetVisit } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, ErrorText, MutedText } from '../components/ui';

export function AddVetVisitScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(Date.now());
  const [followUpDate, setFollowUpDate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      await createVetVisit(firestore, household.id, petId, date, reason, notes, followUpDate);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <TextField label="Reason for visit" value={reason} onChangeText={setReason} />
      <TextField label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
      <DateField label="Visit date" value={date} onChange={setDate} />
      <DateField label="Follow-up date" value={followUpDate} onChange={setFollowUpDate} onClear={() => setFollowUpDate(null)} />
      <MutedText>Optional — leave unset if the vet didn't ask you to come back.</MutedText>
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Add vet visit" onPress={handleSubmit} loading={loading} />
    </ScreenContainer>
  );
}
```

- [ ] **Step 5: Extend `firestore.rules`' vetVisits create allowlist**

Read `firestore.rules` lines 212-218 first (the `vetVisits` match block) to confirm exact current text before editing:

```
    match /households/{householdId}/pets/{petId}/vetVisits/{visitId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'petId', 'date', 'reason', 'notes', 'documentUrls', 'followUpDate']);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

Only the `hasOnly([...])` array changes — add `'followUpDate'` at the end. Nothing else in this block changes.

- [ ] **Step 6: Update the rules test fixture**

Read `__tests__/firestore.rules.test.ts` in full — find the vet-visit `create` test case(s) (search for `vetVisits`) and add `followUpDate: null` (or a real timestamp) to the test document literal(s) used there, matching whatever field set that test currently asserts against. Do not change any other collection's test cases in this task.

- [ ] **Step 7: Run all the tests**

Run: `npx jest __tests__/vetVisitService.test.ts` — expect PASS.
Run: `npx tsc --noEmit` — expect the `VetVisit` literal errors from Task 1 that were in `vetVisitService.ts`/`AddVetVisitScreen.tsx` to be gone; any remaining `VetVisit`-shaped errors elsewhere (e.g. test fixtures in other files) should be noted for a later task if any exist, but not fixed here unless they're in a file this task already touches.
Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"` — expect all rules tests to pass, including the updated vet-visit case. (If `java -version` fails with "Could not spawn", prepend `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin` to `PATH` for this command — see CLAUDE.md.)

- [ ] **Step 8: Commit**

```bash
git add src/pets/vetVisitService.ts src/navigation/AddVetVisitScreen.tsx firestore.rules __tests__/vetVisitService.test.ts __tests__/firestore.rules.test.ts
git commit -m "feat: add vet-visit follow-up date, updateVetVisit, and its rules allowlist entry"
git push
```

---

### Task 4: Vaccine "mark done" support

**Files:**
- Modify: `src/pets/vaccineService.ts`
- Modify: `__tests__/vaccineService.test.ts`

**Interfaces:**
- Produces: `updateVaccine(db, householdId, petId, vaccineId, updates: Partial<Vaccine>): Promise<void>` — Task 9's `reminderActions.ts` calls this with `{ nextDueDate: null }` for both Done and Skip on a vaccine reminder (see that task's note on why the two collapse to the same effect for a non-recurring field).

No rules change: `vaccines`' `update` rule (`firestore.rules` line 184) already has no field restriction, per CLAUDE.md's documented pattern — only `create` is allowlist-gated.

- [ ] **Step 1: Write the failing test**

Read `__tests__/vaccineService.test.ts` in full first. Add one new test and update the import line to include `updateVaccine`.

```typescript
// __tests__/vaccineService.test.ts — add to the existing describe block
  it('updates a vaccine, e.g. to clear nextDueDate after marking it done', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateVaccine(fakeDb, 'h1', 'pet-1', 'vax-1-existing', { nextDueDate: null });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockVaxDocRef, { nextDueDate: null });
  });
```

This test needs `mockUpdateDoc` and `mockVaxDocRef` mocks that the current file doesn't have yet (it currently only mocks `setDoc`/`onSnapshot`, since nothing calls `updateDoc` today). Update the mock setup at the top of the file to match `vetVisitService.test.ts`'s pattern (read that file for the exact shape):

```typescript
// __tests__/vaccineService.test.ts — replace the whole mock setup block at the top
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'vax-1' };
const mockVaxDocRef = { id: 'vax-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'vax-1-existing' ? mockVaxDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createVaccine, subscribeToVaccines, updateVaccine } from '../src/pets/vaccineService';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/vaccineService.test.ts`
Expected: FAIL — `updateVaccine` is not exported.

- [ ] **Step 3: Implement**

```typescript
// src/pets/vaccineService.ts
import {
  collection,
  doc,
  setDoc,
  updateDoc,
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
    (snap) => callback(snap.docs.map((d) => d.data() as Vaccine)),
    (error) => {
      console.error('subscribeToVaccines listener error', error);
      callback([]);
    }
  );
}

export async function updateVaccine(
  db: Firestore,
  householdId: string,
  petId: string,
  vaccineId: string,
  updates: Partial<Vaccine>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId, 'vaccines', vaccineId), updates);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/vaccineService.test.ts`
Expected: PASS, all cases (including the pre-existing `createVaccine`/`subscribeToVaccines` ones, unaffected by the mock setup change since `doc` still returns `mockCreatedDocRef` for any non-`'vax-1-existing'` id).

- [ ] **Step 5: Commit**

```bash
git add src/pets/vaccineService.ts __tests__/vaccineService.test.ts
git commit -m "feat: add updateVaccine for marking a vaccine reminder done"
git push
```

---

### Task 5: Medication skip support

**Files:**
- Modify: `src/pets/medicationService.ts`
- Modify: `src/navigation/MedicationListScreen.tsx`
- Modify: `__tests__/medicationService.test.ts`

**Interfaces:**
- Consumes: `MedicationDoseLog.skipped` (Task 1).
- Produces: `skipMedicationDose(db, householdId, petId, medicationId, skippedBy: string): Promise<void>` — Task 9's `reminderActions.ts` calls this for a medication reminder's Skip action.

No rules change: `skipped` is a new key inside objects appended to the already-allowlisted `log` array field, not a new top-level `Medication` field — `hasOnly()` checks top-level keys only, so `medications`' existing create allowlist (`firestore.rules` line 191) already permits this with no edit.

- [ ] **Step 1: Write the failing test**

Read `__tests__/medicationService.test.ts` in full first. Add one new test alongside the existing `logMedicationDose` one, and update the import line to include `skipMedicationDose`:

```typescript
// __tests__/medicationService.test.ts — add to the existing describe block
  it('logs a skipped dose via arrayUnion, distinct from a given one', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await skipMedicationDose(fakeDb, 'h1', 'pet-1', 'med-1-existing', 'user-1');

    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({ givenBy: 'user-1', skipped: true })
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockMedDocRef, {
      log: { __arrayUnion: [expect.objectContaining({ givenBy: 'user-1', skipped: true })] },
    });
  });
```

Update the import: `import { createMedication, subscribeToMedications, logMedicationDose, skipMedicationDose } from '../src/pets/medicationService';`

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/medicationService.test.ts`
Expected: FAIL — `skipMedicationDose` is not exported.

- [ ] **Step 3: Implement**

Read `src/pets/medicationService.ts` in full first. Add `skipMedicationDose` alongside the existing `logMedicationDose`, leaving everything else unchanged:

```typescript
// src/pets/medicationService.ts — add this function; everything else in the file stays as-is
export async function skipMedicationDose(
  db: Firestore,
  householdId: string,
  petId: string,
  medicationId: string,
  skippedBy: string
): Promise<void> {
  await updateDoc(
    doc(db, 'households', householdId, 'pets', petId, 'medications', medicationId),
    { log: arrayUnion({ givenBy: skippedBy, givenAt: Date.now(), skipped: true }) }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/medicationService.test.ts`
Expected: PASS.

- [ ] **Step 5: Add a Skip button and fix the "last given" display**

Read `src/navigation/MedicationListScreen.tsx` in full (66 lines) first. Add a `handleSkip` handler mirroring `handleMarkGiven`, a second button, and change the "last given" line to describe whichever action was most recent (given or skipped) without calling a skip a failure — this directly satisfies the Global Constraint that skipping must not read as an error:

```typescript
// src/navigation/MedicationListScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToMedications, logMedicationDose, skipMedicationDose } from '../pets/medicationService';
import { firestore } from '../firebase/config';
import { Medication } from '../types/medication';
import { ScreenContainer, Card, Button, Subtitle, MutedText, ErrorText } from '../components/ui';
import { spacing } from '../theme/theme';

export function MedicationListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!household) return;
    return subscribeToMedications(firestore, household.id, petId, setMedications);
  }, [household, petId]);

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

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Button title="Add medication" onPress={() => navigation.navigate('AddMedication', { petId })} />
      {error && <ErrorText>{error}</ErrorText>}
      <FlatList
        data={medications}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => {
          const lastAction = item.log.length > 0 ? item.log[item.log.length - 1] : null;
          return (
            <Card style={{ gap: spacing.xs }}>
              <Subtitle>{item.name} — {item.dosage}</Subtitle>
              <MutedText>
                {item.schedule.timesPerDay}x/day, every {item.schedule.intervalDays}d
              </MutedText>
              <MutedText>
                {lastAction
                  ? `${lastAction.skipped ? 'Last skipped' : 'Last given'}: ${new Date(lastAction.givenAt).toLocaleString()} by ${displayNameFor(lastAction.givenBy)}`
                  : 'No doses logged yet'}
              </MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Mark dose as given" variant="accent" onPress={() => handleMarkGiven(item.id)} style={{ flex: 1 }} />
                <Button title="Skip this dose" variant="outline" onPress={() => handleSkip(item.id)} style={{ flex: 1 }} />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={<MutedText>No medications yet.</MutedText>}
      />
    </ScreenContainer>
  );
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from this task's two files.

- [ ] **Step 7: Commit**

```bash
git add src/pets/medicationService.ts src/navigation/MedicationListScreen.tsx __tests__/medicationService.test.ts
git commit -m "feat: add skipMedicationDose and a Skip button on the medication list"
git push
```

---

### Task 6: Local settings and snooze storage (`@react-native-async-storage/async-storage`)

**Files:**
- Modify: `package.json` (new dependency)
- Create: `src/reminders/settingsStore.ts`
- Create: `src/reminders/snoozeStore.ts`
- Test: `__tests__/settingsStore.test.ts`
- Test: `__tests__/snoozeStore.test.ts`

**Interfaces:**
- Produces: `ReminderSettings = { leadDays: number; hour: number; minute: number }`; `DEFAULT_REMINDER_SETTINGS: ReminderSettings`; `getReminderSettings(): Promise<ReminderSettings>`; `setReminderSettings(settings: ReminderSettings): Promise<void>`; `getSnoozes(): Promise<Record<string, number>>`; `snoozeReminder(reminderId: string, untilMs: number): Promise<void>`; `isSnoozed(snoozes: Record<string, number>, reminderId: string, now: number): boolean` (pure, no AsyncStorage — takes the already-loaded map). Tasks 8, 9, 12, 13, 14 all import from these two files.

This is the plan's first native dependency. It does not by itself require an on-device check (its JS API is mocked in Jest, same convention as `@react-native-firebase/firestore` — see CLAUDE.md's "Architecture" section on why RNFB's native-bridge JS API is mocked rather than run in Jest, which applies identically here). The actual device rebuild happens once, after Task 7 adds the second new dependency — see Task 7's Step 5 and "Dependencies and rebuild" below.

- [ ] **Step 1: Install the dependency**

```bash
npx expo install @react-native-async-storage/async-storage
```

`npx expo install` (not plain `npm install`) picks the exact version this Expo SDK (`~57.0.22`) expects — verify `package.json` gained one new line under `dependencies`.

- [ ] **Step 2: Write the failing tests**

```typescript
// __tests__/settingsStore.test.ts
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}));

import { getReminderSettings, setReminderSettings, DEFAULT_REMINDER_SETTINGS } from '../src/reminders/settingsStore';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('settingsStore', () => {
  it('returns the defaults when nothing has been saved', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getReminderSettings()).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('returns saved settings, merged over the defaults', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ leadDays: 3 }));
    expect(await getReminderSettings()).toEqual({ ...DEFAULT_REMINDER_SETTINGS, leadDays: 3 });
  });

  it('falls back to the defaults on corrupt stored JSON', async () => {
    mockGetItem.mockResolvedValue('{not json');
    expect(await getReminderSettings()).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('saves settings as JSON under a fixed key', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await setReminderSettings({ leadDays: 2, hour: 8, minute: 30 });
    expect(mockSetItem).toHaveBeenCalledWith('reminderSettings.v1', JSON.stringify({ leadDays: 2, hour: 8, minute: 30 }));
  });
});
```

```typescript
// __tests__/snoozeStore.test.ts
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
}));

import { getSnoozes, snoozeReminder, isSnoozed } from '../src/reminders/snoozeStore';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('snoozeStore', () => {
  it('returns an empty map when nothing has been saved', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getSnoozes()).toEqual({});
  });

  it('falls back to an empty map on corrupt stored JSON', async () => {
    mockGetItem.mockResolvedValue('{not json');
    expect(await getSnoozes()).toEqual({});
  });

  it('adds a snooze to the existing map and saves the merged result', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ 'vaccine:vax-1': 1000 }));
    mockSetItem.mockResolvedValue(undefined);

    await snoozeReminder('medication:med-1', 2000);

    expect(mockSetItem).toHaveBeenCalledWith(
      'reminderSnoozes.v1',
      JSON.stringify({ 'vaccine:vax-1': 1000, 'medication:med-1': 2000 })
    );
  });
});

describe('isSnoozed', () => {
  it('is true when the snooze has not expired yet', () => {
    expect(isSnoozed({ 'vaccine:vax-1': 2000 }, 'vaccine:vax-1', 1000)).toBe(true);
  });

  it('is false once the snooze has expired', () => {
    expect(isSnoozed({ 'vaccine:vax-1': 500 }, 'vaccine:vax-1', 1000)).toBe(false);
  });

  it('is false for a reminder with no snooze entry', () => {
    expect(isSnoozed({}, 'vaccine:vax-1', 1000)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest __tests__/settingsStore.test.ts __tests__/snoozeStore.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement**

```typescript
// src/reminders/settingsStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ReminderSettings {
  leadDays: number; // how many days before the due date to notify
  hour: number; // 0-23, local device time
  minute: number; // 0-59
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { leadDays: 1, hour: 9, minute: 0 };

const STORAGE_KEY = 'reminderSettings.v1';

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_REMINDER_SETTINGS;
  try {
    return { ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function setReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
```

```typescript
// src/reminders/snoozeStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reminderSnoozes.v1';

// Map of reminder id (UpcomingReminder.id) -> epoch millis the snooze
// expires. A snoozed reminder is excluded from the visible list and from
// scheduled notifications until `now` passes its snoozedUntil.
export async function getSnoozes(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function snoozeReminder(reminderId: string, untilMs: number): Promise<void> {
  const current = await getSnoozes();
  current[reminderId] = untilMs;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function isSnoozed(snoozes: Record<string, number>, reminderId: string, now: number): boolean {
  const until = snoozes[reminderId];
  return until != null && until > now;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest __tests__/settingsStore.test.ts __tests__/snoozeStore.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/reminders/settingsStore.ts src/reminders/snoozeStore.ts __tests__/settingsStore.test.ts __tests__/snoozeStore.test.ts
git commit -m "feat: add AsyncStorage-backed reminder settings and snooze stores"
git push
```

(Skip `package-lock.json` in the `git add` if this project doesn't commit a lockfile — check `git status` first; follow whatever the existing tracked/untracked state is.)

---

### Task 7: Notification permission (`expo-notifications`)

**Files:**
- Modify: `package.json` (new dependency)
- Modify: `app.json`
- Create: `src/reminders/useNotificationPermission.ts`
- Create: `src/components/ui/PermissionBar.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `useNotificationPermission(): { granted: boolean | null; request: () => Promise<void> }` (`granted` is `null` until the first check resolves — screens should treat `null` as "don't know yet, don't show the bar"); `PermissionBar({ message: string; onPress: () => void })`. Task 8's `notificationScheduler.ts`, Task 12's `CalendarScreen.tsx`, and Task 14's `ReminderRescheduler.tsx` all consume these.

This task adds the plan's second and final new native dependency. Read "Dependencies and rebuild" below before Step 5 — the actual `expo prebuild`/device rebuild happens once here, covering both this and Task 6's `@react-native-async-storage/async-storage` in a single rebuild.

- [ ] **Step 1: Install the dependency**

```bash
npx expo install expo-notifications
```

- [ ] **Step 2: Add the config plugin**

Read `app.json` in full first (check its current `expo.plugins` array — Plan 3 added one for `@react-native-community/datetimepicker`; follow that same pattern). Add `"expo-notifications"` to the `plugins` array:

```json
// app.json — inside "expo": { "plugins": [ ... ] }, add this entry alongside whatever is already there
"expo-notifications"
```

If `expo-notifications` needs plugin config options (an icon/color for Android notifications) rather than a bare string, use the current source's own guidance: run `npx expo install expo-notifications` first (Step 1), then check `node_modules/expo-notifications/app.plugin.js`'s accepted options or the plugin's own README before deciding between a bare `"expo-notifications"` string and a `["expo-notifications", { ... }]` tuple — do not guess at config keys that may not exist in the installed version.

- [ ] **Step 3: Write the hook**

```typescript
// src/reminders/useNotificationPermission.ts
import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';

export function useNotificationPermission() {
  const [granted, setGranted] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setGranted(status === 'granted');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setGranted(status === 'granted');
  }, []);

  return { granted, request };
}
```

- [ ] **Step 4: Write the `PermissionBar` component**

```typescript
// src/components/ui/PermissionBar.tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { BodyText } from './Typography';
import { colors, spacing, radii } from '../../theme/theme';

interface PermissionBarProps {
  message: string;
  onPress: () => void;
}

export function PermissionBar({ message, onPress }: PermissionBarProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View style={{ backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm }}>
        <BodyText style={{ color: '#FFFFFF', fontWeight: '600' }}>{message}</BodyText>
      </View>
    </Pressable>
  );
}
```

```typescript
// src/components/ui/index.ts — add this line, keep everything else as-is
export { PermissionBar } from './PermissionBar';
```

- [ ] **Step 5: Rebuild the app for the device — covers both Task 6 and Task 7's new native dependencies**

```bash
npx expo prebuild --platform android
```

Per CLAUDE.md's "Local device build environment" section: this **deletes and regenerates the whole `android/` directory**, wiping `android/local.properties` — recreate it immediately:

```bash
echo sdk.dir=C\:\\Android\\Sdk > android/local.properties
```

Then rebuild and install on the connected device:

```bash
npx expo run:android
```

Expected: the app builds and launches with no new native errors. This is the same build pipeline Plans 3 and 4 used — see CLAUDE.md for `GRADLE_USER_HOME`, Metro-orphan, and adb-disconnect troubleshooting if any of those recur. If a `ninja`/CMake "Filename longer than 260 characters" error appears, the worktree is too deep — CLAUDE.md's Windows path-length section covers the fix (should not recur here, since this worktree was created at `C:\dev\plan-5-reminders-and-notifications`, not nested under `.claude/worktrees/`).

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from this task's files.

- [ ] **Step 7: Commit**

```bash
git add package.json app.json android/ src/reminders/useNotificationPermission.ts src/components/ui/PermissionBar.tsx src/components/ui/index.ts
git commit -m "feat: add expo-notifications, permission hook, and PermissionBar component"
git push
```

(`android/` is normally gitignored except for specific tracked files this project's `.gitignore` already carves out — read `.gitignore` first if `git add android/` stages more than expected, and only commit what the existing pattern from Plans 1-4's native-dependency commits already tracked. If `android/` is fully ignored, drop it from this `git add` — the regenerated directory is reproducible from `expo prebuild` and doesn't need to be committed.)

---

### Task 8: Notification timing and scheduling

**Files:**
- Create: `src/reminders/notificationTiming.ts`
- Create: `src/reminders/notificationScheduler.ts`
- Test: `__tests__/notificationTiming.test.ts`

**Interfaces:**
- Consumes: `UpcomingReminder` (Task 2), `ReminderSettings` (Task 6), `useNotificationPermission` (Task 7, used only by callers, not this task).
- Produces: `computeNotificationTime(reminder: UpcomingReminder, settings: ReminderSettings, now: number): number | null` (pure, tested); `rescheduleNotifications(reminders: UpcomingReminder[], settings: ReminderSettings): Promise<void>` (impure, device-verified only — see Step 5). Task 14's `ReminderRescheduler.tsx` is the only caller of `rescheduleNotifications`.

`computeNotificationTime` is pure and unit-tested exactly like `computeUpcoming` — it just doesn't need its own "must have zero Firebase/phone dependency" callout since it was never going to have one (it's pure date arithmetic). `rescheduleNotifications` is the one function in this plan that genuinely cannot be unit-tested, for the same reason `@react-native-firebase/firestore` calls aren't run in Jest (see CLAUDE.md's "Architecture" note) — `expo-notifications` is also a native-bridge module. It's verified on the phone in Task 14's device-check step instead.

- [ ] **Step 1: Write the failing tests for the pure timing function**

```typescript
// __tests__/notificationTiming.test.ts
import { computeNotificationTime } from '../src/reminders/notificationTiming';
import { UpcomingReminder } from '../src/reminders/computeUpcoming';
import { ReminderSettings } from '../src/reminders/settingsStore';

const DAY_MS = 24 * 60 * 60 * 1000;

const reminder = (overrides: Partial<UpcomingReminder> = {}): UpcomingReminder => ({
  id: 'vaccine:vax-1', petId: 'pet-1', petName: 'Neo', type: 'vaccine', sourceId: 'vax-1',
  label: 'Rabies vaccine', dueDate: new Date('2026-09-25T14:00:00').getTime(), overdue: false,
  ...overrides,
});

const settings: ReminderSettings = { leadDays: 1, hour: 9, minute: 0 };

describe('computeNotificationTime', () => {
  it('returns null for an overdue reminder — nothing to remind in advance of', () => {
    const now = new Date('2026-09-20T00:00:00').getTime();
    expect(computeNotificationTime(reminder({ overdue: true }), settings, now)).toBeNull();
  });

  it('fires one lead day before the due date, at the configured time', () => {
    const now = new Date('2026-09-20T00:00:00').getTime();
    const result = computeNotificationTime(reminder(), settings, now);
    const expected = new Date('2026-09-24T09:00:00').getTime();
    expect(result).toBe(expected);
  });

  it('returns null when the computed trigger time has already passed', () => {
    const now = new Date('2026-09-24T10:00:00').getTime(); // already past today's 09:00
    expect(computeNotificationTime(reminder(), settings, now)).toBeNull();
  });

  it('respects a zero lead-day setting — fires on the due date itself, at the configured time', () => {
    const now = new Date('2026-09-20T00:00:00').getTime();
    const zeroLead: ReminderSettings = { leadDays: 0, hour: 9, minute: 0 };
    const result = computeNotificationTime(reminder(), zeroLead, now);
    const expected = new Date('2026-09-25T09:00:00').getTime();
    expect(result).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/notificationTiming.test.ts`
Expected: FAIL with "Cannot find module '../src/reminders/notificationTiming'"

- [ ] **Step 3: Implement the pure timing function**

```typescript
// src/reminders/notificationTiming.ts
import { UpcomingReminder } from './computeUpcoming';
import { ReminderSettings } from './settingsStore';

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns the epoch millis a local notification should fire at for this
// reminder, or null if it shouldn't be scheduled at all — either it's
// already overdue (nothing to remind "in advance" of; overdue items only
// surface in the in-app list), or the computed trigger time has already
// passed by the time this runs.
export function computeNotificationTime(reminder: UpcomingReminder, settings: ReminderSettings, now: number): number | null {
  if (reminder.overdue) return null;
  const targetDay = new Date(reminder.dueDate - settings.leadDays * DAY_MS);
  const trigger = new Date(
    targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(),
    settings.hour, settings.minute, 0, 0
  ).getTime();
  return trigger > now ? trigger : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/notificationTiming.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the scheduler (not unit-tested — verified on-device in Task 14)**

Before writing this, check the installed `expo-notifications` version's TypeScript definitions for the exact scheduling-trigger shape (`node_modules/expo-notifications/build/Notifications.types.d.ts` or wherever `scheduleNotificationAsync`'s trigger parameter is typed) — the API has changed between versions, and CLAUDE.md's own rule ("always copy from current source files, never from plan text") applies here just as much as it does to this codebase's own files. The shape below is expected to be correct for the SDK 57-compatible version `npx expo install` resolves, but verify before finalizing:

```typescript
// src/reminders/notificationScheduler.ts
import * as Notifications from 'expo-notifications';
import { UpcomingReminder } from './computeUpcoming';
import { ReminderSettings } from './settingsStore';
import { computeNotificationTime } from './notificationTiming';

// Cancels every previously scheduled reminder notification and reschedules
// from scratch against the current reminder list — simplest correct way to
// satisfy "recomputed and rescheduled whenever the data changes" without a
// separate diffing/cancellation-tracking mechanism.
export async function rescheduleNotifications(reminders: UpcomingReminder[], settings: ReminderSettings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  for (const reminder of reminders) {
    const trigger = computeNotificationTime(reminder, settings, now);
    if (trigger == null) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.petName,
        body: `${reminder.label} is coming up`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
  }
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. If the trigger shape from Step 5 doesn't match the installed version's types, this is where that surfaces — fix it against the real type definitions, not by guessing again.

- [ ] **Step 7: Commit**

```bash
git add src/reminders/notificationTiming.ts src/reminders/notificationScheduler.ts __tests__/notificationTiming.test.ts
git commit -m "feat: add pure notification timing and expo-notifications scheduler"
git push
```

---

### Task 9: Reminder actions — Done, Skip, Snooze

**Files:**
- Create: `src/reminders/reminderActions.ts`
- Test: `__tests__/reminderActions.test.ts`

**Interfaces:**
- Consumes: `updateVaccine` (Task 4), `logMedicationDose`/`skipMedicationDose` (Task 5), `updateVetVisit` (Task 3), `snoozeReminder` (Task 6).
- Produces: `markDone(db, householdId, reminder: UpcomingReminder, userId: string): Promise<void>`; `skip(db, householdId, reminder: UpcomingReminder, userId: string): Promise<void>`; `snooze(reminder: UpcomingReminder, days: number): Promise<void>`. Task 12's `CalendarScreen.tsx` wires its Done/Skip/Snooze buttons directly to these three functions.

A vaccine and a vet-visit follow-up are each a single non-recurring dated field with no "next occurrence" — there's nothing for Skip to defer to that Done doesn't already resolve the same way, so both actions clear the field (`nextDueDate`/`followUpDate` → `null`) for those two types. The distinction only has real teeth for medications, where Skip appends a dose-log entry flagged `skipped: true` (visible in `MedicationListScreen`'s history, per Task 5) instead of a given one, while Done logs a normal given dose. This collapsing is a deliberate scope simplification, not an oversight — see "Assumptions and open questions" below for the tradeoff if the owner later wants Skip and Done to diverge for vaccines/follow-ups too (e.g. Skip leaving the date untouched so it reappears as overdue).

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/reminderActions.test.ts
const mockUpdateVaccine = jest.fn();
const mockLogMedicationDose = jest.fn();
const mockSkipMedicationDose = jest.fn();
const mockUpdateVetVisit = jest.fn();
const mockSnoozeReminder = jest.fn();

jest.mock('../src/pets/vaccineService', () => ({ updateVaccine: (...args: unknown[]) => mockUpdateVaccine(...args) }));
jest.mock('../src/pets/medicationService', () => ({
  logMedicationDose: (...args: unknown[]) => mockLogMedicationDose(...args),
  skipMedicationDose: (...args: unknown[]) => mockSkipMedicationDose(...args),
}));
jest.mock('../src/pets/vetVisitService', () => ({ updateVetVisit: (...args: unknown[]) => mockUpdateVetVisit(...args) }));
jest.mock('../src/reminders/snoozeStore', () => ({ snoozeReminder: (...args: unknown[]) => mockSnoozeReminder(...args) }));

import { markDone, skip, snooze } from '../src/reminders/reminderActions';
import { UpcomingReminder } from '../src/reminders/computeUpcoming';

const fakeDb = {} as any;

const reminder = (type: UpcomingReminder['type'], sourceId = 'src-1'): UpcomingReminder => ({
  id: `${type}:${sourceId}`, petId: 'pet-1', petName: 'Neo', type, sourceId,
  label: 'test', dueDate: 1000, overdue: false,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('markDone', () => {
  it('clears a vaccine\'s nextDueDate', async () => {
    await markDone(fakeDb, 'h1', reminder('vaccine'), 'user-1');
    expect(mockUpdateVaccine).toHaveBeenCalledWith(fakeDb, 'h1', 'pet-1', 'src-1', { nextDueDate: null });
  });

  it('logs a given dose for a medication', async () => {
    await markDone(fakeDb, 'h1', reminder('medication'), 'user-1');
    expect(mockLogMedicationDose).toHaveBeenCalledWith(fakeDb, 'h1', 'pet-1', 'src-1', 'user-1');
  });

  it('clears a vet visit\'s followUpDate', async () => {
    await markDone(fakeDb, 'h1', reminder('vetVisitFollowUp'), 'user-1');
    expect(mockUpdateVetVisit).toHaveBeenCalledWith(fakeDb, 'h1', 'pet-1', 'src-1', { followUpDate: null });
  });
});

describe('skip', () => {
  it('clears a vaccine\'s nextDueDate, same as done', async () => {
    await skip(fakeDb, 'h1', reminder('vaccine'), 'user-1');
    expect(mockUpdateVaccine).toHaveBeenCalledWith(fakeDb, 'h1', 'pet-1', 'src-1', { nextDueDate: null });
  });

  it('logs a skipped dose for a medication, not a given one', async () => {
    await skip(fakeDb, 'h1', reminder('medication'), 'user-1');
    expect(mockSkipMedicationDose).toHaveBeenCalledWith(fakeDb, 'h1', 'pet-1', 'src-1', 'user-1');
    expect(mockLogMedicationDose).not.toHaveBeenCalled();
  });

  it('clears a vet visit\'s followUpDate, same as done', async () => {
    await skip(fakeDb, 'h1', reminder('vetVisitFollowUp'), 'user-1');
    expect(mockUpdateVetVisit).toHaveBeenCalledWith(fakeDb, 'h1', 'pet-1', 'src-1', { followUpDate: null });
  });
});

describe('snooze', () => {
  it('stores a snooze until now + N days', async () => {
    const realNow = Date.now;
    Date.now = () => 1_000_000;
    await snooze(reminder('vaccine'), 2);
    expect(mockSnoozeReminder).toHaveBeenCalledWith('vaccine:src-1', 1_000_000 + 2 * 24 * 60 * 60 * 1000);
    Date.now = realNow;
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/reminderActions.test.ts`
Expected: FAIL with "Cannot find module '../src/reminders/reminderActions'"

- [ ] **Step 3: Implement**

```typescript
// src/reminders/reminderActions.ts
import type { Firestore } from '@react-native-firebase/firestore';
import { UpcomingReminder } from './computeUpcoming';
import { updateVaccine } from '../pets/vaccineService';
import { logMedicationDose, skipMedicationDose } from '../pets/medicationService';
import { updateVetVisit } from '../pets/vetVisitService';
import { snoozeReminder } from './snoozeStore';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function markDone(db: Firestore, householdId: string, reminder: UpcomingReminder, userId: string): Promise<void> {
  switch (reminder.type) {
    case 'vaccine':
      await updateVaccine(db, householdId, reminder.petId, reminder.sourceId, { nextDueDate: null });
      return;
    case 'medication':
      await logMedicationDose(db, householdId, reminder.petId, reminder.sourceId, userId);
      return;
    case 'vetVisitFollowUp':
      await updateVetVisit(db, householdId, reminder.petId, reminder.sourceId, { followUpDate: null });
      return;
  }
}

export async function skip(db: Firestore, householdId: string, reminder: UpcomingReminder, userId: string): Promise<void> {
  switch (reminder.type) {
    case 'vaccine':
      await updateVaccine(db, householdId, reminder.petId, reminder.sourceId, { nextDueDate: null });
      return;
    case 'medication':
      await skipMedicationDose(db, householdId, reminder.petId, reminder.sourceId, userId);
      return;
    case 'vetVisitFollowUp':
      await updateVetVisit(db, householdId, reminder.petId, reminder.sourceId, { followUpDate: null });
      return;
  }
}

export async function snooze(reminder: UpcomingReminder, days: number): Promise<void> {
  await snoozeReminder(reminder.id, Date.now() + days * DAY_MS);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/reminderActions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reminders/reminderActions.ts __tests__/reminderActions.test.ts
git commit -m "feat: add Done/Skip/Snooze reminder action dispatcher"
git push
```

---

### Task 10: Multi-pet reminders hook

**Files:**
- Create: `src/reminders/useUpcomingReminders.ts`

**Interfaces:**
- Consumes: `computeUpcoming` (Task 2), `subscribeToVaccines`/`subscribeToMedications`/`subscribeToVetVisits` (existing services), `Pet` (`src/types/pet.ts`).
- Produces: `useUpcomingReminders(pets: Pet[]): UpcomingReminder[]`. Task 12's `CalendarScreen.tsx` and Task 14's `ReminderRescheduler.tsx` both call this with the household's active pets.

This is the impure shell around `computeUpcoming` — it fans out one Firestore listener per pet per record type (vaccines, medications, vet visits), same pattern as `HomeScreen.tsx`'s existing per-pet `subscribeToVaccines` call, just generalized across every active pet at once instead of one card at a time. Not unit-tested: it's a React hook wired directly to Firestore listeners, the same category as `HomeScreen.tsx`/`PetCard` in this codebase, which also has no direct test — verified via `tsc` and the device check in Task 14.

- [ ] **Step 1: Implement**

```typescript
// src/reminders/useUpcomingReminders.ts
import { useEffect, useMemo, useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';
import { computeUpcoming, UpcomingReminder } from './computeUpcoming';

// How far ahead the in-app reminders list looks. Separate from a
// notification's lead time (settingsStore.ts) — this just bounds how much
// the list itself shows; overdue items are always included regardless.
const REMINDERS_HORIZON_DAYS = 30;

export function useUpcomingReminders(pets: Pet[]): UpcomingReminder[] {
  const { household } = useHousehold();
  const [vaccinesByPet, setVaccinesByPet] = useState<Record<string, Vaccine[]>>({});
  const [medicationsByPet, setMedicationsByPet] = useState<Record<string, Medication[]>>({});
  const [vetVisitsByPet, setVetVisitsByPet] = useState<Record<string, VetVisit[]>>({});

  const petIdsKey = pets.map((p) => p.id).join(',');

  useEffect(() => {
    if (!household) return;
    const unsubscribes = pets.flatMap((pet) => [
      subscribeToVaccines(firestore, household.id, pet.id, (vs) =>
        setVaccinesByPet((prev) => ({ ...prev, [pet.id]: vs }))
      ),
      subscribeToMedications(firestore, household.id, pet.id, (ms) =>
        setMedicationsByPet((prev) => ({ ...prev, [pet.id]: ms }))
      ),
      subscribeToVetVisits(firestore, household.id, pet.id, (vv) =>
        setVetVisitsByPet((prev) => ({ ...prev, [pet.id]: vv }))
      ),
    ]);
    return () => unsubscribes.forEach((unsub) => unsub());
    // petIdsKey (not `pets` itself) is the dependency on purpose — `pets`
    // is a new array reference on every parent render even when its
    // contents haven't changed, which would tear down and recreate every
    // listener needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, petIdsKey]);

  return useMemo(() => {
    const allVaccines = pets.flatMap((p) => vaccinesByPet[p.id] ?? []);
    const allMedications = pets.flatMap((p) => medicationsByPet[p.id] ?? []);
    const allVetVisits = pets.flatMap((p) => vetVisitsByPet[p.id] ?? []);
    return computeUpcoming(
      { pets, vaccines: allVaccines, medications: allMedications, vetVisits: allVetVisits },
      Date.now(),
      REMINDERS_HORIZON_DAYS
    );
  }, [pets, vaccinesByPet, medicationsByPet, vetVisitsByPet]);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/reminders/useUpcomingReminders.ts
git commit -m "feat: add useUpcomingReminders multi-pet Firestore fan-out hook"
git push
```

---

### Task 11: Replace `upcomingSummary.ts` with `computeUpcoming`

**Files:**
- Delete: `src/pets/upcomingSummary.ts`
- Delete: `__tests__/upcomingSummary.test.ts`
- Modify: `src/navigation/HomeScreen.tsx`

**Interfaces:**
- Consumes: `computeUpcoming` (Task 2), `subscribeToMedications`, `subscribeToVetVisits` (existing services, not previously used by this file).

`HomeScreen.tsx`'s `PetCard` is `upcomingSummary.ts`'s only caller. This task closes the exact gap NEXTSTEPS.md's Plan 3 section flags: `getNextDue`'s "nearest by absolute distance" bug, which let a vaccine overdue by two years lose to one due next month and vanish from the card entirely. `computeUpcoming`'s ascending sort (Task 2) doesn't have this bug by construction.

- [ ] **Step 1: Delete the old module and its test**

```bash
git rm src/pets/upcomingSummary.ts __tests__/upcomingSummary.test.ts
```

- [ ] **Step 2: Migrate `PetCard`**

Read `src/navigation/HomeScreen.tsx` in full first (93 lines). `PetCard` currently only subscribes to vaccines; it needs medications and vet visits too, to feed `computeUpcoming` the same three record types every other reminder surface uses. Show only the single nearest item on the card (one line of space), same as before — `computeUpcoming`'s own sort already puts the most urgent item first, so this is just "take the first result":

```typescript
// src/navigation/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Image, View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { computeUpcoming } from '../reminders/computeUpcoming';
import { usePetSelection, reconcileSelection } from '../selection/PetSelectionContext';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';
import { ScreenContainer, Card, Button, Subtitle, BodyText, MutedText, PetSelector } from '../components/ui';
import { colors, spacing } from '../theme/theme';
import { petColor } from '../theme/petColors';
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';

function speciesAndAge(pet: Pet): string {
  if (pet.birthDate == null) return speciesDisplay(pet);
  const ageMs = Date.now() - pet.birthDate;
  const years = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  return `${speciesDisplay(pet)}${years >= 0 ? ` · ${years} yr` : ''}`;
}

function PetCard({ pet, navigation }: { pet: Pet; navigation: any }) {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [vetVisits, setVetVisits] = useState<VetVisit[]>([]);
  const { household } = useHousehold();

  useEffect(() => {
    if (!household) return;
    const unsubVaccines = subscribeToVaccines(firestore, household.id, pet.id, setVaccines);
    const unsubMedications = subscribeToMedications(firestore, household.id, pet.id, setMedications);
    const unsubVetVisits = subscribeToVetVisits(firestore, household.id, pet.id, setVetVisits);
    return () => {
      unsubVaccines();
      unsubMedications();
      unsubVetVisits();
    };
  }, [household, pet.id]);

  const nextDue = computeUpcoming(
    { pets: [pet], vaccines, medications, vetVisits },
    Date.now(),
    30
  )[0] ?? null;

  return (
    <Pressable
      onPress={() => navigation.navigate('PetHome', { petId: pet.id })}
      accessibilityRole="button"
      accessibilityLabel={pet.name}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderLeftWidth: 4, borderLeftColor: petColor(pet) }}>
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
              {nextDue.label} {nextDue.overdue ? 'overdue' : 'due'}
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

- [ ] **Step 3: Verify it compiles and the rest of the suite still passes**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx jest`
Expected: the `upcomingSummary.test.ts` suite is gone (deleted in Step 1); everything else that passed before still passes.

- [ ] **Step 4: Commit**

```bash
git add -A src/pets/upcomingSummary.ts __tests__/upcomingSummary.test.ts src/navigation/HomeScreen.tsx
git commit -m "fix: replace upcomingSummary's nearest-date bug with computeUpcoming on the home screen"
git push
```

---

### Task 12: The reminders screen (`CalendarScreen.tsx`)

**Files:**
- Modify: `src/navigation/CalendarScreen.tsx`

**Interfaces:**
- Consumes: `useUpcomingReminders` (Task 10), `useNotificationPermission`/`PermissionBar` (Task 7), `markDone`/`skip`/`snooze` (Task 9), `getSnoozes`/`isSnoozed` (Task 6), `GuidedEmptyState` (existing, Plan 4), `activePets` (existing, Plan 4).

This replaces the "coming soon" placeholder with the actual live reminders list — Done/Skip/Snooze on each item, the permission bar at the top, and a guided empty state when there's nothing due. It is deliberately **not** the real week/month calendar (Plan 6's job) — the file keeps its name and tab position because the execution pack pairs "reminders and calendar screens" as needing the same permission bar, and Plan 6 is expected to grow week/month views around this list rather than replace it outright (see "Assumptions and open questions" below).

- [ ] **Step 1: Implement**

```typescript
// src/navigation/CalendarScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { useNotificationPermission } from '../reminders/useNotificationPermission';
import { markDone, skip, snooze } from '../reminders/reminderActions';
import { getSnoozes, isSnoozed } from '../reminders/snoozeStore';
import { Pet } from '../types/pet';
import { UpcomingReminder } from '../reminders/computeUpcoming';
import {
  ScreenContainer, Card, Button, Title, Subtitle, MutedText, PermissionBar, GuidedEmptyState,
} from '../components/ui';
import { colors, spacing } from '../theme/theme';

export function CalendarScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { granted, request } = useNotificationPermission();
  const [pets, setPets] = useState<Pet[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    getSnoozes().then(setSnoozes);
  }, []);

  const reminders = useUpcomingReminders(pets);
  const now = Date.now();
  const visibleReminders = reminders.filter((r) => !isSnoozed(snoozes, r.id, now));

  const refreshSnoozes = () => getSnoozes().then(setSnoozes);

  const handleDone = async (reminder: UpcomingReminder) => {
    if (!household || !user) return;
    await markDone(firestore, household.id, reminder, user.uid);
  };

  const handleSkip = async (reminder: UpcomingReminder) => {
    if (!household || !user) return;
    await skip(firestore, household.id, reminder, user.uid);
  };

  const handleSnooze = async (reminder: UpcomingReminder) => {
    await snooze(reminder, 3);
    refreshSnoozes();
  };

  return (
    <ScreenContainer style={{ flex: 1 }}>
      {granted === false && (
        <PermissionBar message="Reminders need notifications. Tap to enable." onPress={request} />
      )}
      <Title>Reminders</Title>
      <MutedText>Every vaccine, dose, and follow-up coming up across your pets.</MutedText>
      <FlatList
        data={visibleReminders}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.xs }}>
            <Subtitle>{item.petName} — {item.label}</Subtitle>
            <MutedText style={item.overdue ? { color: colors.danger, fontWeight: '600' } : undefined}>
              {new Date(item.dueDate).toLocaleDateString()} {item.overdue ? '(overdue)' : ''}
            </MutedText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Done" variant="accent" onPress={() => handleDone(item)} style={{ flex: 1 }} />
              <Button title="Skip" variant="outline" onPress={() => handleSkip(item)} style={{ flex: 1 }} />
              <Button title="Snooze 3d" variant="outline" onPress={() => handleSnooze(item)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="🔔"
            title="Nothing due right now"
            message="Vaccines, medication doses, and vet follow-ups will show up here as they come due."
            actionLabel="Reminder settings"
            onAction={() => navigation.navigate('ReminderSettings')}
          />
        }
      />
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. (`navigation.navigate('ReminderSettings')` will not yet resolve to a real route — that's Task 13 — but `tsc` doesn't check React Navigation route names, only that `navigation` is typed permissively as `any`, matching every other screen's `{ navigation }: any` pattern in this codebase, so this compiles cleanly even before Task 13 registers the route.)

- [ ] **Step 3: Commit**

```bash
git add src/navigation/CalendarScreen.tsx
git commit -m "feat: build the live reminders list with permission bar and Done/Skip/Snooze"
git push
```

---

### Task 13: Reminder settings screen

**Files:**
- Create: `src/navigation/ReminderSettingsScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `getReminderSettings`/`setReminderSettings`/`DEFAULT_REMINDER_SETTINGS` (Task 6).
- Produces: the `ReminderSettings` route, registered as a sibling of `Main` on the root stack (a new navigation pattern for this app — see the note below).

`RootNavigator.tsx`'s `Stack.Navigator` currently renders exactly one of `SignIn`/`SignUp`, `Main`, or `HouseholdSetup` depending on auth/household state — there is nowhere today for a screen reached from *inside* a tab (like `CalendarScreen`, nested under `MainTabs`) to navigate to something that isn't itself nested in that tab's own stack. React Navigation resolves a `navigate('RouteName')` call by walking up through parent navigators until one recognizes the route name, so registering `ReminderSettings` as a sibling of `Main` (rather than nested inside `MainNavigator`'s Pets-tab stack, which would be the wrong place — this setting isn't about any one pet) makes `CalendarScreen`'s `navigation.navigate('ReminderSettings')` call (Task 12) resolve correctly with no further wiring.

- [ ] **Step 1: Implement the screen**

Time-of-day needs a "time" picker, not the shared `DateField` component (which is hardcoded to `mode="date"` and used by many other screens that must keep behaving as a date picker) — use `@react-native-community/datetimepicker` directly with `mode="time"`, already a project dependency since Plan 2.

```typescript
// src/navigation/ReminderSettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getReminderSettings, setReminderSettings, ReminderSettings, DEFAULT_REMINDER_SETTINGS } from '../reminders/settingsStore';
import { ScreenContainer, Title, Chip, Button, MutedText } from '../components/ui';
import { colors, radii, spacing } from '../theme/theme';

const LEAD_DAY_OPTIONS = [0, 1, 3, 7];

export function ReminderSettingsScreen() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getReminderSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    await setReminderSettings(settings);
    setSaved(true);
  };

  if (!loaded) {
    return (
      <ScreenContainer>
        <MutedText>Loading…</MutedText>
      </ScreenContainer>
    );
  }

  const timeLabel = new Date(2000, 0, 1, settings.hour, settings.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ScreenContainer scroll>
      <Title>How far in advance?</Title>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {LEAD_DAY_OPTIONS.map((days) => (
          <Chip
            key={days}
            label={days === 0 ? 'On the day' : `${days} day${days > 1 ? 's' : ''} before`}
            selected={settings.leadDays === days}
            onPress={() => { setSettings((s) => ({ ...s, leadDays: days })); setSaved(false); }}
          />
        ))}
      </View>

      <Title>What time of day?</Title>
      <Pressable
        onPress={() => setShowTimePicker(true)}
        style={{
          minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md,
          borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
        }}
      >
        <Text style={{ fontSize: 16, color: colors.text }}>{timeLabel}</Text>
      </Pressable>
      {showTimePicker && (
        <DateTimePicker
          value={new Date(2000, 0, 1, settings.hour, settings.minute)}
          mode="time"
          display="default"
          onChange={(_event, selected) => {
            setShowTimePicker(false);
            if (selected) {
              setSettings((s) => ({ ...s, hour: selected.getHours(), minute: selected.getMinutes() }));
              setSaved(false);
            }
          }}
        />
      )}

      <MutedText>
        Reminders are scheduled on this phone, from what this phone has seen. If you use the app on
        more than one phone, each one keeps its own reminder schedule.
      </MutedText>

      <Button title={saved ? 'Saved' : 'Save'} onPress={handleSave} disabled={saved} />
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Register the route**

Read `src/navigation/RootNavigator.tsx` in full first (37 lines). Add `ReminderSettingsScreen` as a sibling of `Main`, only reachable once a household exists (matching where `Main` itself is gated):

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
import { ReminderSettingsScreen } from './ReminderSettingsScreen';
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
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="ReminderSettings"
              component={ReminderSettingsScreen}
              options={{ headerShown: true, title: 'Reminder settings', headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }}
            />
          </>
        ) : (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/ReminderSettingsScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: add reminder settings screen (lead time, time of day, honesty line)"
git push
```

---

### Task 14: Reschedule notifications when data or settings change

**Files:**
- Create: `src/reminders/ReminderRescheduler.tsx`
- Modify: `src/navigation/RootNavigator.tsx`
- Modify: `src/navigation/ReminderSettingsScreen.tsx`

**Interfaces:**
- Consumes: `useUpcomingReminders` (Task 10), `rescheduleNotifications` (Task 8), `getReminderSettings` (Task 6), `useNotificationPermission` (Task 7), `subscribeToPets`/`activePets` (existing).

This is the final integration task: an invisible component mounted once at the root (not inside any one tab, so it works no matter which screen is focused) that recomputes reminders whenever the underlying Firestore data changes and reschedules local notifications whenever that list — or the saved settings — changes. It also needs `ReminderSettingsScreen`'s Save button to trigger an immediate reschedule, since changing "how far in advance" should take effect right away, not wait for the next unrelated data change.

- [ ] **Step 1: Implement `ReminderRescheduler`**

```typescript
// src/reminders/ReminderRescheduler.tsx
import { useEffect, useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { useUpcomingReminders } from './useUpcomingReminders';
import { useNotificationPermission } from './useNotificationPermission';
import { getReminderSettings, ReminderSettings, DEFAULT_REMINDER_SETTINGS } from './settingsStore';
import { rescheduleNotifications } from './notificationScheduler';

// Renders nothing — exists purely to keep local notifications in sync with
// live data. Mounted once at the root (RootNavigator), not inside any one
// tab/screen, so it keeps working regardless of which screen is focused.
export function ReminderRescheduler(): null {
  const { household } = useHousehold();
  const { granted } = useNotificationPermission();
  const [pets, setPets] = useState<Pet[]>([]);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    getReminderSettings().then(setSettings);
  }, []);

  const reminders = useUpcomingReminders(pets);

  useEffect(() => {
    if (!granted) return;
    rescheduleNotifications(reminders, settings);
  }, [granted, reminders, settings]);

  return null;
}
```

- [ ] **Step 2: Mount it in `RootNavigator`**

Read the current `src/navigation/RootNavigator.tsx` (as it stands after Task 13) before editing. Mount `ReminderRescheduler` as a sibling of `<Stack.Navigator>`, inside `<NavigationContainer>`, gated on `household` the same way `Main` is:

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
import { ReminderSettingsScreen } from './ReminderSettingsScreen';
import { ReminderRescheduler } from '../reminders/ReminderRescheduler';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, initializing } = useAuth();
  const { household, loading: householdLoading } = useHousehold();

  if (initializing) return null;
  if (user && householdLoading) return null;

  return (
    <NavigationContainer>
      {household && <ReminderRescheduler />}
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {!user ? (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : household ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="ReminderSettings"
              component={ReminderSettingsScreen}
              options={{ headerShown: true, title: 'Reminder settings', headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }}
            />
          </>
        ) : (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: Make Save trigger an immediate reschedule**

Read the current `src/navigation/ReminderSettingsScreen.tsx` (as it stands after Task 13). `ReminderRescheduler`'s own `useEffect` already reacts to a `settings` state it loads independently via `getReminderSettings()` — but that only re-runs on remount, not when another screen calls `setReminderSettings()`. Rather than adding cross-component state syncing, have the settings screen reschedule directly after saving, using the same pets/reminders it can compute the same way `ReminderRescheduler` does — simplest correct fix without introducing global state:

```typescript
// src/navigation/ReminderSettingsScreen.tsx — add these imports and change handleSave only;
// everything else in the file (state, the Chip/time-picker UI, the honesty line) stays as Task 13 left it
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { computeUpcoming } from '../reminders/computeUpcoming';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { rescheduleNotifications } from '../reminders/notificationScheduler';

// Inside the component, alongside the existing state:
const { household } = useHousehold();

// Replace handleSave with a version that reschedules immediately after
// saving — a one-shot fetch-and-compute rather than reusing the live
// useUpcomingReminders hook, since this screen only needs this once, on
// save, not a standing subscription for as long as it's mounted.
const handleSave = async () => {
  await setReminderSettings(settings);
  setSaved(true);
  if (!household) return;
  const pets = activePets(await new Promise<Pet[]>((resolve) => {
    const unsub = subscribeToPets(firestore, household.id, (p) => { resolve(p); unsub(); });
  }));
  const [vaccines, medications, vetVisits] = await Promise.all([
    Promise.all(pets.map((p) => new Promise<Vaccine[]>((resolve) => {
      const unsub = subscribeToVaccines(firestore, household.id, p.id, (v) => { resolve(v); unsub(); });
    }))).then((lists) => lists.flat()),
    Promise.all(pets.map((p) => new Promise<Medication[]>((resolve) => {
      const unsub = subscribeToMedications(firestore, household.id, p.id, (m) => { resolve(m); unsub(); });
    }))).then((lists) => lists.flat()),
    Promise.all(pets.map((p) => new Promise<VetVisit[]>((resolve) => {
      const unsub = subscribeToVetVisits(firestore, household.id, p.id, (v) => { resolve(v); unsub(); });
    }))).then((lists) => lists.flat()),
  ]);
  const reminders = computeUpcoming({ pets, vaccines, medications, vetVisits }, Date.now(), 30);
  await rescheduleNotifications(reminders, settings);
};
```

Add these type imports alongside the file's existing `ReminderSettings`/`DEFAULT_REMINDER_SETTINGS` import from `settingsStore.ts`:

```typescript
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: every suite passes except `firestore.rules.test.ts` under plain `npx jest` (needs the emulator — expected, per CLAUDE.md).
Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"`
Expected: all rules tests pass, including Task 3's updated vet-visit case.

- [ ] **Step 6: On the phone, verify the whole feature end to end**

This is the one part of this plan that genuinely cannot be verified any other way — `expo-notifications`, AsyncStorage, and Firestore are all native-bridge modules with no meaningful Jest coverage for their actual runtime behavior. Rebuild if needed (`npx expo run:android`, recreating `android/local.properties` first if a `prebuild` ran since the last build — see CLAUDE.md), then, per the execution pack's own "on the phone, look for" checklist for this phase:

- Deny the notification permission deliberately (system prompt → Deny). Confirm the app stays fully usable and the permission bar on the Calendar tab explains how to fix it (tapping it re-requests).
- Grant the permission. Add a vaccine with a `nextDueDate` a day or two out, confirm it appears in the Calendar tab's reminders list, not overdue.
- Change the reminder settings to a lead time/time of day that puts the trigger a minute or two in the future, save, and confirm a system notification actually arrives around that time.
- Skip a medication dose from `MedicationListScreen`. Confirm the "last skipped" line appears (not deleted, not styled as an error) and the next reminder's due date reflects the skip.
- Mark a reminder Done from the Calendar tab and confirm it disappears from the list (and, for a vaccine/follow-up, that the underlying record's date field is now cleared when viewed on the pet's own screen).
- Snooze a reminder and confirm it disappears from the list immediately, without touching the underlying record.
- With two phones/accounts in the same household (or one phone, checked before/after), add a vaccine on one and confirm the other's reminders list updates live — this only proves the Firestore layer stayed live end to end; the *notification itself* firing on the un-added-to phone is out of scope by design (see the honesty line in settings).

- [ ] **Step 7: Commit**

```bash
git add src/reminders/ReminderRescheduler.tsx src/navigation/RootNavigator.tsx src/navigation/ReminderSettingsScreen.tsx
git commit -m "feat: reschedule notifications on data and settings changes, mounted at the app root"
git push
```

---

## Dependencies and rebuild

Two new native dependencies, both requiring `npx expo prebuild --platform android` + `npx expo run:android` (see CLAUDE.md's "Local device build environment" for the full environment setup this needs — Java, Android SDK, `GRADLE_USER_HOME`, `android/local.properties` recreation after every prebuild):

1. `@react-native-async-storage/async-storage` (Task 6) — backs `settingsStore.ts` and `snoozeStore.ts`. Its JS API is mocked in Jest (same convention as `@react-native-firebase/firestore`); no on-device check needed for this dependency in isolation.
2. `expo-notifications` (Task 7) — backs `useNotificationPermission.ts` and `notificationScheduler.ts`. Needs an `app.json` config plugin entry and is the dependency that actually requires the device rebuild — **do the rebuild once, in Task 7, after both dependencies are installed**, rather than rebuilding twice.

No other new dependency. `@react-native-community/datetimepicker` (already a dependency since Plan 2) covers the settings screen's time-of-day picker via `mode="time"` — no new date/time library needed.

## Security-rules changes

Exactly one: `firestore.rules`' `vetVisits` `create` allowlist gains `'followUpDate'` (Task 3). Nothing else changes:
- `VetVisit.followUpDate` is only ever cleared via `updateVetVisit`'s `updateDoc` call (Task 9's `markDone`/`skip`) — the existing `update` rule for this collection already has no field restriction, so clearing it needs no rules change.
- `Vaccine.nextDueDate` already exists in the vaccines create allowlist from Plan 2; clearing it via the new `updateVaccine` (Task 4) goes through the same unrestricted `update` rule.
- `MedicationDoseLog.skipped` (Task 1) is a new key inside objects appended to the already-allowlisted `log` array field on `Medication` — `hasOnly()` checks top-level document keys only, not the shape of values inside an array field, so the existing `medications` create allowlist already permits this with zero edits.
- No new top-level collection: reminder settings and snoozes are local-only (AsyncStorage), never written to Firestore, so there is nothing for `firestore.rules` to gate.

## Assumptions and open questions

1. **The reminders list temporarily lives in the existing `CalendarScreen` tab**, replacing its "coming soon" placeholder, rather than a new dedicated tab — there's no spare tab slot in `MainTabs.tsx` (Pets/Calendar/Vets/Household + the raised "+"), and the execution pack explicitly pairs "the reminders and calendar screens" as both needing the permission bar, which reads as them being closely related if not the same screen for now. Plan 6 ("Calendar") is expected to grow real week/month views around this list rather than discard it. Worth the owner's confirmation that this reads as one coherent screen rather than two features awkwardly sharing a tab — an easy thing to see once it's actually on the phone.
2. **Reminder settings and snoozes are stored locally per device (AsyncStorage), never in Firestore.** This directly matches the required honesty line ("reminders are scheduled on this phone from what this phone has seen") and avoids a rules/collection change — but it means each phone in a household configures its own lead time/time of day, and a snooze on one phone doesn't hide the reminder on another. This is a deliberate reading of the spec's honesty requirement, not an oversight; flagging it explicitly in case the owner actually wants settings (if not snoozes) synced across a household's phones later.
3. **Medication dose timing uses the same "evenly spaced" simplification CLAUDE.md already documents for `{timesPerDay, intervalDays}`** (`intervalDays / timesPerDay` days between doses) rather than modeling actual times of day. This is the same deliberate MVP scope already accepted for the schedule struct itself, extended the same way to reminders — not a new decision, but worth restating since it's now load-bearing for when a notification fires, not just for display text.
4. **Vaccine and vet-visit-follow-up Done/Skip collapse to the same effect** (both clear the single dated field), since neither type has a "next occurrence" for Skip to defer to the way a medication dose does. The distinction is real and meaningful only for medications. If the owner wants Skip to behave differently for these two types later (e.g. leaving the date untouched so it reappears as overdue rather than resolved), that's a small follow-up to `reminderActions.ts`, not a redesign.
5. **Overdue reminders are never scheduled as local notifications** — only upcoming (non-overdue) ones get a trigger at `dueDate - leadDays` at the configured time. There's no well-defined "remind in advance" for something already past due; overdue items surface only in the in-app list. If the owner wants an immediate "you have overdue items" notification on a schedule (e.g. a daily digest), that's new scope, not covered here.
6. **The in-app reminders list looks 30 days ahead** (`REMINDERS_HORIZON_DAYS` in `useUpcomingReminders.ts`), a named constant chosen as a reasonable default, not derived from the spec (which doesn't specify one). Trivial to change later; not wired to any user-facing setting in this plan.
7. **No server-side/push notifications in this plan** — that's Phase 6 in the execution pack, explicitly gated behind Phase 0's billing resolution ("do not attempt before Phase 0 is resolved"). This plan's entire job is making that later phase cheap by keeping `computeUpcoming` genuinely pure; it does not attempt any part of the server-side work itself.
8. **`ReminderSettingsScreen`'s Save-triggered reschedule (Task 14, Step 3) re-fetches pets/vaccines/medications/vetVisits with one-shot listeners** rather than reusing `useUpcomingReminders`'s live subscriptions, to avoid introducing global/shared state between two components that don't otherwise need to know about each other. This duplicates a small amount of fan-out logic; if a third place ever needs the same "just this once" pattern, it's worth extracting, but two call sites (this one and the hook) doesn't yet justify it per this codebase's established YAGNI stance.
9. **`expo-notifications`' exact `scheduleNotificationAsync` trigger-shape API** (Task 8, Step 5) is written against the shape expected for an SDK-57-compatible version, but is explicitly flagged in that task for verification against the actually-installed version's type definitions before finalizing — API surface for this package has changed across versions and this plan's author (writing without running `npx expo install` first) can't verify the exact currently-resolved version's types with certainty.
10. **No unit tests exist (or can exist) for `notificationScheduler.ts`, `ReminderRescheduler.tsx`, or the AsyncStorage-backed stores' actual native behavior** — all native-bridge, same category as `@react-native-firebase/firestore` per CLAUDE.md's own documented reasoning for why RNFB is mocked rather than run in Jest. Task 14's device-verification checklist is this plan's only proof these actually work, mirroring the execution pack's own "on the phone, look for" section for this phase.
