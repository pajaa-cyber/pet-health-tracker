import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'expense-1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockCreatedDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { createExpense, subscribeToExpenses } from '../src/pets/expenseService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('expenseService', () => {
  it('creates an expense record', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const expense = await createExpense(fakeDb, 'h1', 'pet-1', 1000, 'vet', 5000, 'Annual checkup');

    expect(expense).toEqual({
      id: 'expense-1', petId: 'pet-1', date: 1000, category: 'vet', amountCents: 5000, note: 'Annual checkup',
    });
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, expense);
  });

  it('subscribes to a pet\'s expenses and maps snapshots to Expense[]', () => {
    const callback = jest.fn();
    const fakeExpense = { id: 'expense-1', petId: 'pet-1', category: 'vet', amountCents: 5000 };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeExpense }] });
      return () => {};
    });

    subscribeToExpenses(fakeDb, 'h1', 'pet-1', callback);

    expect(callback).toHaveBeenCalledWith([fakeExpense]);
  });
});
