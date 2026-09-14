import {
  FREE_CUSTOM_FIELDS_PER_PET,
  FREE_HOUSEHOLD_MEMBERS,
  canAddCustomField,
  canAddHouseholdMember,
  customFieldLimitMessage,
} from '../src/limits/limits';

describe('limits', () => {
  it('exposes the locked free-tier constants', () => {
    expect(FREE_CUSTOM_FIELDS_PER_PET).toBe(3);
    expect(FREE_HOUSEHOLD_MEMBERS).toBe(4);
  });

  it('allows another custom field below the limit', () => {
    expect(canAddCustomField({ customFields: [{ label: 'a', value: '1' }] })).toBe(true);
  });

  it('denies another custom field at the limit', () => {
    const three = [
      { label: 'a', value: '1' }, { label: 'b', value: '2' }, { label: 'c', value: '3' },
    ];
    expect(canAddCustomField({ customFields: three })).toBe(false);
  });

  it('allows a custom field when the pet has none yet (undefined)', () => {
    expect(canAddCustomField({})).toBe(true);
  });

  it('returns an explanatory message, not a bare refusal', () => {
    expect(customFieldLimitMessage()).toContain('3');
  });

  it('allows another household member below the limit', () => {
    expect(canAddHouseholdMember({ members: [1, 2, 3] })).toBe(true);
  });

  it('denies another household member at the limit', () => {
    expect(canAddHouseholdMember({ members: [1, 2, 3, 4] })).toBe(false);
  });
});
