import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'weight-1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockCreatedDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createWeightLog, subscribeToWeightLogs } from '../src/pets/weightLogService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('weightLogService', () => {
  it('creates a weight log entry', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const log = await createWeightLog(fakeDb, 'h1', 'pet-1', 1000, 12.5);

    expect(log).toEqual({ id: 'weight-1', petId: 'pet-1', date: 1000, weight: 12.5 });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, log);
  });

  it('subscribes to a pet\'s weight logs and maps snapshots to WeightLog[]', () => {
    const callback = jest.fn();
    const fakeLog = { id: 'weight-1', petId: 'pet-1', date: 1000, weight: 12.5 };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeLog }] });
      return () => {};
    });

    subscribeToWeightLogs(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeLog]);
  });
});
