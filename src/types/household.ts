export interface HouseholdMember {
  userId: string;
  displayName: string;
  joinedAt: number; // epoch millis
}

export interface Household {
  id: string;
  name: string;
  members: HouseholdMember[];
  inviteCode: string;
  createdAt: number;
}
