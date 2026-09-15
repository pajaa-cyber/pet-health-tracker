import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'vax-1' };
const mockVaxDocRef = { id: 'vax-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'vax-1-existing' ? mockVaxDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createVaccine, subscribeToVaccines, updateVaccine } from '../src/pets/vaccineService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vaccineService', () => {
  it('creates a vaccine record under the pet', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const vaccine = await createVaccine(fakeDb, 'h1', 'pet-1', 'Rabies', 1000, 2000, 'Dr. Smith');

    expect(vaccine).toEqual({
      id: 'vax-1',
      petId: 'pet-1',
      name: 'Rabies',
      dateGiven: 1000,
      nextDueDate: 2000,
      vetName: 'Dr. Smith',
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, vaccine);
  });

  it('subscribes to a pet\'s vaccines and maps snapshots to Vaccine[]', () => {
    const callback = jest.fn();
    const fakeVaccine = { id: 'vax-1', petId: 'pet-1', name: 'Rabies' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeVaccine }] });
      return () => {};
    });

    subscribeToVaccines(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeVaccine]);
  });

  it('updates a vaccine, e.g. to clear nextDueDate after marking it done', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateVaccine(fakeDb, 'h1', 'pet-1', 'vax-1-existing', { nextDueDate: null });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockVaxDocRef, { nextDueDate: null });
  });
});
