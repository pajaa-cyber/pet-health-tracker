// buildPassportHtml doesn't touch expo-print/expo-sharing itself, but it
// shares a module with generatePassport (which does), and those packages
// ship ESM that Jest can't transform — same mock pdfService.test.ts uses.
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn() }));

import { buildPassportHtml } from '../src/documents/passportService';
import { Pet } from '../src/types/pet';
import { Vaccine } from '../src/types/vaccine';
import { Vet } from '../src/types/vet';
import { Household } from '../src/types/household';

const basePet: Pet = {
  id: 'pet-1', householdId: 'h1', name: 'Macmac', species: 'cat', speciesOther: null,
  breed: 'Tabby', birthDate: null, birthDatePrecision: 'unknown', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#F59E0B',
  sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active',
};

const baseHousehold: Household = {
  id: 'h1', name: 'Pajevic Household',
  members: [{ userId: 'u1', displayName: 'Mpajevic7', joinedAt: 1700000000000 }],
  memberIds: ['u1'], inviteCode: 'ABC123', createdAt: 1700000000000,
};

describe('buildPassportHtml', () => {
  it('produces a document for a pet with almost no data, without crashing on nulls', () => {
    const html = buildPassportHtml(basePet, [], [], baseHousehold);
    expect(html).toContain('Macmac');
    expect(html).toContain('<html');
  });

  it('includes the household name and owner display names', () => {
    const html = buildPassportHtml(basePet, [], [], baseHousehold);
    expect(html).toContain('Pajevic Household');
    expect(html).toContain('Mpajevic7');
  });

  it('includes microchip details when present', () => {
    const pet: Pet = { ...basePet, microchipNumber: '985141000123456', microchipProvider: 'PetLink' };
    const html = buildPassportHtml(pet, [], [], baseHousehold);
    expect(html).toContain('985141000123456');
    expect(html).toContain('PetLink');
  });

  it('includes vet contacts assigned to this pet', () => {
    const vet: Vet = {
      id: 'vet-1', householdId: 'h1', clinicName: 'Riverside Vet Clinic', doctorName: 'Dr. Novak',
      address: '12 River Rd', phone: '5550100', openingHours: '', speciality: '', isEmergency24h: false,
      notes: '', petIds: ['pet-1'],
    };
    const html = buildPassportHtml(basePet, [], [vet], baseHousehold);
    expect(html).toContain('Riverside Vet Clinic');
    expect(html).toContain('5550100');
  });

  // This document's job changed from a curated one-pager to a complete
  // record — a long vaccination history should now show every entry
  // (HTML-to-PDF just flows onto more pages), not a truncated top-N.
  it('includes every vaccination, not a truncated summary', () => {
    const manyVaccines: Vaccine[] = Array.from({ length: 40 }, (_, i) => ({
      id: `v${i}`, petId: 'pet-1', name: `Vaccine ${i}`, dateGiven: 1700000000000 + i, nextDueDate: null, vetName: '',
    }));
    const html = buildPassportHtml(basePet, manyVaccines, [], baseHousehold);
    const occurrences = (html.match(/Vaccine \d+/g) ?? []).length;
    expect(occurrences).toBe(40);
  });
});
