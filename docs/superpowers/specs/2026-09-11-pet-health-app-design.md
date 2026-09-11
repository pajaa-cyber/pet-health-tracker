# Pet Health Tracker — Design Spec

Date: 2026-09-11
Status: Approved for planning

## Problem

Pet owners have no single, reliable place to track their pet's vaccines,
medications, vet visits, weight, and expenses. Existing apps fail in one of
three ways:

- **Vet-locked** (PetDesk): only useful if your clinic is on the platform;
  no weight/expense/document tracking.
- **Narrow** (Pawprint / Great Pet Care): vaccination records only.
- **Bloated and broken** (11pets, ~3.3★): most feature-complete option, but
  users report confusing/forced subscription pricing, data loss after
  updates, cluttered UI, and per-pet pricing that gets expensive for
  multi-pet households.

No competitor offers reliable cloud sync, real-time family sharing (so
multiple household members see the same up-to-date record — critical for
preventing medication double-dosing), and a simple, honest pricing model.

## Target user

Pet owners managing recurring care (vaccines, chronic medication, vet
visits) for one or more pets, often coordinating with a partner or family
member who also gives care.

## Goals (MVP)

1. Track per pet: vaccines (with due-date reminders), medications
   (recurring schedule + who-gave-it log), vet visits (notes + documents),
   weight history (graphed), and expenses.
2. Real-time family sharing: multiple accounts linked to one household see
   the same pet data live, with push notifications for reminders sent to
   every household member.
3. Reliable cloud storage from the moment data is entered — no reliance on
   local-only storage that can be lost on reinstall/device change.
4. Offline-first: core actions (log a medication dose, add a weight entry)
   work without network and sync when reconnected.
5. Simple, flat pricing: one subscription price per household covering all
   pets, with a free tier that never locks users out of data they already
   entered.

## Non-goals (deferred to v2+)

- Grooming schedules, training logs, walk/exercise tracking, behavior
  notes, photo journal/milestones — nice-to-have, not core pain points.
- Vet clinic integrations / appointment booking.
- Pet insurance claim submission (beyond storing the policy info).
- Species beyond dogs/cats for v1 (design should not hard-block others,
  but no species-specific logic beyond dogs/cats initially).

## Approach

**Client:** React Native (Expo), offline-first via Firestore's built-in
local cache and offline persistence.

**Backend:** Firebase —
- Firestore for data storage and real-time sync across household members
- Firebase Auth (email + Google + Apple sign-in)
- Cloud Functions + Cloud Scheduler for time-based reminder logic
  (vaccine due dates, recurring medication schedules)
- Firebase Cloud Messaging (FCM) for push notifications to all household
  members, not just the device that created the reminder
- Cloud Storage for documents/photos (vet records, lab results)

**Why this stack:** fastest path to a working MVP for a solo developer;
Firestore's offline persistence and real-time listeners map directly onto
the two hardest requirements (offline-first, live family sharing) without
custom sync logic.

## Data model

```
households/{householdId}
  members: [userId, ...]

households/{householdId}/pets/{petId}
  name, species, breed, birthDate, photoUrl

pets/{petId}/vaccines/{vaccineId}
  name, dateGiven, nextDueDate, vetName

pets/{petId}/medications/{medId}
  name, dosage, schedule (recurring rule), startDate, endDate
  log: [{ givenBy: userId, givenAt: timestamp }]

pets/{petId}/vetVisits/{visitId}
  date, reason, notes, documentUrls: [storagePath]

pets/{petId}/weightLogs/{logId}
  date, weight

pets/{petId}/expenses/{expenseId}
  date, category, amount, note
```

Access control: Firestore security rules restrict all `pets/{petId}/*`
reads/writes to users listed in `households/{householdId}.members` for the
household that owns that pet.

## Core screens (MVP)

1. **Household/pet switcher** — list of pets in the household, add pet
2. **Pet home** — upcoming reminders (vaccine due, next med dose), weight
   trend graph, quick-add buttons
3. **Medications** — active schedules, dose log with who/when, mark-as-given
4. **Vaccines** — list with due dates, add/edit
5. **Vet visits** — timeline with notes and attached documents
6. **Weight** — log entry + graph over time
7. **Expenses** — list + running total, filterable by category
8. **Household settings** — invite family member, manage subscription

## Notifications

Reminders (vaccine due soon, medication dose due) are computed server-side
(Cloud Functions on a schedule) rather than as local device notifications,
so that:
- Every household member gets notified, not just the device that created
  the schedule
- Reminders survive app reinstall/device change (they're derived from
  Firestore data, not local state)

## Monetization

- Free tier: full feature set for 1 pet, data never locked/hidden
- Paid tier: flat monthly/annual price per household, unlimited pets —
  explicitly not per-pet pricing (direct response to the #1 complaint
  about 11pets)

## Testing approach

- Firestore security rules tested with the Firebase emulator suite
  (household isolation — user A must never read/write user B's household)
- Component/unit tests for reminder-date calculation logic (recurring
  medication schedules, vaccine due-date math) since this is the
  highest-risk-of-bugs logic and silent failures directly cause missed
  medication doses
- Manual device testing on iOS + Android for offline-entry-then-sync flow

## Open questions for implementation planning

- Exact recurring-schedule format for medications (RFC5545-style RRULE vs.
  a simpler custom structure)
- Whether household invites use email invite links or in-app codes
