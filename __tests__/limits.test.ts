import {
  isSubscriptionActive, FREE_CUSTOM_FIELDS_PER_PET, FREE_HOUSEHOLD_MEMBERS, FREE_DOCUMENT_PHOTOS_PER_PET,
  canAddCustomField, customFieldLimitMessage,
  canAddHouseholdMember, householdMemberLimitMessage, isHouseholdFull,
  canAddDocumentPage, documentPhotoLimitMessage,
  canGeneratePassport, passportLimitMessage,
  canShareDocument, shareDocumentLimitMessage,
} from '../src/limits/limits';

const NOW = 1_700_000_000_000;
const activeHousehold = { trialEndsAt: NOW + 1000 };
const expiredHousehold = { trialEndsAt: NOW - 1000 };
const neverStartedHousehold = { trialEndsAt: null };

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('isSubscriptionActive', () => {
  it('is true while trialEndsAt is in the future', () => {
    expect(isSubscriptionActive(activeHousehold)).toBe(true);
  });
  it('is false once trialEndsAt has passed', () => {
    expect(isSubscriptionActive(expiredHousehold)).toBe(false);
  });
  it('is false when trialEndsAt was never set', () => {
    expect(isSubscriptionActive(neverStartedHousehold)).toBe(false);
  });
});

describe('canAddCustomField', () => {
  const petUnderCap = { customFields: [{ label: 'a', value: '1' }] };
  const petAtCap = { customFields: Array.from({ length: FREE_CUSTOM_FIELDS_PER_PET }, () => ({ label: 'a', value: '1' })) };

  it('enforces the free cap when not subscribed', () => {
    expect(canAddCustomField(petUnderCap, expiredHousehold)).toBe(true);
    expect(canAddCustomField(petAtCap, expiredHousehold)).toBe(false);
  });
  it('is always true while subscribed, regardless of the count', () => {
    expect(canAddCustomField(petAtCap, activeHousehold)).toBe(true);
  });
});

describe('canAddHouseholdMember', () => {
  const fullHousehold = { members: Array.from({ length: FREE_HOUSEHOLD_MEMBERS }, () => ({})) };

  it('enforces the free cap when not subscribed', () => {
    expect(canAddHouseholdMember({ ...fullHousehold, ...expiredHousehold })).toBe(false);
  });
  it('is always true while subscribed, regardless of member count', () => {
    expect(canAddHouseholdMember({ ...fullHousehold, ...activeHousehold })).toBe(true);
  });
});

describe('canAddDocumentPage', () => {
  it('enforces the free cap when not subscribed', () => {
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET - 1, expiredHousehold)).toBe(true);
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET, expiredHousehold)).toBe(false);
  });
  it('is always true while subscribed, regardless of the count', () => {
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET, activeHousehold)).toBe(true);
  });
});

describe('canGeneratePassport / canShareDocument', () => {
  it('are gated entirely behind subscription status', () => {
    expect(canGeneratePassport(expiredHousehold)).toBe(false);
    expect(canGeneratePassport(activeHousehold)).toBe(true);
    expect(canShareDocument(expiredHousehold)).toBe(false);
    expect(canShareDocument(activeHousehold)).toBe(true);
  });
});

describe('messages', () => {
  it('are non-empty strings mentioning the relevant constant', () => {
    expect(customFieldLimitMessage()).toContain(String(FREE_CUSTOM_FIELDS_PER_PET));
    expect(householdMemberLimitMessage()).toContain(String(FREE_HOUSEHOLD_MEMBERS));
    expect(documentPhotoLimitMessage()).toContain(String(FREE_DOCUMENT_PHOTOS_PER_PET));
    expect(passportLimitMessage().length).toBeGreaterThan(0);
    expect(shareDocumentLimitMessage().length).toBeGreaterThan(0);
  });
});

describe('isHouseholdFull (unchanged — used by the pre-join check, see Global Constraints)', () => {
  it('is true at exactly the free cap', () => {
    expect(isHouseholdFull(FREE_HOUSEHOLD_MEMBERS)).toBe(true);
    expect(isHouseholdFull(FREE_HOUSEHOLD_MEMBERS - 1)).toBe(false);
  });
});
