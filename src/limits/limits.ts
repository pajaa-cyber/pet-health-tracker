export const FREE_CUSTOM_FIELDS_PER_PET = 3;
export const FREE_HOUSEHOLD_MEMBERS = 4;

export function canAddCustomField(pet: { customFields?: { label: string; value: string }[] }): boolean {
  return (pet.customFields?.length ?? 0) < FREE_CUSTOM_FIELDS_PER_PET;
}

export function customFieldLimitMessage(): string {
  return `The free plan includes ${FREE_CUSTOM_FIELDS_PER_PET} custom fields per pet. Upgrading unlocks unlimited custom fields.`;
}

export function canAddHouseholdMember(household: { members: unknown[] }): boolean {
  return household.members.length < FREE_HOUSEHOLD_MEMBERS;
}
