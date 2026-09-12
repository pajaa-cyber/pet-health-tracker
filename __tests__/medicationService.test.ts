import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'med-1' };
const mockMedDocRef = { id: 'med-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'med-1-existing' ? mockMedDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
}));

import { createMedication, subscribeToMedications, logMedicationDose } from '../src/pets/medicationService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('medicationService', () => {
  it('creates a medication with an empty dose log', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const med = await createMedication(
      fakeDb, 'h1', 'pet-1', 'Amoxicillin', '250mg',
      { timesPerDay: 2, intervalDays: 1 }, 1000, null
    );

    expect(med).toEqual({
      id: 'med-1',
      petId: 'pet-1',
      name: 'Amoxicillin',
      dosage: '250mg',
      schedule: { timesPerDay: 2, intervalDays: 1 },
      startDate: 1000,
      endDate: null,
      log: [],
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, med);
  });

  it('subscribes to a pet\'s medications and maps snapshots to Medication[]', () => {
    const callback = jest.fn();
    const fakeMed = { id: 'med-1', petId: 'pet-1', name: 'Amoxicillin' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeMed }] });
      return () => {};
    });

    subscribeToMedications(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeMed]);
  });

  it('logs a dose via arrayUnion on the log field', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await logMedicationDose(fakeDb, 'h1', 'pet-1', 'med-1-existing', 'user-1');

    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({ givenBy: 'user-1' })
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockMedDocRef, {
      log: { __arrayUnion: [expect.objectContaining({ givenBy: 'user-1' })] },
    });
  });
});
