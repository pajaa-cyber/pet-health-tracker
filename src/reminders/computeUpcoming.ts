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

// Due dates come from a date-only picker (DateField.tsx) but are stored as
// exact-millisecond timestamps that inherit whatever time-of-day the field
// happened to be touched at, not midnight. Comparing those timestamps to
// `now` directly would flip a "due today" reminder to overdue the moment
// that incidental time-of-day passes, hours before the day is actually
// over — so overdue is decided by calendar day, not raw millis.
function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeUpcoming(input: UpcomingInput, now: number, horizonDays: number): UpcomingReminder[] {
  const horizonMs = now + horizonDays * DAY_MS;
  const today = startOfDay(now);
  const isOverdue = (dueDate: number) => startOfDay(dueDate) < today;
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
      overdue: isOverdue(vax.nextDueDate),
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
      overdue: isOverdue(dueDate),
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
      overdue: isOverdue(visit.followUpDate),
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
