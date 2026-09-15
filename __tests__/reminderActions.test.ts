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
