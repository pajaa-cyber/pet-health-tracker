# Play Console Data Safety form — answer key

Reference for filling out Play Console's "Data safety" section at submission
time. Based on what the app actually collects (see `privacy-policy.md`, the
source of truth) and a read of the current codebase's Firebase/permission
usage. Not yet submitted — Play Console/merchant account doesn't exist yet
(see `NEXTSTEPS.md`, Plan 9 sub-project B).

## Does your app collect or share any of the required user data types?

**Yes.**

## Data types collected

### Personal info
- **Email address** — collected. Used for account management (Firebase
  Authentication sign-in). Not optional — required to use the app. Not
  shared with third parties.

### Photos and videos
- **Photos** — collected. Pet profile photos, vet-visit/document photos, and
  (Scan Food) a food-label photo used only transiently for on-device OCR and
  never uploaded or stored. Used for app functionality. Not optional for the
  features that use it (photo upload is itself optional per-pet/per-record,
  but the category still applies). Not shared with third parties.
  - **Important nuance for the form:** photos are stored as base64 data URIs
    *inside Firestore documents*, not in Cloud Storage or any third-party
    media host (see `CLAUDE.md`'s "Photo storage" architecture note). If the
    form asks *where* data is stored/processed, the honest answer is
    "Firebase (Google Cloud)," same as every other data type below — there
    is no separate storage provider to disclose.

### App activity / App info and performance
Likely **not applicable** — there is no analytics or crash-reporting SDK
in this app (confirmed: no Firebase Analytics, Crashlytics, or any other
telemetry dependency in `package.json`). Answer "not collected" for App
activity, App info and performance, and Device or other IDs unless a future
change adds one of these — if it ever does, this file and the privacy policy
both need updating first.

## Data types NOT collected — explicit "No" answers

- **Location** — not requested, not collected. No location permission is
  declared or requested by the app itself. (`VetsScreen`'s "nearest emergency
  vet" feature opens Google Maps via an external intent — Maps handles its
  own location permission and that data never passes through this app or its
  backend.)
- **Financial info** — not collected in Play's sense. `ExpenseListScreen`
  lets a household log pet-care costs (`amountCents`, a category, a note),
  but this is arbitrary user-entered data about pet spending, not a payment
  method, bank/card number, or income — it never touches a real financial
  account. If Play Console's own category definitions draw this line
  differently at submission time, re-check before answering "No" here.
- **Health and fitness** — not collected in Play's sense. This is the one
  most likely to cause confusion: the app stores a *lot* of health data, but
  it's about the user's **pets**, not the user themselves. Play's Health and
  fitness category is specifically about the app user's own health/fitness
  data. Pet vaccine/medication/blood-test records don't fall under it.
- **Contacts, Calendar (device), SMS, Files and docs (device-level), Web
  browsing history, App activity beyond in-app actions, Device or other
  IDs** — none of these are requested or collected.

## Security practices section

- **Data encrypted in transit:** Yes — all traffic goes through Firebase's
  SDKs (Firestore, Auth), which use TLS by default.
- **Users can request data deletion:** Yes, but manually — there is no
  self-service in-app account/data deletion yet (`privacy-policy.md`
  documents this: contact `mpajevic7@gmail.com` to request it). Answer
  Play's "can request deletion" question honestly as "yes, via a support
  contact," not "yes, in-app," since that distinction matters on the form.
- **Committed to following the Play Families Policy / target audience:**
  Not a kids' app — answer accordingly if asked (app is not directed at
  children; see privacy policy's Children's Privacy section).

## Data sharing

**No data is shared with third parties.** No ad network, no analytics
vendor, no data broker. Everything lives in this project's own Firebase
project. Answer "No" to every "is this data type shared" question.

## One thing to double-check before submitting

This file is a best-effort read of the code as of 2026-09-29. Before actually
filling out the live Play Console form, grep the codebase once more for any
new dependency that might have started collecting something between now and
submission day (`package.json` diff since this date is the fastest check) —
the "no analytics/no Storage/no location" claims above are only as good as
that staying true.
