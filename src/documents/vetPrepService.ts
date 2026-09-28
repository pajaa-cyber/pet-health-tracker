import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Vet } from '../types/vet';
import { VetVisit } from '../types/vetVisit';
import { Medication } from '../types/medication';
import { WeightLog } from '../types/weightLog';
import { speciesDisplay } from '../pets/species';
import { formatPetAge } from '../pets/dateGrace';
import { kgToDisplay, unitLabel, WeightUnit } from '../pets/units';
import { computeWeightChangeOverDays } from '../pets/weightTrend';
import { buildAndSharePdf } from './pdfService';
import { wrapPdfDocument } from './pdfTemplate';

const RECENT_VISITS_SHOWN = 5;
const WEIGHT_WINDOW_DAYS = 30;

export interface VetPrepAnswers {
  reasonForVisit: string;
  startedDate: number | null;
  recentChanges: string;
  questions: string[]; // already split into individual questions, blanks filtered out
}

// A one-off briefing sheet the owner fills in right before a visit — not a
// saved record, so these answers live only in this generated document, not
// in Firestore. Distinct from Generate Passport (that one is a standing
// summary of what the app already knows; this one is "what's going on
// right now" plus that same standing context, laid out the way a vet
// actually wants to triage a visit).
export function buildVetPrepHtml(
  pet: Pet,
  answers: VetPrepAnswers,
  vaccines: Vaccine[],
  vets: Vet[],
  vetVisits: VetVisit[],
  medications: Medication[],
  weightLogs: WeightLog[],
  unit: WeightUnit,
  now: number
): string {
  const petVets = vets.filter((v) => v.petIds.includes(pet.id));
  const age = pet.birthDate != null ? formatPetAge(pet.birthDate, now) : null;

  const activeMeds = medications.filter((m) => m.startDate <= now && (m.endDate == null || m.endDate >= now));
  const medsHtml = activeMeds.length > 0
    ? `<ul>${activeMeds.map((m) => `<li>${m.name} — ${m.dosage}</li>`).join('')}</ul>`
    : '<p>None</p>';

  const weightChange = computeWeightChangeOverDays(weightLogs, WEIGHT_WINDOW_DAYS, now);
  const latestKg = [...weightLogs].sort((a, b) => b.date - a.date)[0]?.weight;
  const weightHtml = latestKg != null
    ? `<p>${kgToDisplay(latestKg, unit).toFixed(1)} ${unitLabel(unit)}${
        weightChange
          ? ` <span style="color:${weightChange.deltaKg >= 0 ? '#B91C1C' : '#15803D'};">(${weightChange.deltaKg >= 0 ? '+' : ''}${kgToDisplay(weightChange.deltaKg, unit).toFixed(1)} ${unitLabel(unit)} / ${WEIGHT_WINDOW_DAYS} days)</span>`
          : ''
      }</p>`
    : '<p>No weight logged yet.</p>';

  const recentVisits = [...vetVisits].sort((a, b) => b.date - a.date).slice(0, RECENT_VISITS_SHOWN);
  const visitsHtml = recentVisits.length > 0
    ? `<ul>${recentVisits.map((v) => `<li>${new Date(v.date).toLocaleDateString()} — ${v.reason || 'No reason given'}</li>`).join('')}</ul>`
    : '<p>No previous visits on record.</p>';

  // "Up to date" per distinct vaccine name — a name with no future
  // nextDueDate on its most recent entry is treated as not currently
  // tracked as due (never given a booster schedule), not as overdue.
  const latestByName = new Map<string, Vaccine>();
  for (const v of vaccines) {
    const existing = latestByName.get(v.name);
    if (!existing || v.dateGiven > existing.dateGiven) latestByName.set(v.name, v);
  }
  const overdue = [...latestByName.values()].filter((v) => v.nextDueDate != null && v.nextDueDate < now);
  const vaccinationHtml = latestByName.size === 0
    ? '<p>No vaccinations recorded yet.</p>'
    : overdue.length === 0
    ? '<p>Up to date</p>'
    : `<p style="color:#B91C1C;">Overdue: ${overdue.map((v) => v.name).join(', ')}</p>`;

  const vetsHtml = petVets.length > 0
    ? `<ul>${petVets.map((v) => `<li>${v.clinicName}${v.doctorName ? ` (${v.doctorName})` : ''}${v.phone ? ` — ${v.phone}` : ''}</li>`).join('')}</ul>`
    : '';

  const questionsHtml = answers.questions.length > 0
    ? `<ol>${answers.questions.map((q) => `<li>${q}</li>`).join('')}</ol>`
    : '';

  const bodyHtml = `
    <h2>Weight</h2>
    ${weightHtml}

    <h2>Vaccination status</h2>
    ${vaccinationHtml}

    <h2>Recent medical history</h2>
    ${visitsHtml}

    <h2>Current medications</h2>
    ${medsHtml}

    <h2>Known allergies</h2>
    <p>${pet.allergies || 'None known'}</p>

    ${vetsHtml ? `<h2>Vet contacts</h2>${vetsHtml}` : ''}

    <hr />

    <h2>Reason for visit</h2>
    <p>${answers.reasonForVisit || 'Not specified'}</p>

    ${answers.startedDate != null ? `<h2>Started</h2><p>${new Date(answers.startedDate).toLocaleDateString()}</p>` : ''}
    ${answers.recentChanges ? `<h2>Recent changes</h2><p>${answers.recentChanges}</p>` : ''}

    ${questionsHtml ? `<h2>Questions for veterinarian</h2>${questionsHtml}` : ''}`;

  const subtitle = `${speciesDisplay(pet)}${pet.breed ? ` · ${pet.breed}` : ''}${pet.sex && pet.sex !== 'unknown' ? ` · ${pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1)}` : ''}${age ? ` · ${age}` : ''}`;

  return wrapPdfDocument(pet, subtitle, null, bodyHtml);
}

export async function generateVetPrepReport(
  pet: Pet,
  answers: VetPrepAnswers,
  vaccines: Vaccine[],
  vets: Vet[],
  vetVisits: VetVisit[],
  medications: Medication[],
  weightLogs: WeightLog[],
  unit: WeightUnit
): Promise<void> {
  const html = buildVetPrepHtml(pet, answers, vaccines, vets, vetVisits, medications, weightLogs, unit, Date.now());
  await buildAndSharePdf(html, `${pet.name} — Vet Visit Prep.pdf`);
}
