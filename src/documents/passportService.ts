import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Vet } from '../types/vet';
import { Household } from '../types/household';
import { speciesDisplay } from '../pets/species';
import { formatGracefulDate, formatArrivalDate } from '../pets/dateGrace';
import { buildAndSharePdf } from './pdfService';

// This is a personal health-record summary the owner can hand to a sitter,
// boarder or new vet — NOT an official travel document. A real pet passport
// (e.g. the EU Pet Passport) is a regulated physical/digital document that
// must be issued and stamped by an accredited veterinarian, certifying
// things like the exact rabies vaccine batch number and an official
// signature — no app can produce something with that legal standing.
// What this CAN do is include everything the app already knows about the
// pet, so it reads as a real, useful summary rather than a stub with just a
// name and a partial vaccine list.
export function buildPassportHtml(pet: Pet, vaccines: Vaccine[], vets: Vet[], household: Household): string {
  const petVets = vets.filter((v) => v.petIds.includes(pet.id));
  // Full history, not a curated top-N — this document's job is now to be a
  // complete record, and HTML-to-PDF flows onto additional pages on its own.
  const allVaccines = [...vaccines].sort((a, b) => b.dateGiven - a.dateGiven);

  const sexLabel = !pet.sex || pet.sex === 'unknown' ? "Don't know" : pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1);
  const ownerNames = household.members.map((m) => m.displayName).join(', ') || '—';

  const profileRows = [
    `<tr><td>Species</td><td>${speciesDisplay(pet)}</td></tr>`,
    pet.breed && `<tr><td>Breed</td><td>${pet.breed}</td></tr>`,
    `<tr><td>Sex</td><td>${sexLabel}</td></tr>`,
    pet.neutered != null && `<tr><td>Neutered</td><td>${pet.neutered ? 'Yes' : 'No'}</td></tr>`,
    `<tr><td>Birth date</td><td>${formatGracefulDate(pet.birthDate, pet.birthDatePrecision, pet.approximateAgeMonths)}</td></tr>`,
    `<tr><td>Arrival date</td><td>${formatArrivalDate(pet.arrivalDate, pet.arrivalDatePrecision)}</td></tr>`,
    pet.colorMarkings && `<tr><td>Colour / markings</td><td>${pet.colorMarkings}</td></tr>`,
  ].filter(Boolean).join('');

  const microchipRows = [
    pet.microchipNumber && `<tr><td>Microchip number</td><td>${pet.microchipNumber}</td></tr>`,
    pet.microchipProvider && `<tr><td>Provider</td><td>${pet.microchipProvider}</td></tr>`,
    pet.microchipDate != null && `<tr><td>Implanted</td><td>${new Date(pet.microchipDate).toLocaleDateString()}</td></tr>`,
    pet.microchipRegistry && `<tr><td>Registry</td><td>${pet.microchipRegistry}</td></tr>`,
  ].filter(Boolean).join('');

  const vaccineRows = allVaccines.length > 0
    ? allVaccines.map((v) => `<tr><td>${v.name}</td><td>${new Date(v.dateGiven).toLocaleDateString()}</td></tr>`).join('')
    : '<tr><td colspan="2">No vaccinations recorded yet.</td></tr>';

  const vetRows = petVets.length > 0
    ? petVets.map((v) => `<tr><td>${v.clinicName}${v.doctorName ? ` (${v.doctorName})` : ''}</td><td>${v.phone || '—'}</td></tr>`).join('')
    : '<tr><td colspan="2">No vet assigned yet.</td></tr>';

  return `
<html>
  <head><meta charset="utf-8" /></head>
  <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1E1B2E;">
    <p style="font-size: 11px; color: #888; margin: 0 0 16px;">Personal pet health summary — not an official travel document.</p>
    <div style="display: flex; align-items: center; gap: 16px;">
      ${pet.photoUrl ? `<img src="${pet.photoUrl}" style="width: 96px; height: 96px; border-radius: 48px; object-fit: cover;" />` : ''}
      <div>
        <h1 style="margin-bottom: 4px;">${pet.name}</h1>
        <p style="color: #555; margin-top: 0;">${speciesDisplay(pet)}${pet.breed ? ` · ${pet.breed}` : ''}</p>
      </div>
    </div>
    <h2>Owner</h2>
    <table style="width:100%; border-collapse: collapse;">
      <tr><td>Household</td><td>${household.name}</td></tr>
      <tr><td>Owner(s)</td><td>${ownerNames}</td></tr>
    </table>
    <h2>Profile</h2>
    <table style="width:100%; border-collapse: collapse;">${profileRows}</table>
    ${microchipRows ? `<h2>Microchip</h2><table style="width:100%; border-collapse: collapse;">${microchipRows}</table>` : ''}
    <h2>Vaccination history</h2>
    <table style="width:100%; border-collapse: collapse;">${vaccineRows}</table>
    <h2>Vet contacts</h2>
    <table style="width:100%; border-collapse: collapse;">${vetRows}</table>
  </body>
</html>`;
}

export async function generatePassport(pet: Pet, vaccines: Vaccine[], vets: Vet[], household: Household): Promise<void> {
  const html = buildPassportHtml(pet, vaccines, vets, household);
  await buildAndSharePdf(html, `${pet.name} — Pet Health Summary.pdf`);
}
