import {
  mergeCalendarEntries, entriesForDay, entriesForPet, overdueEntries, daysWithEntries,
  startOfWeek, startOfMonth, CalendarEntry,
} from '../src/calendar/calendarEntries';
import { UpcomingReminder } from '../src/reminders/computeUpcoming';
import { CalendarEvent } from '../src/types/calendarEvent';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-15T12:00:00').getTime(); // local noon, deliberately not midnight — same lesson as computeUpcoming's own tests

const reminder = (overrides: Partial<UpcomingReminder> = {}): UpcomingReminder => ({
  id: 'vaccine:vax-1', petId: 'pet-1', petName: 'Neo', type: 'vaccine', sourceId: 'vax-1',
  label: 'Rabies vaccine', dueDate: NOW + 2 * DAY_MS, overdue: false,
  ...overrides,
});

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'evt-1', householdId: 'h1', petIds: ['pet-1'], type: 'grooming', title: 'Bath', notes: '',
  date: NOW + DAY_MS, status: 'upcoming',
  ...overrides,
});

describe('mergeCalendarEntries', () => {
  it('turns a reminder into a reminder-source entry with a stable prefixed id', () => {
    const result = mergeCalendarEntries([reminder()], [], NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'reminder:vaccine:vax-1', source: 'reminder', petIds: ['pet-1'], label: 'Rabies vaccine',
      overdue: false, completed: false, skipped: false,
    });
    expect(result[0].reminder).not.toBeNull();
    expect(result[0].event).toBeNull();
  });

  it('turns an event into an event-source entry carrying its full pet list', () => {
    const result = mergeCalendarEntries([], [event({ petIds: ['pet-1', 'pet-2'] })], NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'event:evt-1', source: 'event', petIds: ['pet-1', 'pet-2'], label: 'Bath' });
    expect(result[0].event).not.toBeNull();
    expect(result[0].reminder).toBeNull();
  });

  it('reports an upcoming event due earlier today as not overdue', () => {
    const earlierToday = new Date('2026-09-15T08:00:00').getTime();
    const result = mergeCalendarEntries([], [event({ date: earlierToday, status: 'upcoming' })], NOW);
    expect(result[0].overdue).toBe(false);
  });

  it('reports an upcoming event from an earlier calendar day as overdue', () => {
    const result = mergeCalendarEntries([], [event({ date: NOW - 2 * DAY_MS, status: 'upcoming' })], NOW);
    expect(result[0].overdue).toBe(true);
  });

  it('never reports a completed or skipped event as overdue, regardless of date', () => {
    const past = NOW - 10 * DAY_MS;
    expect(mergeCalendarEntries([], [event({ date: past, status: 'completed' })], NOW)[0].overdue).toBe(false);
    expect(mergeCalendarEntries([], [event({ date: past, status: 'skipped' })], NOW)[0].overdue).toBe(false);
  });

  it('reflects completed and skipped status on the entry', () => {
    expect(mergeCalendarEntries([], [event({ status: 'completed' })], NOW)[0]).toMatchObject({ completed: true, skipped: false });
    expect(mergeCalendarEntries([], [event({ status: 'skipped' })], NOW)[0]).toMatchObject({ completed: false, skipped: true });
  });

  it('sorts reminders and events together by date, ascending', () => {
    const result = mergeCalendarEntries(
      [reminder({ id: 'vaccine:far', dueDate: NOW + 10 * DAY_MS })],
      [event({ id: 'near', date: NOW + DAY_MS })],
      NOW
    );
    expect(result.map((e) => e.id)).toEqual(['event:near', 'reminder:vaccine:far']);
  });
});

describe('entriesForDay', () => {
  it('includes only entries within that calendar day', () => {
    const today = new Date('2026-09-15T00:00:00').getTime();
    const entries = mergeCalendarEntries(
      [], [event({ id: 'today-morning', date: new Date('2026-09-15T08:00:00').getTime() }), event({ id: 'tomorrow', date: today + DAY_MS })],
      NOW
    );
    const result = entriesForDay(entries, today);
    expect(result.map((e) => e.id)).toEqual(['event:today-morning']);
  });
});

describe('entriesForPet', () => {
  const entries: CalendarEntry[] = mergeCalendarEntries(
    [reminder({ petId: 'pet-1' })],
    [event({ id: 'shared', petIds: ['pet-1', 'pet-2'] }), event({ id: 'solo', petIds: ['pet-2'] })],
    NOW
  );

  it('returns everything for "all"', () => {
    expect(entriesForPet(entries, 'all')).toHaveLength(3);
  });

  it('includes a multi-pet event under either pet it lists', () => {
    expect(entriesForPet(entries, 'pet-1').map((e) => e.id)).toEqual(expect.arrayContaining(['event:shared']));
    expect(entriesForPet(entries, 'pet-2').map((e) => e.id)).toEqual(expect.arrayContaining(['event:shared', 'event:solo']));
  });

  it('excludes an entry that does not list the filtered pet', () => {
    expect(entriesForPet(entries, 'pet-1').map((e) => e.id)).not.toContain('event:solo');
  });
});

describe('overdueEntries', () => {
  it('returns only overdue entries, of either source', () => {
    const entries = mergeCalendarEntries(
      [reminder({ overdue: true }), reminder({ id: 'vaccine:not-due', overdue: false })],
      [event({ date: NOW - 5 * DAY_MS, status: 'upcoming' })],
      NOW
    );
    expect(overdueEntries(entries)).toHaveLength(2);
    expect(overdueEntries(entries).every((e) => e.overdue)).toBe(true);
  });
});

describe('daysWithEntries', () => {
  it('returns the start-of-day timestamp for each distinct day that has an entry, sorted ascending', () => {
    const day1 = new Date('2026-09-15T00:00:00').getTime();
    const day3 = new Date('2026-09-17T00:00:00').getTime();
    const entries = mergeCalendarEntries(
      [], [event({ id: 'a', date: day1 + 3 * 60 * 60 * 1000 }), event({ id: 'b', date: day3 + 60 * 60 * 1000 })], NOW
    );
    expect(daysWithEntries(entries, day1, day3 + DAY_MS)).toEqual([day1, day3]);
  });

  it('excludes days outside the given range', () => {
    const inRange = new Date('2026-09-15T00:00:00').getTime();
    const outOfRange = new Date('2026-10-15T00:00:00').getTime();
    const entries = mergeCalendarEntries([], [event({ date: inRange }), event({ id: 'far', date: outOfRange })], NOW);
    expect(daysWithEntries(entries, inRange, inRange + DAY_MS)).toEqual([inRange]);
  });
});

describe('startOfWeek', () => {
  it('returns the preceding (or same) Sunday at midnight', () => {
    const wednesday = new Date('2026-09-16T15:30:00').getTime(); // a Wednesday
    const result = new Date(startOfWeek(wednesday));
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(13); // the Sunday of that week
    expect(result.getHours()).toBe(0);
  });

  it('is idempotent on a Sunday itself', () => {
    const sunday = new Date('2026-09-13T00:00:00').getTime();
    expect(startOfWeek(sunday)).toBe(sunday);
  });
});

describe('startOfMonth', () => {
  it('returns the 1st of the month at midnight', () => {
    const midMonth = new Date('2026-09-16T15:30:00').getTime();
    const result = new Date(startOfMonth(midMonth));
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(8); // September, 0-indexed
    expect(result.getHours()).toBe(0);
  });
});
