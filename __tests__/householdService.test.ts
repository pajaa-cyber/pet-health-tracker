import type { Firestore } from '@react-native-firebase/firestore';

const mockCreatedDocRef = { id: 'generated-id' };
const mockInviteDocRef = { id: 'invite-ref' };
const mockHouseholdDocRef = { id: 'h1' };
const mockUsersDocRef = { id: 'users-ref' };
const mockCollectionRef = {};
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockArrayUnion = jest.fn((value: unknown) => ({ __arrayUnion: [value] }));
const mockArrayRemove = jest.fn((value: unknown) => ({ __arrayRemove: [value] }));
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn((..._args: unknown[]) => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn((_refOrDb: unknown, path?: string) => {
    if (path === 'inviteCodes') return mockInviteDocRef;
    if (path === 'households') return mockHouseholdDocRef;
    if (path === 'users') return mockUsersDocRef;
    return mockCreatedDocRef; // doc(collectionRef) auto-id case, used by createHousehold
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(args[0]),
  arrayRemove: (...args: unknown[]) => mockArrayRemove(args[0]),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { createHousehold, joinHousehold, getHousehold, removeMember, reconcileMemberCount, startTrialIfNeeded } from '../src/household/householdService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
});

describe('householdService', () => {
  it('creates a household, its invite code (with a starting memberCount of 1), and a users/{uid} pointer in one batch', async () => {
    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.members).toEqual([
      expect.objectContaining({ userId: 'user-1', displayName: 'Ana' }),
    ]);
    expect(household.memberIds).toEqual(['user-1']);
    expect(household.inviteCode).toHaveLength(6);
    expect(mockWriteBatch).toHaveBeenCalledWith(fakeDb);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedDocRef, household);
    expect(mockBatchSet).toHaveBeenCalledWith(mockInviteDocRef, { householdId: 'generated-id', memberCount: 1 });
    expect(mockBatchSet).toHaveBeenCalledWith(mockUsersDocRef, { householdId: 'generated-id' });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('retries with a freshly generated invite code and a new batch when commit fails (e.g. an invite-code collision)', async () => {
    mockBatchCommit
      .mockRejectedValueOnce(new Error('permission-denied: inviteCodes doc already exists'))
      .mockResolvedValueOnce(undefined);

    const household = await createHousehold(fakeDb, 'user-1', 'Ana', "Ana's Household");

    expect(household.id).toBe('generated-id');
    expect(household.inviteCode).toHaveLength(6);
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

    expect(mockBatchCommit).toHaveBeenCalledTimes(5);
  });

  it('joins a household: writes the users/{uid} pointer first, then the household membership and inviteCodes memberCount in one batch', async () => {
    // The users/{uid} pointer write is deliberately NOT part of the batch, and
    // deliberately runs BEFORE it — see joinHousehold's own comment for the
    // two on-device-testing-found reasons (an RNFB writeBatch() limitation,
    // and the recovery-path rule's ordering requirement). memberCount is a
    // literal caller-computed number, not increment(), for the same
    // on-device-testing reason documented there.
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ householdId: 'h1', memberCount: 1 }) });

    await joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123');

    expect(mockGetDoc).toHaveBeenCalledWith(mockInviteDocRef);
    expect(mockSetDoc).toHaveBeenCalledWith(mockUsersDocRef, { householdId: 'h1' });
    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2', displayName: 'Marko' })
    );
    expect(mockArrayUnion).toHaveBeenCalledWith('user-2');
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, {
      members: { __arrayUnion: [expect.objectContaining({ userId: 'user-2' })] },
      memberIds: { __arrayUnion: ['user-2'] },
      joinCodeUsed: 'ABC123',
    });
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockInviteDocRef, { memberCount: 2 });
    expect(mockBatchCommit).toHaveBeenCalled();
    // The pointer write must happen before the batch commits, not after.
    expect(mockSetDoc.mock.invocationCallOrder[0]).toBeLessThan(
      mockBatchCommit.mock.invocationCallOrder[0]
    );
  });

  it('throws a friendly message and writes nothing when the household is already at the free member limit', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ householdId: 'h1', memberCount: 4 }) });

    await expect(
      joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123')
    ).rejects.toThrow('4 household members');
    expect(mockWriteBatch).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('treats a missing memberCount (a household created before this field existed) as under the limit', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ householdId: 'h1' }) });

    await joinHousehold(fakeDb, 'user-2', 'Marko', 'ABC123');

    expect(mockBatchCommit).toHaveBeenCalled();
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

  it('removes a member from both members and memberIds, and writes the caller-supplied absolute remaining memberCount, in one batch', async () => {
    const member = { userId: 'user-2', displayName: 'Marko', joinedAt: 0 };

    await removeMember(fakeDb, 'h1', 'ABC123', member, 2);

    expect(mockArrayRemove).toHaveBeenCalledWith(member);
    expect(mockArrayRemove).toHaveBeenCalledWith('user-2');
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, {
      members: { __arrayRemove: [member] },
      memberIds: { __arrayRemove: ['user-2'] },
    });
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockInviteDocRef, { memberCount: 2 });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('reconciles an invite code memberCount to an absolute value via updateDoc', async () => {
    await reconcileMemberCount(fakeDb, 'ABC123', 3);

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockInviteDocRef, { memberCount: 3 });
  });

  it('startTrialIfNeeded sets trialStartedAt/trialEndsAt 14 days apart, only when unset', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    await startTrialIfNeeded(fakeDb, 'h1', { trialStartedAt: null } as any);

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockHouseholdDocRef, {
      trialStartedAt: 1_700_000_000_000,
      trialEndsAt: 1_700_000_000_000 + 14 * 24 * 60 * 60 * 1000,
    });
    jest.restoreAllMocks();
  });

  it('startTrialIfNeeded does nothing when trialStartedAt is already set', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await startTrialIfNeeded(fakeDb, 'h1', { trialStartedAt: 1_600_000_000_000 } as any);

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
