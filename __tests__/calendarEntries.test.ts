import {
  mergeCalendarEntries, entriesForDay, entriesForPet, overdueEntries, daysWithEntries,
  startOfWeek, startOfMonth, addDays, CalendarEntry,
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
    expect(Array.from(daysWithEntries(entries, day1, day3 + DAY_MS).keys()).sort((a, b) => a - b)).toEqual([day1, day3]);
  });

  it('excludes days outside the given range', () => {
    const inRange = new Date('2026-09-15T00:00:00').getTime();
    const outOfRange = new Date('2026-10-15T00:00:00').getTime();
    const entries = mergeCalendarEntries([], [event({ date: inRange }), event({ id: 'far', date: outOfRange })], NOW);
    expect(Array.from(daysWithEntries(entries, inRange, inRange + DAY_MS).keys())).toEqual([inRange]);
  });

  it('deduplicates and collects distinct pet ids per day', () => {
    const day = new Date('2026-09-15T00:00:00').getTime();
    const entries = mergeCalendarEntries(
      [],
      [
        event({ id: 'a', petIds: ['pet-1'], date: day }),
        event({ id: 'b', petIds: ['pet-2'], date: day + 60 * 60 * 1000 }),
        event({ id: 'c', petIds: ['pet-1'], date: day + 2 * 60 * 60 * 1000 }),
      ],
      NOW
    );
    expect(daysWithEntries(entries, day, day + DAY_MS).get(day)).toEqual(['pet-1', 'pet-2']);
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

describe('addDays (DST safety)', () => {
  // Europe/Belgrade is where the original DST desync bug (duplicate date
  // numbers, vanishing entry dots, wrong day highlighted as selected) was
  // reproduced — pin the timezone explicitly here rather than relying on
  // whatever the machine running the suite happens to default to, so this
  // regression test is meaningful on any CI/dev box. process.env.TZ is read
  // fresh by Date on every call in Node, so setting/restoring it around
  // just this describe block is safe and doesn't leak into other tests.
  const originalTZ = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'Europe/Belgrade';
  });

  afterAll(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it('advances by exactly one calendar day across a spring-forward transition (clocks skip 02:00->03:00)', () => {
    // 2026-03-29 is Europe/Belgrade's spring-forward date. A naive
    // dayStart + 24h*ms add from this midnight lands at 01:00 the next day
    // (one hour short of midnight), not 00:00 — this is what the old
    // WeekView/MonthView/entriesForDay bug did.
    const dayStart = new Date('2026-03-29T00:00:00').getTime();
    const naiveNextDay = dayStart + 24 * 60 * 60 * 1000;
    const result = addDays(dayStart, 1);
    const resultDate = new Date(result);

    expect(resultDate.getDate()).toBe(30);
    expect(resultDate.getMonth()).toBe(2); // March, 0-indexed
    expect(resultDate.getHours()).toBe(0);
    expect(result).not.toBe(naiveNextDay); // proves this would have failed pre-fix
  });

  it('advances by exactly one calendar day across a fall-back transition (clocks repeat 02:00->01:00)', () => {
    // 2026-10-25 is Europe/Belgrade's fall-back date. A naive
    // dayStart + 24h*ms add from this midnight lands back at 23:00 the
    // *same* day — the date doesn't even advance at all.
    const dayStart = new Date('2026-10-25T00:00:00').getTime();
    const naiveNextDay = dayStart + 24 * 60 * 60 * 1000;
    const result = addDays(dayStart, 1);
    const resultDate = new Date(result);

    expect(resultDate.getDate()).toBe(26);
    expect(resultDate.getMonth()).toBe(9); // October, 0-indexed
    expect(resultDate.getHours()).toBe(0);
    expect(result).not.toBe(naiveNextDay); // proves this would have failed pre-fix
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
