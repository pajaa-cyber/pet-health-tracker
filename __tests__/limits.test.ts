import {
  FREE_CUSTOM_FIELDS_PER_PET,
  FREE_HOUSEHOLD_MEMBERS,
  FREE_DOCUMENT_PHOTOS_PER_PET,
  canAddCustomField,
  canAddHouseholdMember,
  canAddDocumentPage,
  customFieldLimitMessage,
  isHouseholdFull,
  householdMemberLimitMessage,
  documentPhotoLimitMessage,
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

  it('reports a household as full at exactly the free member limit', () => {
    expect(isHouseholdFull(4)).toBe(true);
    expect(isHouseholdFull(3)).toBe(false);
  });

  it('returns an explanatory household-limit message, not a bare refusal', () => {
    expect(householdMemberLimitMessage()).toContain('4 household members');
  });
});

describe('document photo limit', () => {
  it('allows adding a page while under the free limit', () => {
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET - 1)).toBe(true);
  });

  it('denies adding a page once at the free limit', () => {
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET)).toBe(false);
  });

  it('returns a friendly message naming the limit', () => {
    expect(documentPhotoLimitMessage()).toContain(String(FREE_DOCUMENT_PHOTOS_PER_PET));
  });
});
