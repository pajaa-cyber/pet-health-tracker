import { Household, HouseholdMember } from '../src/types/household';

describe('household types', () => {
  it('constructs a valid Household object', () => {
    const member: HouseholdMember = {
      userId: 'u1',
      displayName: 'Ana',
      joinedAt: Date.now(),
    };
    const household: Household = {
      id: 'h1',
      name: "Ana's Household",
      members: [member],
      memberIds: [member.userId],
      inviteCode: 'ABC123',
      createdAt: Date.now(),
    };
    expect(household.members).toHaveLength(1);
    // memberIds must mirror members exactly — it's what firestore.rules and
    // storage.rules actually authorize against.
    expect(household.memberIds).toEqual(household.members.map((m) => m.userId));
  });
});
