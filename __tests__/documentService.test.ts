import type { Firestore } from '@react-native-firebase/firestore';

// documentService.ts's real code always calls doc(collectionRef) with a
// SINGLE argument for a new auto-ID ref (the same convention
// householdService.ts's createHousehold already uses for docRef =
// doc(collection(db, 'households'))) — there is no path string to switch on
// at the doc() call itself. The two call sites are distinguished instead by
// WHICH collection() call produced the ref they're built from, matched by
// object identity below — collection()'s own arguments DO carry a real path.
const mockDocumentsCollectionRef = { __name: 'documents' };
const mockPagesCollectionRef = { __name: 'pages' };
const mockCreatedDocumentRef = { id: 'doc-1' };
const mockCreatedPageRefs = [{ id: 'page-1' }, { id: 'page-2' }];
let pageRefCallCount = 0;
const mockOnSnapshot = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn((..._args: unknown[]) => ({ set: mockBatchSet, commit: mockBatchCommit }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...pathSegments: string[]) => {
    if (pathSegments[pathSegments.length - 1] === 'pages') return mockPagesCollectionRef;
    return mockDocumentsCollectionRef;
  }),
  doc: jest.fn((collectionRef: unknown) => {
    if (collectionRef === mockPagesCollectionRef) return mockCreatedPageRefs[pageRefCallCount++];
    return mockCreatedDocumentRef;
  }),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { createDocument, subscribeToDocuments, subscribeToDocumentPages } from '../src/documents/documentService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  pageRefCallCount = 0;
  mockBatchCommit.mockResolvedValue(undefined);
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
    expect(mockWriteBatch).toHaveBeenCalledWith(fakeDb);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedDocumentRef, result);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedPageRefs[0], {
      id: 'page-1', order: 0, photoUrl: 'data:image/jpeg;base64,AAA',
    });
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedPageRefs[1], {
      id: 'page-2', order: 1, photoUrl: 'data:image/jpeg;base64,BBB',
    });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
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
});
