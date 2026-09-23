// buildPassportHtml doesn't touch expo-print/expo-sharing itself, but it
// shares a module with generatePassport (which does), and those packages
// ship ESM that Jest can't transform — same mock pdfService.test.ts uses.
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn() }));

import { buildPassportHtml } from '../src/documents/passportService';
import { Pet } from '../src/types/pet';
import { Vaccine } from '../src/types/vaccine';
import { Vet } from '../src/types/vet';

const basePet: Pet = {
  id: 'pet-1', householdId: 'h1', name: 'Macmac', species: 'cat', speciesOther: null,
  breed: 'Tabby', birthDate: null, birthDatePrecision: 'unknown', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#F59E0B',
  sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active',
};

describe('buildPassportHtml', () => {
  it('produces a document for a pet with almost no data, without crashing on nulls', () => {
    const html = buildPassportHtml(basePet, [], []);
    expect(html).toContain('Macmac');
    expect(html).toContain('<html');
  });

  it('includes microchip details when present', () => {
    const pet: Pet = { ...basePet, microchipNumber: '985141000123456', microchipProvider: 'PetLink' };
    const html = buildPassportHtml(pet, [], []);
    expect(html).toContain('985141000123456');
    expect(html).toContain('PetLink');
  });

  it('includes vet contacts assigned to this pet', () => {
    const vet: Vet = {
      id: 'vet-1', householdId: 'h1', clinicName: 'Riverside Vet Clinic', doctorName: 'Dr. Novak',
      address: '12 River Rd', phone: '5550100', openingHours: '', speciality: '', isEmergency24h: false,
      notes: '', petIds: ['pet-1'],
    };
    const html = buildPassportHtml(basePet, [], [vet]);
    expect(html).toContain('Riverside Vet Clinic');
    expect(html).toContain('5550100');
  });

  it('summarizes a long vaccination history to the most recent entries, not every row', () => {
    const manyVaccines: Vaccine[] = Array.from({ length: 40 }, (_, i) => ({
      id: `v${i}`, petId: 'pet-1', name: `Vaccine ${i}`, dateGiven: 1700000000000 + i, nextDueDate: null, vetName: '',
    }));
    const html = buildPassportHtml(basePet, manyVaccines, []);
    const occurrences = (html.match(/Vaccine \d+/g) ?? []).length;
    expect(occurrences).toBeLessThan(40);
    expect(occurrences).toBeGreaterThan(0);
  });
});
