# Medical records, documents, and the pet passport — Design

## Goal

Phase 6 of the execution pack (`docs/superpowers/specs/2026-09-13-execution-pack.md`,
"Phase 6"). Every scanned document (vaccination booklets, lab results, anything
photographed rather than typed in) lives in one place per pet, and a printable
one-page pet passport can be generated and shared from the phone with no server
involved.

**Phase 0 (billing) is still unresolved** — the owner confirmed this directly
(2026-09-23). Photos stay as compressed base64 data URIs, per this project's
existing pattern (`src/pets/imageUpload.ts`), not Cloud Storage. This spec
follows the execution pack's explicit "if Phase 0 has not succeeded" branch.

## The problem this restructure fixes

Today, `VetVisit.documentUrls: string[]` stores every document photo for a visit
as a base64 data URI inside that one `VetVisit` Firestore document, which has a
1 MiB limit. At current compression settings (~30–100 KB/photo), this fails once
a visit accumulates roughly ten to twenty photos — exactly the "photograph a
whole booklet" case this feature exists to support. Restructuring to one
Firestore document per photo is the first task; everything else depends on it,
including migrating photos already stored the old way (real data exists today —
the owner's own test photos).

## Data model

A new household-level `documents` collection — **not** nested under a specific
`VetVisit`, and not scoped to any single existing record type. A vaccination
booklet isn't tied to one vet visit in real life, and this lets the passport
pull document data directly without reaching into `vetVisits`.

```
households/{householdId}/documents/{documentId}
  {
    id: string
    householdId: string
    petId: string
    title: string
    category: string        // free-ish label: "Vaccination booklet", "Lab result",
                             // "Other" — not a rigid enum, real documents don't sort cleanly
    date: number             // epoch millis, user-set (when the document is *from*, not when scanned)
    sourceVisitId: string | null   // set only for documents created by the migration below
    pageCount: number        // denormalized, so DocumentListScreen doesn't need a
                             // subcollection read per card just to show "12 pages"
    createdAt: number
  }

households/{householdId}/documents/{documentId}/pages/{pageId}
  {
    id: string
    order: number             // 0-based, display/share order
    photoUrl: string          // identical data-URI scheme as Pet.photoUrl / the old documentUrls entries
  }
```

This is what "one Firestore document per photo" actually means: a 12-page
booklet becomes 12 tiny page documents under one parent `documents/{documentId}`.
There is no shared size ceiling across pages, and adding a 13th page is a pure
append (`setDoc` on a new `pages` doc), never a rewrite of the whole booklet.

`VetVisit.documentUrls` is deleted from the type once migration is verified
working on-device (see below) — not deprecated-in-place. `VetVisitDocumentsScreen.tsx`
is deleted; its "take/choose a photo, append to this visit" job is superseded
by the new Documents section, which can optionally show which vet visit a
document came from (via `sourceVisitId`) without being owned by one.

Firestore rules: `documents` and its `pages` subcollection get the same shape
already established for `vets` (Plan 7) and pet-record subcollections — a
plain `isHouseholdMember(householdId)` check plus a `create`-time field
allowlist. No untrusted-write path exists (only confirmed household members
ever reach these screens), so no `hasAll`/`diff()` hijack protection is
needed, matching the existing precedent and explicit "do not add" note in
CLAUDE.md for this exact class of collection.

## Migration

Runs automatically, once per household, the first time `HouseholdContext`
resolves a household after this plan ships — not a manual button, since
there's no admin UI and the owner shouldn't have to remember to trigger it.

1. A `households/{householdId}.documentsMigratedAt: number | null` field gates
   this — `null`/missing means "not yet run."
2. For every pet in the household, for every `VetVisit` with a non-empty
   `documentUrls`: create one new `documents/{documentId}` (title derived from
   the visit's `reason` + date, `category: 'Vet visit document'`, `sourceVisitId`
   set to that visit's id, `pageCount` = the array's length), and one
   `pages/{pageId}` per array entry, in array order.
3. Only after all of a household's migration writes succeed, set
   `documentsMigratedAt` and clear `documentUrls` to `[]` on every migrated
   `VetVisit` (a second pass, not interleaved with step 2) — so a crash
   mid-migration leaves the OLD data fully intact and just re-runs next launch,
   rather than stranding data in neither the old nor the new shape.
4. `VetVisit.documentUrls` is only removed from the TypeScript type in a later
   task, after the migration has been confirmed working on a real device with
   the owner's actual existing test data (the "Ana's test photos" case the
   execution pack calls out by name).

## Documents screen

- **A 6th tile on `PetHomeScreen`'s existing `SECTIONS` grid** ("Documents"),
  alongside Vaccines / Medications / Vet visits / Weight / Expenses — reuses the
  established per-pet-record navigation pattern, no new bottom tab.
- **`DocumentListScreen`** (pet-scoped, reuses `usePetSelection()`/`<PetSelector>`
  the same way every other record screen does): cards showing title, category,
  date, and the first page as a thumbnail (`pages` ordered by `order`, first
  fetched). Tap a card → **View**. A share icon on each card → **Share**.
- **View**: a full-screen, swipeable pager through that document's pages
  (`FlatList` with `pagingEnabled` or equivalent — no new dependency needed).
- **`AddDocumentScreen`**: capture pages in one sitting via repeated camera
  shots or multi-select from the library (reuses `pickAndProcessImage` from
  `src/pets/imageUpload.ts` unchanged — same resize/compress settings), with a
  running thumbnail strip of pages captured so far and the ability to remove a
  page before saving. A short title/category/date form step follows, then Save
  writes the parent `documents` doc and all `pages` docs in one batch.
- **Share** reuses the passport's PDF pipeline (below) rather than trying to
  share N raw base64 images directly through the OS share sheet: tapping Share
  on a document builds a quick multi-page PDF from just that document's pages
  and hands it to `Sharing.shareAsync`. One "make something shareable"
  mechanism for the whole feature, not two.

## Pet passport

- **New dependencies: `expo-print`** (`Print.printToFileAsync({ html })` — HTML
  string in, local PDF file URI out, entirely on-device) **and `expo-sharing`**
  (`Sharing.shareAsync(uri)` — hands the file to the OS share sheet). Both are
  standard Expo SDK modules; adding them needs a `expo prebuild` regen like any
  other native dependency this project has added before, but no special native
  configuration.
- **Content**, all pulled from data that already exists — no new fields needed
  beyond what Plans 4 and 7 already added: pet photo (`Pet.photoUrl`), name,
  species, breed; the four microchip fields (`microchipProvider`,
  `microchipNumber`, `microchipDate`, `microchipRegistry`); vet contacts
  (Plan 7's household-level `vets` collection, filtered to vets whose `petIds`
  includes this pet); vaccination history.
- **"One page, looks like a document" means a curated summary, not a full log
  dump.** For a pet with a long vaccination history, the passport shows the
  most recent/relevant entries, not every row ever recorded — this is what
  keeps a heavy-data pet's passport one page and document-shaped, matching the
  execution pack's own on-device check ("Generate a passport for a pet with
  almost no data, and for one with a lot. Both should look like a document,
  not a printout of a database").
- **Entry point:** a "Generate Passport" action on `PetHomeScreen` (pet-level,
  not buried inside Documents). Generation is ephemeral — build the PDF, hand
  it straight to the share sheet — it is **not** saved as a stored `documents`
  record, matching "generated on the phone, no server involved."

## Size warning and free-tier cap

Since photos are now one-per-document instead of accumulating into one shared
1 MiB document, the ceiling worth warning about shifts: it's the **household's
overall Firestore storage against the free Spark plan's real quota** (1 GiB
total stored data), not any single document's size — the restructure above is
what already protects against the per-document failure mode.

- `households/{householdId}.documentsStorageBytes` — a denormalized running
  total, same style as Plan 7's `memberCount` mirror: updated by each page
  write, self-healed via a reconcile call from `DocumentListScreen` on load (so
  a missed/failed increment can't drift permanently, same reasoning that drove
  Plan 7's `reconcileMemberCount`).
- A warning banner appears once usage crosses a conservative threshold, well
  under the real 1 GiB Spark ceiling, to leave headroom for the rest of the
  project's Firestore usage (pets, records, everything else already stored).
  Exact threshold is an implementation-time judgment call for whoever writes
  the plan's task list, not fixed here.
- **A real, enforced free-tier cap, added now** — matching the exact
  `src/limits/limits.ts` pattern Plans 4 and 7 already established (add the
  constant today; Plan 9 later swaps the constant read for a real subscription
  check, no other call site changes): `FREE_DOCUMENT_PHOTOS_PER_PET = 30`,
  `canAddDocumentPage(pet)`, `documentPhotoLimitMessage()`.

## Explicitly out of scope (belongs to Plan 9)

- Gating the passport or document-sharing behind a paywall. Plan 9's own scope
  text ("Free: ... document photos capped, no passport, no record sharing ...
  Paid: all lifted") is what wires these to a real subscription — building them
  fully functional and ungated now is correct, matching how Plan 4's
  custom-field cap and Plan 7's household-member cap were both built as real,
  enforced numeric constants first and will be wired to subscription state
  later, not the other way around.
- Cloud Storage migration for photos (blocked entirely on Phase 0).
- Any change to the 5 existing record-type list screens (vaccines, medications,
  vet visits, weight, expenses) — confirmed explicitly out of scope; Documents
  is a new, separate section, not a merge into one combined timeline.

## Global constraints for the implementation plan

- The restructure (documents/pages collections + migration) is the **first**
  task; every later task depends on it.
- Migration must be its own task, separate from the restructure that creates
  the new schema, and must run before `VetVisit.documentUrls` is removed from
  the type.
- Reuse `pickAndProcessImage` (`src/pets/imageUpload.ts`) unchanged for photo
  capture — same resize (640px wide) and compression (0.5 quality JPEG)
  settings as everywhere else in the app.
- Reuse `usePetSelection()` / `<PetSelector>` for `DocumentListScreen`, per
  CLAUDE.md's standing instruction for every new list screen.
- Follow the `limits.ts` cap pattern exactly (`FREE_<X>` constant +
  `canAdd<X>()` + `<x>LimitMessage()`) for the new document-photo cap — no
  deviation, no new pattern invented.
- `expo-print` and `expo-sharing` are new native dependencies — an
  `expo prebuild --platform android` regen is required, and `android/`
  (tracked in git per this project's convention) must be committed alongside
  the code that needs it, matching how the `@react-native-community/datetimepicker`
  addition was handled.
