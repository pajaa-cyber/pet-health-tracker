// __tests__/vetService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'vet-1' };
const mockExistingDocRef = { id: 'vet-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'vet-1-existing' ? mockExistingDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createVet, subscribeToVets, updateVet } from '../src/vets/vetService';

const fakeDb = {} as Firestore;

const fullInput = {
  clinicName: 'Riverside Vet Clinic',
  doctorName: 'Dr. Novak',
  address: '12 River Rd',
  phone: '555-0100',
  openingHours: 'Mon-Fri 9am-6pm',
  speciality: 'General practice',
  isEmergency24h: false,
  notes: 'Ana\'s regular clinic',
  petIds: ['pet-1'],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('vetService', () => {
  it('creates a vet with the given fields', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const vet = await createVet(fakeDb, 'h1', fullInput);

    expect(vet).toEqual({ id: 'vet-1', householdId: 'h1', ...fullInput });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, vet);
  });

  it('creates a vet with only a name and nothing else', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const minimalInput = {
      clinicName: 'Corner Clinic',
      doctorName: '', address: '', phone: '', openingHours: '',
      speciality: '', isEmergency24h: false, notes: '', petIds: [],
    };
    const vet = await createVet(fakeDb, 'h1', minimalInput);

    expect(vet).toEqual({ id: 'vet-1', householdId: 'h1', ...minimalInput });
  });

  it('subscribes to the household vets collection', () => {
    const callback = jest.fn();
    mockOnSnapshot.mockReturnValue(() => {});

    subscribeToVets(fakeDb, 'h1', callback);

    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('maps snapshot docs to Vet objects', () => {
    const callback = jest.fn();
    const fakeDocs = [{ data: () => ({ id: 'vet-1', clinicName: 'Riverside' }) }];
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({ docs: fakeDocs });
      return () => {};
    });

    subscribeToVets(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([{ id: 'vet-1', clinicName: 'Riverside' }]);
  });

  it('reports a listener error as an empty list rather than leaving the screen stuck', () => {
    const callback = jest.fn();
    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      onError(new Error('permission-denied'));
      return () => {};
    });

    subscribeToVets(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([]);
  });

  it('updates a vet', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateVet(fakeDb, 'h1', 'vet-1-existing', { clinicName: 'Renamed Clinic' });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockExistingDocRef, { clinicName: 'Renamed Clinic' });
  });
});
