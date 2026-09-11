import { collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, limit, type Firestore } from '@react-native-firebase/firestore';
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
  const household: Household = {
    id: docRef.id,
    name: householdName,
    members: [member],
    inviteCode: generateInviteCode(),
    createdAt: Date.now(),
  };
  await setDoc(docRef, household);
  return household;
}

export async function joinHousehold(
  db: Firestore,
  userId: string,
  displayName: string,
  inviteCode: string
): Promise<Household> {
  const q = query(collection(db, 'households'), where('inviteCode', '==', inviteCode), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Invite code not found');
  }

  const docRef = snapshot.docs[0].ref;
  const household = snapshot.docs[0].data() as Household;
  const newMember: HouseholdMember = { userId, displayName, joinedAt: Date.now() };
  const updatedMembers = [...household.members, newMember];

  await updateDoc(docRef, { members: updatedMembers });
  return { ...household, members: updatedMembers };
}

export async function getHousehold(
  db: Firestore,
  householdId: string
): Promise<Household | null> {
  const docSnap = await getDoc(doc(db, 'households', householdId));
  return docSnap.exists() ? (docSnap.data() as Household) : null;
}
