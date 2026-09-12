export interface HouseholdMember {
  userId: string;
  displayName: string;
  joinedAt: number; // epoch millis
}

export interface Household {
  id: string;
  name: string;
  members: HouseholdMember[];
  // Denormalized list of just the `userId`s in `members`, kept in exact
  // lockstep with it by createHousehold/joinHousehold's atomic batches.
  // This exists ONLY for firestore.rules/storage.rules: the rules language
  // has no filter()/lambda support, so membership cannot be tested against
  // an array of member OBJECTS — but `request.auth.uid in
  // householdData.memberIds` on a plain string array is standard,
  // unambiguous rules syntax. Never update one of these two arrays without
  // updating the other in the same write; the rules' isJoining() enforces
  // that lockstep for untrusted join writes.
  memberIds: string[];
  inviteCode: string;
  createdAt: number;
}
