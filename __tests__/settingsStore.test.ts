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
