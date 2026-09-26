export interface SitterAccessGrant {
  sitterUid: string; // same value as this document's own ID — see firestore.rules
  householdId: string;
  petIds: string[];
  expiresAt: number; // epoch millis
  revoked: boolean;
  code: string; // the sitterInviteCodes code redeemed to create this grant
}

export interface SitterInviteCode {
  householdId: string;
  petIds: string[];
  expiresAt: number;
}
