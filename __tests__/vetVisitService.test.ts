import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'visit-1' };
const mockVisitDocRef = { id: 'visit-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'visit-1-existing' ? mockVisitDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createVetVisit, subscribeToVetVisits, updateVetVisit } from '../src/pets/vetVisitService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vetVisitService', () => {
  it('creates a vet visit with an optional follow-up date', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const visit = await createVetVisit(fakeDb, 'h1', 'pet-1', 1000, 'Annual checkup', 'All healthy', 2000);

    expect(visit).toEqual({
      id: 'visit-1', petId: 'pet-1', date: 1000, reason: 'Annual checkup', notes: 'All healthy',
      followUpDate: 2000,
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, visit);
  });

  it('updates a vet visit, e.g. to clear a follow-up date', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateVetVisit(fakeDb, 'h1', 'pet-1', 'visit-1-existing', { followUpDate: null });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockVisitDocRef, { followUpDate: null });
  });

  it('subscribes to a pet\'s vet visits and maps snapshots to VetVisit[]', () => {
    const callback = jest.fn();
    const fakeVisit = { id: 'visit-1', petId: 'pet-1', reason: 'Annual checkup' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeVisit }] });
      return () => {};
    });

    subscribeToVetVisits(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeVisit]);
  });
});
