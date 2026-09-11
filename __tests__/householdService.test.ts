import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'generated-id' };
const mockInviteDocRef = { id: 'invite-ref' };
const mockHouseholdDocRef = { id: 'h1' };
const mockCollectionRef = {};
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, path?: string) => {
    if (path === 'inviteCodes') return mockInviteDocRef;
    if (path === 'households') return mockHouseholdDocRef;
    return mockCreatedDocRef; // doc(collectionRef) auto-id case, used by createHousehold
  }),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
}));

import { createHousehold, joinHousehold, getHousehold } from '../src/household/householdService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('householdService', () => {
  it('creates a household and a matching invite-code lookup entry', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.members).toEqual([
      expect.objectContaining({ userId: 'user-1', displayName: 'Ana' }),
    ]);
    expect(household.inviteCode).toHaveLength(6);
    expect(mockSetDoc).toHaveBeenCalledWith(mockCreatedDocRef, household);
    expect(mockSetDoc).toHaveBeenCalledWith(mockInviteDocRef, { householdId: 'generated-id' });
  });

  it('lets a second user join via invite code, using arrayUnion instead of reading the household first', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ householdId: 'h1' }) });
    mockUpdateDoc.mockResolvedValue(undefined);

    await joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123');

    expect(mockGetDoc).toHaveBeenCalledWith(mockInviteDocRef);
    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2', displayName: 'Marko' })
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockHouseholdDocRef, {
      members: { __arrayUnion: [expect.objectContaining({ userId: 'user-2' })] },
    });
  });

  it('throws when the invite code does not match any household', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

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
