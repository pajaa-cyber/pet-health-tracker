jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn() }));

import { buildVetPrepHtml, VetPrepAnswers } from '../src/documents/vetPrepService';
import { Pet } from '../src/types/pet';
import { Vaccine } from '../src/types/vaccine';
import { Vet } from '../src/types/vet';
import { VetVisit } from '../src/types/vetVisit';
import { Medication } from '../src/types/medication';
import { WeightLog } from '../src/types/weightLog';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = 100 * DAY_MS;

const basePet: Pet = {
  id: 'pet-1', householdId: 'h1', name: 'Max', species: 'dog', speciesOther: null,
  breed: 'Golden Retriever', birthDate: null, birthDatePrecision: 'unknown', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#F59E0B',
  sex: 'male', neutered: null, colorMarkings: '', allergies: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active',
};

const emptyAnswers: VetPrepAnswers = { reasonForVisit: '', startedDate: null, recentChanges: '', questions: [] };

describe('buildVetPrepHtml', () => {
  it('produces a document for a pet with almost no data, without crashing on nulls', () => {
    const html = buildVetPrepHtml(basePet, emptyAnswers, [], [], [], [], [], 'kg', now);
    expect(html).toContain('Max');
    expect(html).toContain('<html');
  });

  it('includes the owner-provided reason, started date, recent changes and questions', () => {
    const answers: VetPrepAnswers = {
      reasonForVisit: 'Vomiting x2', startedDate: now - 2 * DAY_MS, recentChanges: 'Food changed',
      questions: ['Is this serious?', 'Any dietary change needed?'],
    };
    const html = buildVetPrepHtml(basePet, answers, [], [], [], [], [], 'kg', now);
    expect(html).toContain('Vomiting x2');
    expect(html).toContain('Food changed');
    expect(html).toContain('Is this serious?');
    expect(html).toContain('Any dietary change needed?');
  });

  it('lists only currently active medications', () => {
    const meds: Medication[] = [
      { id: 'm1', petId: 'pet-1', name: 'Active Med', dosage: '5mg', schedule: { timesPerDay: 1, intervalDays: 1 }, startDate: now - DAY_MS, endDate: null, log: [] },
      { id: 'm2', petId: 'pet-1', name: 'Finished Med', dosage: '2mg', schedule: { timesPerDay: 1, intervalDays: 1 }, startDate: now - 20 * DAY_MS, endDate: now - 10 * DAY_MS, log: [] },
    ];
    const html = buildVetPrepHtml(basePet, emptyAnswers, [], [], [], meds, [], 'kg', now);
    expect(html).toContain('Active Med');
    expect(html).not.toContain('Finished Med');
  });

  it('shows the pet\'s allergies, or "None known" when unset', () => {
    const html1 = buildVetPrepHtml(basePet, emptyAnswers, [], [], [], [], [], 'kg', now);
    expect(html1).toContain('None known');
    const html2 = buildVetPrepHtml({ ...basePet, allergies: 'Chicken' }, emptyAnswers, [], [], [], [], [], 'kg', now);
    expect(html2).toContain('Chicken');
  });

  it('shows the latest weight with the 30-day change', () => {
    const logs: WeightLog[] = [
      { id: 'w1', petId: 'pet-1', weight: 28.3, date: now - 40 * DAY_MS },
      { id: 'w2', petId: 'pet-1', weight: 29.4, date: now },
    ];
    const html = buildVetPrepHtml(basePet, emptyAnswers, [], [], [], [], logs, 'kg', now);
    expect(html).toContain('29.4 kg');
    expect(html).toContain('+1.1 kg / 30 days');
  });

  it('reports vaccination status as up to date when nothing is overdue', () => {
    const vaccines: Vaccine[] = [{ id: 'v1', petId: 'pet-1', name: 'Rabies', dateGiven: now - 30 * DAY_MS, nextDueDate: now + 300 * DAY_MS, vetName: '' }];
    const html = buildVetPrepHtml(basePet, emptyAnswers, vaccines, [], [], [], [], 'kg', now);
    expect(html).toContain('Up to date');
  });

  it('lists overdue vaccines by name when a nextDueDate has passed', () => {
    const vaccines: Vaccine[] = [{ id: 'v1', petId: 'pet-1', name: 'Rabies', dateGiven: now - 400 * DAY_MS, nextDueDate: now - 30 * DAY_MS, vetName: '' }];
    const html = buildVetPrepHtml(basePet, emptyAnswers, vaccines, [], [], [], [], 'kg', now);
    expect(html).toContain('Overdue');
    expect(html).toContain('Rabies');
  });

  it('includes recent vet visits, most recent first', () => {
    const visits: VetVisit[] = [
      { id: 'vv1', petId: 'pet-1', date: now - 60 * DAY_MS, reason: 'Checkup', notes: '', followUpDate: null },
      { id: 'vv2', petId: 'pet-1', date: now - 5 * DAY_MS, reason: 'Limping', notes: '', followUpDate: null },
    ];
    const html = buildVetPrepHtml(basePet, emptyAnswers, [], [], visits, [], [], 'kg', now);
    expect(html.indexOf('Limping')).toBeLessThan(html.indexOf('Checkup'));
  });

  it('includes vet contacts assigned to this pet', () => {
    const vet: Vet = {
      id: 'vet-1', householdId: 'h1', clinicName: 'Riverside Vet Clinic', doctorName: 'Dr. Novak',
      address: '', phone: '5550100', openingHours: '', speciality: '', isEmergency24h: false, notes: '', petIds: ['pet-1'],
    };
    const html = buildVetPrepHtml(basePet, emptyAnswers, [], [vet], [], [], [], 'kg', now);
    expect(html).toContain('Riverside Vet Clinic');
  });
});
