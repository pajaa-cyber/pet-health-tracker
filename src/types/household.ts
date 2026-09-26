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
  // Denormalized running total of document-page bytes (Plan 8 Task 8),
  // updated by each createDocument() page write and self-healed by
  // reconcileDocumentsStorageBytes() on DocumentListScreen load. Optional:
  // absent on any household that existed before this field, and on a
  // brand-new household until its first document.
  documentsStorageBytes?: number;
  // Sub-project A of Plan 9 ("Subscriptions and release"). Set once, together,
  // by HouseholdContext's trial-start effect — never changed after. Optional:
  // absent until that effect has run at least once for this household.
  trialStartedAt?: number | null;
  trialEndsAt?: number | null;
}
