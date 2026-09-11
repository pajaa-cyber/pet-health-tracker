import type { Firestore } from '@react-native-firebase/firestore';

const mockDocRef = { id: 'generated-id' };
const mockCollectionRef = {};
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: jest.fn((ref) => ref),
  where: jest.fn(),
  limit: jest.fn(),
}));

import { createHousehold, joinHousehold, getHousehold } from '../src/household/householdService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('householdService', () => {
  it('creates a household with the creator as its first member', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.members).toEqual([
      expect.objectContaining({ userId: 'user-1', displayName: 'Ana' }),
    ]);
    expect(household.inviteCode).toHaveLength(6);
    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, household);
  });

  it('lets a second user join via invite code', async () => {
    const existingHousehold = {
      id: 'h1',
      name: "Ana's Household",
      members: [{ userId: 'user-1', displayName: 'Ana', joinedAt: 0 }],
      inviteCode: 'ABC123',
      createdAt: 0,
    };
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ ref: mockDocRef, data: () => existingHousehold }],
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    const joined = await joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123');

    expect(joined.id).toBe('h1');
    expect(joined.members).toHaveLength(2);
    expect(joined.members.map((m) => m.userId)).toEqual(['user-1', 'user-2']);
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, { members: joined.members });
  });

  it('throws when the invite code does not match any household', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    await expect(
      joinHousehold(fakeDb, 'user-2', 'Marko', 'ZZZZZZ')
    ).rejects.toThrow('Invite code not found');
  });

  it('returns null from getHousehold when the document does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await getHousehold(fakeDb, 'missing-id');
    expect(result).toBeNull();
  });
});
