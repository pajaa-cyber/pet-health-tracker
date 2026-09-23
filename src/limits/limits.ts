export function isSubscriptionActive(household: { trialEndsAt?: number | null }): boolean {
  return (household.trialEndsAt ?? 0) > Date.now();
}

export const FREE_CUSTOM_FIELDS_PER_PET = 3;
export const FREE_HOUSEHOLD_MEMBERS = 4;
export const FREE_DOCUMENT_PHOTOS_PER_PET = 30;

export function canAddCustomField(
  pet: { customFields?: { label: string; value: string }[] },
  household: { trialEndsAt?: number | null }
): boolean {
  if (isSubscriptionActive(household)) return true;
  return (pet.customFields?.length ?? 0) < FREE_CUSTOM_FIELDS_PER_PET;
}

export function customFieldLimitMessage(): string {
  return `The free plan includes ${FREE_CUSTOM_FIELDS_PER_PET} custom fields per pet. Upgrading unlocks unlimited custom fields.`;
}

// Unchanged on purpose — still used by householdService.ts's joinHousehold
// pre-check, which has no access to trialEndsAt. See this plan's Global
// Constraints.
export function isHouseholdFull(memberCount: number): boolean {
  return memberCount >= FREE_HOUSEHOLD_MEMBERS;
}

export function householdMemberLimitMessage(): string {
  return `The free plan includes up to ${FREE_HOUSEHOLD_MEMBERS} household members. Upgrading lifts the limit.`;
}

export function canAddHouseholdMember(
  household: { trialEndsAt?: number | null; members: unknown[] }
): boolean {
  if (isSubscriptionActive(household)) return true;
  return !isHouseholdFull(household.members.length);
}

export function canAddDocumentPage(
  pageCountSoFar: number,
  household: { trialEndsAt?: number | null }
): boolean {
  if (isSubscriptionActive(household)) return true;
  return pageCountSoFar < FREE_DOCUMENT_PHOTOS_PER_PET;
}

export function documentPhotoLimitMessage(): string {
  return `The free plan includes ${FREE_DOCUMENT_PHOTOS_PER_PET} document photos per pet. Upgrading unlocks unlimited photos.`;
}

export function canGeneratePassport(household: { trialEndsAt?: number | null }): boolean {
  return isSubscriptionActive(household);
}

export function passportLimitMessage(): string {
  return 'Generating a pet passport is a paid feature. Start your free trial or upgrade to use it.';
}

export function canShareDocument(household: { trialEndsAt?: number | null }): boolean {
  return isSubscriptionActive(household);
}

export function shareDocumentLimitMessage(): string {
  return 'Sharing documents is a paid feature. Start your free trial or upgrade to use it.';
}
