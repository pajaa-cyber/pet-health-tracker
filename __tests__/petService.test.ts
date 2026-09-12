import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'pet-1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockCreatedDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createPet, getPet, subscribeToPets } from '../src/pets/petService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('petService', () => {
  it('creates a pet under the household', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const pet = await createPet(fakeDb, 'h1', 'Rex', 'dog', 'Labrador', 1000);

    expect(pet).toEqual({
      id: 'pet-1',
      householdId: 'h1',
      name: 'Rex',
      species: 'dog',
      breed: 'Labrador',
      birthDate: 1000,
      photoUrl: null,
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, pet);
  });

  it('returns null from getPet when the document does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getPet(fakeDb, 'h1', 'missing');
    expect(result).toBeNull();
  });

  it('subscribes to the pets collection and maps snapshots to Pet[]', () => {
    const callback = jest.fn();
    const fakePet = { id: 'pet-1', householdId: 'h1', name: 'Rex' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakePet }] });
      return () => {};
    });

    subscribeToPets(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([fakePet]);
  });
});
