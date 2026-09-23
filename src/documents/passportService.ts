import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Vet } from '../types/vet';
import { speciesDisplay } from '../pets/species';
import { buildAndSharePdf } from './pdfService';

const MOST_RECENT_VACCINES_SHOWN = 8; // keeps a heavy vaccination history to one page — a curated summary, not a full log dump

export function buildPassportHtml(pet: Pet, vaccines: Vaccine[], vets: Vet[]): string {
  const petVets = vets.filter((v) => v.petIds.includes(pet.id));
  const recentVaccines = [...vaccines].sort((a, b) => b.dateGiven - a.dateGiven).slice(0, MOST_RECENT_VACCINES_SHOWN);

  const microchipRows = [
    pet.microchipNumber && `<tr><td>Microchip number</td><td>${pet.microchipNumber}</td></tr>`,
    pet.microchipProvider && `<tr><td>Provider</td><td>${pet.microchipProvider}</td></tr>`,
    pet.microchipRegistry && `<tr><td>Registry</td><td>${pet.microchipRegistry}</td></tr>`,
  ].filter(Boolean).join('');

  const vaccineRows = recentVaccines.length > 0
    ? recentVaccines.map((v) => `<tr><td>${v.name}</td><td>${new Date(v.dateGiven).toLocaleDateString()}</td></tr>`).join('')
    : '<tr><td colspan="2">No vaccinations recorded yet.</td></tr>';

  const vetRows = petVets.length > 0
    ? petVets.map((v) => `<tr><td>${v.clinicName}${v.doctorName ? ` (${v.doctorName})` : ''}</td><td>${v.phone || '—'}</td></tr>`).join('')
    : '<tr><td colspan="2">No vet assigned yet.</td></tr>';

  return `
<html>
  <head><meta charset="utf-8" /></head>
  <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1E1B2E;">
    <h1 style="margin-bottom: 4px;">${pet.name}</h1>
    <p style="color: #555; margin-top: 0;">${speciesDisplay(pet)}${pet.breed ? ` · ${pet.breed}` : ''}</p>
    ${microchipRows ? `<h2>Microchip</h2><table style="width:100%; border-collapse: collapse;">${microchipRows}</table>` : ''}
    <h2>Recent vaccinations</h2>
    <table style="width:100%; border-collapse: collapse;">${vaccineRows}</table>
    <h2>Vet contacts</h2>
    <table style="width:100%; border-collapse: collapse;">${vetRows}</table>
  </body>
</html>`;
}

export async function generatePassport(pet: Pet, vaccines: Vaccine[], vets: Vet[]): Promise<void> {
  const html = buildPassportHtml(pet, vaccines, vets);
  await buildAndSharePdf(html, `${pet.name} — Pet Passport.pdf`);
}
