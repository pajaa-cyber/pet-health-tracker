# Plan 8 — Medical records, documents, passport — build and device verification, 2026-09-23

Archived from `CLAUDE.md` / `NEXTSTEPS.md`. The durable architecture (the
`documents`/`pages` collection shape, `documentsStorageBytes`, the shared
`pdfService.ts` mechanism) stays in CLAUDE.md.

## What it was

Phase 6 of the execution pack: multi-page document storage (replacing the old
one-document-holds-everything `VetVisit.documentUrls` array, which broke once
a visit accumulated ten to twenty photos and risked Firestore's 1 MiB
per-document limit), a one-page PDF pet passport generated on-device, and
document sharing. Built in a dedicated worktree at `C:\dev\documents-passport`
(branch `documents-passport`, off `master` at `96e5dda`), spec
`docs/superpowers/specs/2026-09-23-medical-records-documents-passport-design.md`,
plan `docs/superpowers/plans/2026-09-23-medical-records-documents-passport.md`.

## Build record

10 tasks. A pre-flight conflict scan across the whole plan (before Task 1 was
dispatched) found and fixed three real defects in the plan's own test mocks
before any implementer could hit them — see the plan's own pre-flight notes.

Tasks 1-3 were built via `superpowers:subagent-driven-development`
(implementer + reviewer dispatch), each reviewed clean or fixed and
re-reviewed clean. **Partway through Task 4**, the owner asked to stop all
subagent dispatch for the rest of the session — a concern about the harness's
lifetime "N agents" UI counter, mistaken for concurrently-running processes;
verified false via `ListAgents`/`TaskStop` each time, but the owner asked to
stop regardless. Tasks 4-10 were completed by the controller session working
inline instead: implement directly against the plan/brief, verify sample code
against real source files before writing anything, `tsc` + full `jest` (+ the
emulator rules suite) after each task, self-review the diff, commit, push.

Real gaps found and fixed during inline execution, beyond what the plan/briefs
specified:

- **Task 2**: the migration's own design had a real duplicate-creation risk —
  a crash between pass-1 (creating Documents) committing for some visits and
  the single end-of-household cleanup batch clearing `documentUrls` would
  make a retry recreate a second `Document` for an already-migrated visit.
  Fixed with a per-visit `sourceVisitId` existence check before creating,
  keeping every batch homogeneous (never mixing `set()`/`update()`). The
  test's `writeBatch` mock was also rewritten to hand out a fresh spy object
  per call, so a future regression that merged the two passes into one batch
  would actually fail a test instead of passing unnoticed.
- **Task 7**: the brief's own `passportService.test.ts` sample imports
  `pdfService.ts`, which imports the real `expo-print`/`expo-sharing` (ESM,
  not Jest-transformable) — the brief's snippet omitted the
  `jest.mock(...)` pair `pdfService.test.ts` already uses. Added.
- **Task 8**: `AddDocumentScreen`/`DocumentListScreen` need
  `household.documentsStorageBytes` off the typed `Household` object, but the
  plan's own Files list never mentions `src/types/household.ts` — the field
  didn't exist on the type. Added as optional (matching the
  "new fields are optional, no migration needed" convention already
  established for `Pet`). Confirmed no `firestore.rules` change was needed:
  the household's `allow update` has no field allowlist, unlike `allow
  create`. Also had to rewrite `documentService.test.ts`'s mock to the
  per-call-fresh-batch pattern (`createDocument` now makes two separate
  `writeBatch()` calls), which the plan's own Step 1 had anticipated.
- **Task 9**: `migration.ts` isn't in Task 9's Files list, but it casts
  `visitDoc.data() as VetVisit` and reads `.documentUrls` directly to handle
  any household that hasn't migrated yet — removing the field from the
  `VetVisit` type broke that cast under `tsc`. Fixed with an inline
  `VetVisit & { documentUrls?: string[] }` cast at the point of use, matching
  the same pattern the file already used for `documentsMigratedAt`.
  `migration.ts` itself is correctly *not* deleted — it's still the only
  path for a household that hasn't gone through it yet.

## Device verification (2026-09-23)

Full pass on the owner's real device (`MTN-NX1M`), against the real "Pajevic
Household" (pets Macmac and Dona), driven via `adb`/`uiautomator` (exact tap
coordinates read from `uiautomator dump` bounds, not estimated from
screenshots — an earlier attempt at visual coordinate estimation caused two
misdirected taps, see below).

**Rules had never been deployed for this plan's `documents`/`pages`
collections before this session** (nothing auto-deploys `firestore.rules`) —
deployed with the owner's explicit go-ahead before on-device testing could
mean anything.

**Checklist, all items passing:**

- **Migration**: Dona's real pre-existing vet-visit photo appears under her
  Documents as "Test — 9/16/2026, Vet visit document, 1 page", titled from
  the original visit, with the original photo intact. Confirmed the
  migration does not re-run across at least 4 separate app relaunches during
  this session (still exactly 1 pre-existing document throughout).
- **Documents**: added a 2-page test document via "Choose from library" (no
  camera available in this driving setup, but `pickAndProcessImage(source)`
  is the identical call for both sources, so this exercises the same
  downstream code the camera case would), removed one page before saving
  (count correctly dropped 2→1, the right photo was kept), saved
  successfully. `DocumentViewerScreen` opened correctly on tap and displayed
  the real photo full-screen. The share icon produced a real, valid PDF
  (confirmed via file size and Android's own print-preview renderer showing
  real content). Reached "Add a Document" from the global "+" sheet while on
  a different tab, with the currently-selected pet correctly pre-filled.
- **Passport**: generated for Macmac (almost no data — no crash, clean
  one-page layout, correctly omitted the microchip section, showed the one
  assigned vet) and for Dona (12 vaccines, 4 medications, 5 vet visits — the
  passport correctly truncated to the 8 most recent vaccines sorted by date
  descending, still one page, a curated document rather than a data dump).
  Actually rendered in Android's real print-preview (not just "a share sheet
  opened") for both.

**Not directly exercised on-device, time-boxed**: the literal 30-photo
free-tier cap (`canAddDocumentPage`/`documentPhotoLimitMessage` are
deterministic and already unit-tested, so this was judged lower-risk than the
items above).

**Incident during this pass, not a code defect**: while verifying document
and passport sharing, two misdirected taps on the OS share sheet — caused by
estimating tap coordinates from a scaled screenshot instead of reading real
device-pixel bounds via `uiautomator dump` — sent one generated passport PDF
to a real Viber contact and (separately) opened the Messages app instead of
the Print option. The Viber send was caught immediately, disclosed to the
owner, who deleted it themselves. No app data or account credentials were
involved — the sent file was the passport PDF itself (pet name/species/breed,
"no vaccinations recorded yet," one vet's name and phone). Every tap for the
remainder of the session used `uiautomator dump` bounds directly, and no
further misdirected taps occurred.
