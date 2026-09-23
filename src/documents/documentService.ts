import { collection, doc, getDocs, onSnapshot, updateDoc, writeBatch, type Firestore, type Unsubscribe } from '@react-native-firebase/firestore';
import { Document, DocumentPage } from '../types/document';

// A single homogeneous batch (all set() calls — never mix with update(), see
// this plan's Global Constraints) writes the parent document and every page
// document together, so a document with N pages either fully exists or
// doesn't exist at all — never partially.
export async function createDocument(
  db: Firestore,
  householdId: string,
  petId: string,
  title: string,
  category: string,
  date: number,
  pageUrls: string[],
  sourceVisitId: string | null = null,
  currentStorageBytes: number = 0
): Promise<Document> {
  const batch = writeBatch(db);
  const documentRef = doc(collection(db, 'households', householdId, 'documents'));

  const newDocument: Document = {
    id: documentRef.id,
    householdId,
    petId,
    title,
    category,
    date,
    sourceVisitId,
    pageCount: pageUrls.length,
    createdAt: Date.now(),
  };
  batch.set(documentRef, newDocument);

  let newBytes = 0;
  pageUrls.forEach((photoUrl, order) => {
    const pageRef = doc(collection(db, 'households', householdId, 'documents', documentRef.id, 'pages'));
    batch.set(pageRef, { id: pageRef.id, order, photoUrl });
    // Rough decoded-byte estimate from the base64 string length (base64 has
    // ~33% overhead) — precise enough for a soft warning threshold, and a
    // literal computed number rather than increment(), per this plan's
    // Global Constraints.
    newBytes += Math.ceil(photoUrl.length * 0.75);
  });

  await batch.commit();

  // A SEPARATE, single-update() batch — never mixed into the all-set()
  // batch above, per this plan's Global Constraints.
  const householdBatch = writeBatch(db);
  householdBatch.update(doc(db, 'households', householdId), { documentsStorageBytes: currentStorageBytes + newBytes });
  await householdBatch.commit();

  return newDocument;
}

// Self-healing correction, same pattern as Plan 7's reconcileMemberCount —
// called whenever DocumentListScreen loads, so a missed/failed update during
// createDocument can't drift the stored total permanently.
export async function reconcileDocumentsStorageBytes(db: Firestore, householdId: string): Promise<void> {
  const documentsSnap = await getDocs(collection(db, 'households', householdId, 'documents'));
  let totalBytes = 0;
  for (const documentDoc of documentsSnap.docs) {
    const pagesSnap = await getDocs(collection(db, 'households', householdId, 'documents', documentDoc.id, 'pages'));
    pagesSnap.docs.forEach((pageDoc) => {
      const page = pageDoc.data() as DocumentPage;
      totalBytes += Math.ceil(page.photoUrl.length * 0.75);
    });
  }
  await updateDoc(doc(db, 'households', householdId), { documentsStorageBytes: totalBytes });
}

export function subscribeToDocuments(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (documents: Document[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'documents'),
    (snap) => {
      const documents = snap.docs
        .map((d) => d.data() as Document)
        .filter((d) => d.petId === petId)
        .sort((a, b) => b.date - a.date);
      callback(documents);
    },
    (error) => {
      console.error('subscribeToDocuments listener error', error);
      callback([]);
    }
  );
}

export function subscribeToDocumentPages(
  db: Firestore,
  householdId: string,
  documentId: string,
  callback: (pages: DocumentPage[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'documents', documentId, 'pages'),
    (snap) => {
      const pages = snap.docs.map((d) => d.data() as DocumentPage).sort((a, b) => a.order - b.order);
      callback(pages);
    },
    (error) => {
      console.error('subscribeToDocumentPages listener error', error);
      callback([]);
    }
  );
}
