import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'vax-1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockCreatedDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createVaccine, subscribeToVaccines } from '../src/pets/vaccineService';

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
});
