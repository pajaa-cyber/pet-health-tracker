import { collection, doc, onSnapshot, writeBatch, type Firestore, type Unsubscribe } from '@react-native-firebase/firestore';
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
  sourceVisitId: string | null = null
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

  pageUrls.forEach((photoUrl, order) => {
    const pageRef = doc(collection(db, 'households', householdId, 'documents', documentRef.id, 'pages'));
    batch.set(pageRef, { id: pageRef.id, order, photoUrl });
  });

  await batch.commit();
  return newDocument;
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
