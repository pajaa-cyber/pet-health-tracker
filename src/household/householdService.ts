import { collection, doc, setDoc, getDoc, updateDoc, arrayUnion, type Firestore } from '@react-native-firebase/firestore';
import { Household, HouseholdMember } from '../types/household';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createHousehold(
  db: Firestore,
  userId: string,
  displayName: string,
  householdName: string
): Promise<Household> {
  const member: HouseholdMember = { userId, displayName, joinedAt: Date.now() };
  const docRef = doc(collection(db, 'households'));
  const inviteCode = generateInviteCode();
  const household: Household = {
    id: docRef.id,
    name: householdName,
    members: [member],
    inviteCode,
    createdAt: Date.now(),
  };
  await setDoc(docRef, household);
  await setDoc(doc(db, 'inviteCodes', inviteCode), { householdId: docRef.id });
  return household;
}

export async function joinHousehold(
  db: Firestore,
  userId: string,
  displayName: string,
  inviteCode: string
): Promise<void> {
  const inviteSnap = await getDoc(doc(db, 'inviteCodes', inviteCode));

  if (!inviteSnap.exists()) {
    throw new Error('Invite code not found');
  }

  const { householdId } = inviteSnap.data() as { householdId: string };
  const newMember: HouseholdMember = { userId, displayName, joinedAt: Date.now() };

  await updateDoc(doc(db, 'households', householdId), {
    members: arrayUnion(newMember),
  });
}

export async function getHousehold(
  db: Firestore,
  householdId: string
): Promise<Household | null> {
  const docSnap = await getDoc(doc(db, 'households', householdId));
  return docSnap.exists() ? (docSnap.data() as Household) : null;
}
