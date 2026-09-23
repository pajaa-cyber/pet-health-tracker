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
  id: 'visit-1', petId: 'pet-1', date: NOW - 30 * DAY_MS, reason: 'Checkup', notes: '', followUpDate: NOW + 14 * DAY_MS,
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

  it('does not treat a due date earlier today as overdue just because its time-of-day has passed', () => {
    // A date field's stored value carries whatever time-of-day it was picked at
    // (see DateField.tsx), not midnight — so "due today" is often a due date
    // whose timestamp is earlier than the current moment while still being
    // the same calendar day. It must not flip to overdue until the day itself
    // has passed, otherwise same-day reminders go overdue (and stop being
    // eligible for a notification) within minutes of being created.
    const today9am = new Date('2026-09-15T09:00:00').getTime();
    const today5pm = new Date('2026-09-15T17:00:00').getTime();
    const input = { ...emptyInput(), vaccines: [vaccine({ nextDueDate: today9am })] };
    const result = computeUpcoming(input, today5pm, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ overdue: false, dueDate: today9am });
  });

  it('treats a due date from an earlier calendar day as overdue even late in the current day', () => {
    const yesterday11pm = new Date('2026-09-14T23:00:00').getTime();
    const today1am = new Date('2026-09-15T01:00:00').getTime();
    const input = { ...emptyInput(), vaccines: [vaccine({ nextDueDate: yesterday11pm })] };
    const result = computeUpcoming(input, today1am, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ overdue: true, dueDate: yesterday11pm });
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
