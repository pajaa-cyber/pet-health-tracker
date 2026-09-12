import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { VetVisit } from '../types/vetVisit';

export async function createVetVisit(
  db: Firestore,
  householdId: string,
  petId: string,
  date: number,
  reason: string,
  notes: string
): Promise<VetVisit> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'vetVisits'));
  const visit: VetVisit = { id: docRef.id, petId, date, reason, notes, documentUrls: [] };
  await setDoc(docRef, visit);
  return visit;
}

export function subscribeToVetVisits(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (visits: VetVisit[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'vetVisits'),
    (snap) => callback(snap.docs.map((d) => d.data() as VetVisit))
  );
}

export async function addVetVisitDocument(
  db: Firestore,
  householdId: string,
  petId: string,
  visitId: string,
  documentUrl: string
): Promise<void> {
  await updateDoc(
    doc(db, 'households', householdId, 'pets', petId, 'vetVisits', visitId),
    { documentUrls: arrayUnion(documentUrl) }
  );
}
