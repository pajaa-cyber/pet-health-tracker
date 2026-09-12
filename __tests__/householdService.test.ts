import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'generated-id' };
const mockInviteDocRef = { id: 'invite-ref' };
const mockHouseholdDocRef = { id: 'h1' };
const mockCollectionRef = {};
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockBatch = { set: mockBatchSet, commit: mockBatchCommit };
const mockWriteBatch = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, path?: string) => {
    if (path === 'inviteCodes') return mockInviteDocRef;
    if (path === 'households') return mockHouseholdDocRef;
    return mockCreatedDocRef; // doc(collectionRef) auto-id case, used by createHousehold
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { createHousehold, joinHousehold, getHousehold } from '../src/household/householdService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue(mockBatch);
});

describe('householdService', () => {
  it('creates a household and a matching invite-code lookup entry atomically via a batch', async () => {
    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.members).toEqual([
      expect.objectContaining({ userId: 'user-1', displayName: 'Ana' }),
    ]);
    expect(household.inviteCode).toHaveLength(6);
    expect(mockWriteBatch).toHaveBeenCalledWith(fakeDb);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedDocRef, household);
    expect(mockBatchSet).toHaveBeenCalledWith(mockInviteDocRef, { householdId: 'generated-id' });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('retries with a freshly generated invite code and a new batch when commit fails (e.g. an invite-code collision)', async () => {
    mockBatchCommit
      .mockRejectedValueOnce(new Error('permission-denied: inviteCodes doc already exists'))
      .mockResolvedValueOnce(undefined);

    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.inviteCode).toHaveLength(6);
    // One batch per attempt, and the household+invite writes are re-set on
    // the retry's batch (the first attempt's batch committed nothing, so
    // the household doc still doesn't exist and can be `set` again).
    expect(mockWriteBatch).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedDocRef, household);
  });

  it('throws the last commit error after exhausting all retry attempts', async () => {
    const failure = new Error('permission-denied: inviteCodes doc already exists');
    mockBatchCommit.mockRejectedValue(failure);

    await expect(
      createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household")
    ).rejects.toThrow(failure.message);

    // MAX_INVITE_CODE_ATTEMPTS in householdService.ts
    expect(mockBatchCommit).toHaveBeenCalledTimes(5);
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
