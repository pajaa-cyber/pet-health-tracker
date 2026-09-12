import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Pet, PetSpecies } from '../types/pet';

export async function createPet(
  db: Firestore,
  householdId: string,
  name: string,
  species: PetSpecies,
  breed: string,
  birthDate: number
): Promise<Pet> {
  const docRef = doc(collection(db, 'households', householdId, 'pets'));
  const pet: Pet = { id: docRef.id, householdId, name, species, breed, birthDate, photoUrl: null };
  await setDoc(docRef, pet);
  return pet;
}

export async function getPet(db: Firestore, householdId: string, petId: string): Promise<Pet | null> {
  const snap = await getDoc(doc(db, 'households', householdId, 'pets', petId));
  return snap.exists() ? (snap.data() as Pet) : null;
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
