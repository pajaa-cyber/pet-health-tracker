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
