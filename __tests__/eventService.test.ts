import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'evt-1' };
const mockExistingDocRef = { id: 'evt-1-existing' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) =>
    segments[segments.length - 1] === 'evt-1-existing' ? mockExistingDocRef : mockCreatedDocRef
  ),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createEvent, subscribeToEvents, updateEvent } from '../src/calendar/eventService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('eventService', () => {
  it('creates an event with status "upcoming" and the given fields', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const event = await createEvent(fakeDb, 'h1', ['pet-1', 'pet-2'], 'grooming', 'Bath', 'Used the new shampoo', 1000);

    expect(event).toEqual({
      id: 'evt-1', householdId: 'h1', petIds: ['pet-1', 'pet-2'], type: 'grooming',
      title: 'Bath', notes: 'Used the new shampoo', date: 1000, status: 'upcoming',
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, event);
  });

  it('subscribes to the household events collection', () => {
    const callback = jest.fn();
    mockOnSnapshot.mockReturnValue(() => {});

    subscribeToEvents(fakeDb, 'h1', callback);

    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('maps snapshot docs to CalendarEvent objects', () => {
    const callback = jest.fn();
    const fakeDocs = [{ data: () => ({ id: 'evt-1', title: 'Bath' }) }];
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({ docs: fakeDocs });
      return () => {};
    });

    subscribeToEvents(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([{ id: 'evt-1', title: 'Bath' }]);
  });

  it('updates an event, e.g. to mark it completed or skipped', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateEvent(fakeDb, 'h1', 'evt-1-existing', { status: 'completed' });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockExistingDocRef, { status: 'completed' });
  });
});
