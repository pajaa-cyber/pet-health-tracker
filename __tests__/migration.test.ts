import type { Firestore } from '@react-native-firebase/firestore';

// migration.ts mixes TWO different doc() calling conventions from the real
// RNFB API: explicit-path calls like doc(db, 'households', householdId)
// (path segments ARE available to switch on), and single-argument auto-ID
// calls like doc(collection(db, ..., 'documents')) (no path segments at the
// doc() call itself — the collection() call that produced the ref is what
// carries the real path, so those two are matched by referential identity
// against collection()'s own mocked return values instead).
const mockDocumentsCollectionRef = { __name: 'documents' };
const mockPagesCollectionRef = { __name: 'pages' };
const mockCreatedDocumentRef = { id: 'new-doc-1' };
const mockCreatedPageRef = { id: 'new-page-1' };
const mockHouseholdDocRef = { id: 'household-ref' };
const mockVisitDocRef = { id: 'visit-ref' };
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn((..._args: unknown[]) => ({ set: mockBatchSet, update: mockBatchUpdate, commit: mockBatchCommit }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...pathSegments: string[]) => {
    if (pathSegments[pathSegments.length - 1] === 'pages') return mockPagesCollectionRef;
    if (pathSegments[pathSegments.length - 1] === 'documents') return mockDocumentsCollectionRef;
    return {}; // the pets/{petId}/vetVisits collection read via getDocs — its identity doesn't matter, getDocs is mocked directly below
  }),
  doc: jest.fn((refOrCollectionRef: unknown, ...pathSegments: string[]) => {
    if (refOrCollectionRef === mockPagesCollectionRef) return mockCreatedPageRef;
    if (refOrCollectionRef === mockDocumentsCollectionRef) return mockCreatedDocumentRef;
    if (pathSegments.includes('vetVisits')) return mockVisitDocRef;
    if (pathSegments[0] === 'households') return mockHouseholdDocRef;
    return {};
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { migrateVetVisitDocuments } from '../src/documents/migration';

const fakeDb = {} as Firestore;
const pets = [{ id: 'pet-1' } as any];

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
});

describe('migrateVetVisitDocuments', () => {
  it('does nothing if the household is already marked migrated', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ documentsMigratedAt: 123 }) });

    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('migrates a vet visit with documentUrls into a new Document + pages, then clears the old field', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) }); // not yet migrated
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            id: 'visit-1', petId: 'pet-1', date: 1700000000000, reason: 'Annual checkup',
            documentUrls: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
          }),
        },
      ],
    });

    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    // Per-visit batch: one set() for the new Document, one set() per page — all creates, never mixed with update().
    expect(mockBatchSet).toHaveBeenCalledWith(
      mockCreatedDocumentRef,
      expect.objectContaining({ petId: 'pet-1', sourceVisitId: 'visit-1', pageCount: 2, category: 'Vet visit document' })
    );
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedPageRef, expect.objectContaining({ order: 0, photoUrl: 'data:image/jpeg;base64,AAA' }));

    // Cleanup batch: all update() calls, never mixed with a set().
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockVisitDocRef, { documentUrls: [] });
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsMigratedAt: expect.any(Number) });
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('skips a vet visit with no documentUrls', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    mockGetDocs.mockResolvedValue({
      docs: [{ data: () => ({ id: 'visit-1', petId: 'pet-1', date: 1700000000000, reason: '', documentUrls: [] }) }],
    });

    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    expect(mockBatchSet).not.toHaveBeenCalled();
    // Still marks the household migrated even with nothing to migrate.
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsMigratedAt: expect.any(Number) });
  });
});
