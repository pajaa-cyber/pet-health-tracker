import {
  collection,
  doc,
  documentId,
  query,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  where,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Pet } from '../types/pet';
import { assignPetColor } from '../theme/petColors';

export type NewPetInput = Omit<Pet, 'id' | 'householdId' | 'photoUrl' | 'colorKey'>;

export async function createPet(
  db: Firestore,
  householdId: string,
  input: NewPetInput,
  existingPets: Pet[]
): Promise<Pet> {
  const docRef = doc(collection(db, 'households', householdId, 'pets'));
  const pet: Pet = {
    ...input,
    id: docRef.id,
    householdId,
    photoUrl: null,
    colorKey: assignPetColor(existingPets),
  };
  await setDoc(docRef, pet);
  return pet;
}

export async function updatePet(
  db: Firestore,
  householdId: string,
  petId: string,
  updates: Partial<Pet>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId), updates);
}

export async function updatePetPhoto(
  db: Firestore,
  householdId: string,
  petId: string,
  photoUrl: string
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId), { photoUrl });
}

export async function updatePetColor(
  db: Firestore,
  householdId: string,
  petId: string,
  colorKey: string
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId), { colorKey });
}

export async function getPet(db: Firestore, householdId: string, petId: string): Promise<Pet | null> {
  const snap = await getDoc(doc(db, 'households', householdId, 'pets', petId));
  return snap.exists() ? (snap.data() as Pet) : null;
}

export function activePets(pets: Pet[]): Pet[] {
  return pets.filter((p) => (p.status ?? 'active') === 'active');
}

export function subscribeToPets(
  db: Firestore,
  householdId: string,
  callback: (pets: Pet[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets'),
    (snap) => callback(snap.docs.map((d) => d.data() as Pet)),
    // A live listener can start failing after it is already running (e.g.
    // permission-denied once membership changes, or an offline/cache
    // error). Without this the success callback simply stops firing and the
    // calling screen's list stays frozen on stale data forever with no
    // diagnostic. Same convention as HouseholdContext.tsx: log it, then
    // reset to a safe empty state rather than leave stale data on screen.
    (error) => {
      console.error('subscribeToPets listener error', error);
      callback([]);
    }
  );
}

// A sitter's grant only covers specific pets, never the whole household, so
// SitterViewScreen can't use subscribeToPets above: fetching the unfiltered
// pets collection and filtering to grant.petIds client-side is exactly the
// pattern Firestore's list-query provability rejects (a real on-device bug,
// found alongside subscribeToMySitterGrants's collectionGroup-query
// authorization gap) — the rule (isValidSitterForPet) is only true for the
// sitter's own granted pets, not every doc the unfiltered query could
// return, so Firestore refuses the whole list. A where(documentId(),'in',…)
// filter constrains the query's own potential result set to exactly the
// granted pets, which is provable the same way sitterUid equality made the
// collection-group query provable.
export function subscribeToSitterPets(
  db: Firestore,
  householdId: string,
  petIds: string[],
  callback: (pets: Pet[]) => void
): Unsubscribe {
  if (petIds.length === 0) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'households', householdId, 'pets'), where(documentId(), 'in', petIds)),
    (snap) => callback(snap.docs.map((d) => d.data() as Pet)),
    (error) => {
      console.error('subscribeToSitterPets listener error', error);
      callback([]);
    }
  );
}
