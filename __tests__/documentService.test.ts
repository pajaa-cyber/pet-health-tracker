import type { Firestore } from '@react-native-firebase/firestore';

// documentService.ts's real code always calls doc(collectionRef) with a
// SINGLE argument for a new auto-ID ref (the same convention
// householdService.ts's createHousehold already uses for docRef =
// doc(collection(db, 'households'))) — there is no path string to switch on
// at the doc() call itself for those. The household ref (Task 8) is the one
// explicit-path call, doc(db, 'households', householdId), matched by its
// first path segment the same way migration.test.ts already does.
const mockDocumentsCollectionRef = { __name: 'documents' };
const mockPagesCollectionRef = { __name: 'pages' };
const mockCreatedDocumentRef = { id: 'doc-1' };
const mockCreatedPageRefs = [{ id: 'page-1' }, { id: 'page-2' }];
const mockHouseholdDocRef = { id: 'household-ref' };
let pageRefCallCount = 0;
const mockOnSnapshot = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();

// Each writeBatch() call gets its OWN fresh set of set()/update()/commit()
// spies (same reasoning as migration.test.ts): createDocument makes two
// separate batches (content, then the household byte-total update), and a
// shared spy object across both would hide a regression that merged them.
type FakeBatch = { set: jest.Mock; update: jest.Mock; commit: jest.Mock };
let createdBatches: FakeBatch[] = [];
const mockWriteBatch = jest.fn((..._args: unknown[]) => {
  const batch: FakeBatch = { set: jest.fn(), update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  createdBatches.push(batch);
  return batch;
});

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...pathSegments: string[]) => {
    if (pathSegments[pathSegments.length - 1] === 'pages') return mockPagesCollectionRef;
    return mockDocumentsCollectionRef;
  }),
  doc: jest.fn((refOrCollectionRef: unknown, ...pathSegments: string[]) => {
    if (refOrCollectionRef === mockPagesCollectionRef) return mockCreatedPageRefs[pageRefCallCount++];
    if (pathSegments[0] === 'households') return mockHouseholdDocRef;
    return mockCreatedDocumentRef;
  }),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { createDocument, subscribeToDocuments, subscribeToDocumentPages, reconcileDocumentsStorageBytes } from '../src/documents/documentService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  pageRefCallCount = 0;
  createdBatches = [];
});

describe('documentService', () => {
  it('creates a document and writes one page doc per photo, all in one batch', async () => {
    const result = await createDocument(
      fakeDb, 'h1', 'pet-1', 'Rabies booklet', 'Vaccination booklet', 1700000000000,
      ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB']
    );

    expect(result).toEqual({
      id: 'doc-1', householdId: 'h1', petId: 'pet-1', title: 'Rabies booklet',
      category: 'Vaccination booklet', date: 1700000000000, sourceVisitId: null,
      pageCount: 2, createdAt: expect.any(Number),
    });
    const contentBatch = createdBatches[0];
    expect(mockWriteBatch).toHaveBeenCalledWith(fakeDb);
    expect(contentBatch.set).toHaveBeenCalledWith(mockCreatedDocumentRef, result);
    expect(contentBatch.set).toHaveBeenCalledWith(mockCreatedPageRefs[0], {
      id: 'page-1', order: 0, photoUrl: 'data:image/jpeg;base64,AAA',
    });
    expect(contentBatch.set).toHaveBeenCalledWith(mockCreatedPageRefs[1], {
      id: 'page-2', order: 1, photoUrl: 'data:image/jpeg;base64,BBB',
    });
    expect(contentBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('sets sourceVisitId when provided (the migration path)', async () => {
    const result = await createDocument(
      fakeDb, 'h1', 'pet-1', 'Vet visit — 1/1/2024', 'Vet visit document', 1700000000000,
      ['data:image/jpeg;base64,AAA'], 'visit-1'
    );
    expect(result.sourceVisitId).toBe('visit-1');
  });

  it('subscribes to a pet\'s documents', () => {
    const callback = jest.fn();
    subscribeToDocuments(fakeDb, 'h1', 'pet-1', callback);
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('subscribes to a document\'s pages', () => {
    const callback = jest.fn();
    subscribeToDocumentPages(fakeDb, 'h1', 'doc-1', callback);
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('createDocument writes a literal new documentsStorageBytes total, never increment()', async () => {
    const photoUrl = 'data:image/jpeg;base64,AAAA'; // full data URI, 27 chars
    await createDocument(
      fakeDb, 'h1', 'pet-1', 'Title', 'Category', 1700000000000,
      [photoUrl], null, 1000 // currentStorageBytes
    );
    // 1000 (existing) + Math.ceil(27 * 0.75) = 1000 + 21 = 1021 — the estimate
    // is over the FULL data-URI string length (prefix included), not just the
    // base64 payload portion, matching the real implementation exactly. A
    // literal number, never { __increment: N }.
    const householdBatch = createdBatches[1];
    expect(householdBatch.update).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsStorageBytes: 1021 });
  });

  it('reconcileDocumentsStorageBytes sums every page across every document', async () => {
    mockGetDocs.mockImplementation((ref: unknown) => {
      if (ref === mockDocumentsCollectionRef) {
        return Promise.resolve({ docs: [{ id: 'doc-1' }, { id: 'doc-2' }] });
      }
      // Both documents share the same mocked pages collection ref in this
      // test double, so return one page per call regardless of which
      // document it's "for" — sums across all getDocs(pages) calls either way.
      return Promise.resolve({ docs: [{ data: () => ({ id: 'page-1', order: 0, photoUrl: 'data:image/jpeg;base64,AAAA' }) }] });
    });

    await reconcileDocumentsStorageBytes(fakeDb, 'h1');

    // Two documents × one page each × Math.ceil(27 * 0.75) = 2 × 21 = 42.
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsStorageBytes: 42 });
  });
});
