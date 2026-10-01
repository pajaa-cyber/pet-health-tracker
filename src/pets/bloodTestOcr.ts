export interface ParsedMarkerRow {
  marker: string;
  value: string;
  unit: string;
  referenceLow: string;
  referenceHigh: string;
}

// Layer 1 of the blood-test pipeline (see bloodTestAnalysis.ts's header
// comment for the full five-layer plan) — OCR text extraction only, never
// interpretation. This never decides whether a value is high/low/normal
// (computeMarkerStatus does that, later, mechanically) and never infers
// what a marker means (bloodMarkerGlossary does that). It just turns OCR'd
// lines into rows for AddBloodTestScreen's form, which the owner then
// reviews/edits/confirms before anything is saved — the same "did I read
// this right?" review step manual entry always required, just pre-filled.
//
// Best-effort, line-by-line: real lab report layouts vary too much for a
// single format-aware parser to be reliable, and a wrong reference range
// slipping through silently would be worse than parsing nothing and
// leaving the owner to type it. A line that doesn't match cleanly is
// simply skipped, not guessed at.
const RANGE_TOKEN = /^\(?(\d+\.?\d*)\s*(?:-|–|to)\s*(\d+\.?\d*)\)?$/;
const NUMBER_TOKEN = /^[-+]?\d+\.?\d*$/;
const DASH_TOKEN = /^[-–]$/;

function parseLine(rawLine: string): ParsedMarkerRow | null {
  const tokens = rawLine.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const valueIdx = tokens.findIndex((t, i) => i > 0 && NUMBER_TOKEN.test(t));
  if (valueIdx === -1) return null;

  const marker = tokens
    .slice(0, valueIdx)
    .join(' ')
    .replace(/[:,]+$/, '')
    .trim();
  if (!marker || marker.length > 40) return null;

  const value = tokens[valueIdx];
  const rest = tokens.slice(valueIdx + 1);

  for (let i = 0; i < rest.length; i++) {
    const oneToken = rest[i].match(RANGE_TOKEN);
    if (oneToken) {
      return {
        marker,
        value,
        unit: rest.slice(0, i).join(' '),
        referenceLow: oneToken[1],
        referenceHigh: oneToken[2],
      };
    }
    // A range can also survive OCR as three separate tokens ("7", "-",
    // "56") when whitespace around the dash gets preserved.
    if (NUMBER_TOKEN.test(rest[i]) && DASH_TOKEN.test(rest[i + 1] ?? '') && NUMBER_TOKEN.test(rest[i + 2] ?? '')) {
      return {
        marker,
        value,
        unit: rest.slice(0, i).join(' '),
        referenceLow: rest[i],
        referenceHigh: rest[i + 2],
      };
    }
  }

  // No reference range found on this line — whatever's left is the unit.
  return { marker, value, unit: rest.join(' '), referenceLow: '', referenceHigh: '' };
}

export function parseBloodTestText(text: string): ParsedMarkerRow[] {
  return text
    .split('\n')
    .map(parseLine)
    .filter((r): r is ParsedMarkerRow => r !== null);
}
