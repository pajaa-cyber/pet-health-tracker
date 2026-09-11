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
      inviteCode: 'ABC123',
      createdAt: Date.now(),
    };
    expect(household.members).toHaveLength(1);
  });
});
