import type { Firestore } from '@react-native-firebase/firestore';

const mockCodeDocRef = { id: 'ABC123' };
const mockGrantDocRef = { id: 'sitter-uid-1' };
const mockCollectionGroupRef = { __name: 'collectionGroup:sitterAccess' };
const mockCollectionRef = {};
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn((...args: unknown[]) => ({ __isQuery: true, args }));
const mockWhere = jest.fn((...args: unknown[]) => ({ __where: args }));
const mockCollectionGroup = jest.fn((..._args: unknown[]) => mockCollectionGroupRef);

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  collectionGroup: (...args: unknown[]) => mockCollectionGroup(...args),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) => {
    if (segments.includes('sitterInviteCodes')) return mockCodeDocRef;
    if (segments.includes('sitterAccess')) return mockGrantDocRef;
    return mockCodeDocRef;
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}));

import {
  createSitterInvite, redeemSitterInvite, revokeSitterAccess,
  subscribeToSitterGrants, subscribeToMySitterGrants,
} from '../src/sitters/sitterService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sitterService', () => {
  it('createSitterInvite writes a sitterInviteCodes doc and returns its code', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const code = await createSitterInvite(fakeDb, 'h1', ['pet-1', 'pet-2'], 2000);

    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
    expect(mockSetDoc).toHaveBeenCalledWith(mockCodeDocRef, {
      householdId: 'h1', petIds: ['pet-1', 'pet-2'], expiresAt: 2000,
    });
  });

  it('redeemSitterInvite reads the code doc, then writes a matching sitterAccess doc', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ householdId: 'h1', petIds: ['pet-1'], expiresAt: 2000 }),
    });
    mockSetDoc.mockResolvedValue(undefined);

    await redeemSitterInvite(fakeDb, 'sitter-uid-1', 'ABC123');

    expect(mockSetDoc).toHaveBeenCalledWith(mockGrantDocRef, {
      sitterUid: 'sitter-uid-1', householdId: 'h1', petIds: ['pet-1'],
      expiresAt: 2000, revoked: false, code: 'ABC123',
    });
  });

  it('redeemSitterInvite throws a friendly error for an unknown code', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await expect(redeemSitterInvite(fakeDb, 'sitter-uid-1', 'NOPE99')).rejects.toThrow('Invite code not found');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('revokeSitterAccess sets revoked: true on the sitter\'s own grant doc', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await revokeSitterAccess(fakeDb, 'h1', 'sitter-uid-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockGrantDocRef, { revoked: true });
  });

  it('subscribeToSitterGrants subscribes to the household\'s sitterAccess collection', () => {
    const callback = jest.fn();
    const fakeGrant = { sitterUid: 'sitter-uid-1', householdId: 'h1', petIds: ['pet-1'], expiresAt: 2000, revoked: false, code: 'ABC123' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeGrant }] });
      return () => {};
    });

    subscribeToSitterGrants(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([fakeGrant]);
  });

  it('subscribeToMySitterGrants queries the sitterAccess collection group by sitterUid', () => {
    const callback = jest.fn();
    const fakeGrant = { sitterUid: 'sitter-uid-1', householdId: 'h1', petIds: ['pet-1'], expiresAt: 2000, revoked: false, code: 'ABC123' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeGrant }] });
      return () => {};
    });

    subscribeToMySitterGrants(fakeDb, 'sitter-uid-1', callback);

    expect(mockCollectionGroup).toHaveBeenCalledWith(fakeDb, 'sitterAccess');
    expect(mockWhere).toHaveBeenCalledWith('sitterUid', '==', 'sitter-uid-1');
    expect(callback).toHaveBeenCalledWith([fakeGrant]);
  });
});
