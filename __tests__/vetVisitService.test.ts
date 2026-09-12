import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'visit-1' };
const mockVisitDocRef = { id: 'visit-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'visit-1-existing' ? mockVisitDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
}));

import { createVetVisit, subscribeToVetVisits, addVetVisitDocument } from '../src/pets/vetVisitService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vetVisitService', () => {
  it('creates a vet visit with an empty documentUrls array', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const visit = await createVetVisit(fakeDb, 'h1', 'pet-1', 1000, 'Annual checkup', 'All healthy');

    expect(visit).toEqual({
      id: 'visit-1', petId: 'pet-1', date: 1000, reason: 'Annual checkup', notes: 'All healthy', documentUrls: [],
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, visit);
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

  it('appends a document URL via arrayUnion', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await addVetVisitDocument(fakeDb, 'h1', 'pet-1', 'visit-1-existing', 'https://example.com/doc.pdf');

    expect(mockArrayUnion).toHaveBeenCalledWith('https://example.com/doc.pdf');
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockVisitDocRef, {
      documentUrls: { __arrayUnion: ['https://example.com/doc.pdf'] },
    });
  });
});
