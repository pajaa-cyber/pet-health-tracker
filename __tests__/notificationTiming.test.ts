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
