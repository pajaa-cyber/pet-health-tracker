import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'pet-1' };
const mockExistingDocRef = { id: 'pet-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'pet-1-existing' ? mockExistingDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

import { createPet, getPet, subscribeToPets, updatePetPhoto, updatePetColor, updatePet } from '../src/pets/petService';
import { NewPetInput } from '../src/pets/petService';

const fakeDb = {} as Firestore;

const minimalInput: NewPetInput = {
  name: 'Rex', species: 'dog', speciesOther: null, breed: 'Mixed',
  birthDate: 1000, birthDatePrecision: 'exact', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null,
  sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('petService', () => {
  it('creates a pet under the household with every field and an assigned colour', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const pet = await createPet(fakeDb, 'h1', minimalInput, []);

    expect(pet).toEqual({
      id: 'pet-1', householdId: 'h1', photoUrl: null, colorKey: '#EF4444', ...minimalInput,
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

  it('updates a pet with a partial set of fields', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updatePet(fakeDb, 'h1', 'pet-1-existing', { name: 'Rexy', status: 'remembered' });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockExistingDocRef, { name: 'Rexy', status: 'remembered' });
  });
});
