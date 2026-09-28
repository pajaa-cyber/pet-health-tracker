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

  // Regression test for a real DST bug: subtracting `leadDays * DAY_MS` in
  // raw milliseconds (the old implementation) picks the wrong calendar day
  // whenever the subtraction crosses a DST transition close to midnight.
  // 2026-03-29 is EU spring-forward (clocks 02:00 -> 03:00, a 23-hour day).
  // A due date just after midnight on the day after picks the WRONG day
  // (one day too early) under raw ms subtraction, because 24 real hours
  // earlier than 2026-03-30T00:30 lands on 2026-03-28, not 2026-03-29 —
  // addDays()'s calendar-based subtraction gets this right.
  it('picks the correct calendar day across a DST spring-forward transition', () => {
    const now = new Date('2026-03-20T00:00:00').getTime();
    const dstReminder = reminder({ dueDate: new Date('2026-03-30T00:30:00').getTime() });
    const result = computeNotificationTime(dstReminder, settings, now);
    const expected = new Date('2026-03-29T09:00:00').getTime();
    expect(result).toBe(expected);
  });
});
