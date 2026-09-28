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
    mockGetItem.mockResolvedValue(JSON.stringify({ 'vaccine:vax-1': { untilMs: 1000, dueDate: 500 } }));
    mockSetItem.mockResolvedValue(undefined);

    await snoozeReminder('medication:med-1', 2000, 1500);

    expect(mockSetItem).toHaveBeenCalledWith(
      'reminderSnoozes.v1',
      JSON.stringify({
        'vaccine:vax-1': { untilMs: 1000, dueDate: 500 },
        'medication:med-1': { untilMs: 2000, dueDate: 1500 },
      })
    );
  });
});

describe('isSnoozed', () => {
  it('is true when the snooze has not expired yet and the due date matches', () => {
    const snoozes = { 'vaccine:vax-1': { untilMs: 2000, dueDate: 500 } };
    expect(isSnoozed(snoozes, 'vaccine:vax-1', 500, 1000)).toBe(true);
  });

  it('is false once the snooze has expired', () => {
    const snoozes = { 'vaccine:vax-1': { untilMs: 500, dueDate: 500 } };
    expect(isSnoozed(snoozes, 'vaccine:vax-1', 500, 1000)).toBe(false);
  });

  it('is false for a reminder with no snooze entry', () => {
    expect(isSnoozed({}, 'vaccine:vax-1', 500, 1000)).toBe(false);
  });

  // The bug this guards against: a vaccine's id (`vaccine:vax-1`) stays the
  // same across a re-date, so a stale snooze recorded against the old due
  // date must not suppress the reminder once it means a different date.
  it('is false once the reminder has been re-dated, even with a still-unexpired snooze', () => {
    const snoozes = { 'vaccine:vax-1': { untilMs: 5000, dueDate: 500 } };
    expect(isSnoozed(snoozes, 'vaccine:vax-1', 999, 1000)).toBe(false);
  });
});
