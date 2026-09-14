# Pet Health Tracker — Build Plan

**Date:** 13 September 2026
**Status:** Source of truth for Plans 3–9, alongside `EXECUTION-PACK.md`. Supplements `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`. Where they disagree, this file and the Execution Pack win.

Sources read for this plan: the 34-page feature document ("PET APP – features i logika"), `CLAUDE.md`, and `NEXTSTEPS.md`.

> **Note for Claude Code:** this document is the analysis and the reasoning. `EXECUTION-PACK.md` contains the locked decisions and the per-phase scope and prompts. Read both. If only one, read the Execution Pack.

---

## 1. What the feature document actually asks for

Ana reviewed two competitor apps side by side and annotated 34 screenshots. One is a dark-green app run by a US veterinary clinic. The other is a yellow app called DogCat. Her notes are short but every one of them is a decision.

### Section 1 — Home screen

The green app's home is: a greeting, a "My Vets" card, a row of pet avatars under "My Pets", then three tiles — Manage Medical Records, Reminders, and Add a Health Journal event.

Behind "Manage Medical Records" is the single most important screen in the whole document: a strip of circular buttons reading `All Pets · Djidji · Neo`, with the selected one ringed in orange, and underneath it a list of record cards, each with a View and a Share button.

- **Take:** the All Pets / one-pet strip, the record cards, and Share.
- **Skip:** "Visit Our Portal" and "Shop My Vet". Those are the vet clinic selling to its own customers — that company's business model, not a feature.

### Section 2 — Bottom menu

Ana photographed two versions. Option 1 has four labelled tabs: Home, Pets, Vets, Education. Option 2 has five unlabelled icons with a yellow "+" button in the middle.

Her conclusion is a hybrid. She is explicit about three of the four tabs: a paw for pets, a calendar, and Vets — "where you can add the location and details of which vet you go to, like us with Pirko where we went to several different vets". The fourth she suggests should be members, or something like "team", since there will be several users. And in the middle, a plus button where all sorts of things can be added.

She raises three open questions: how many team members can have access, at what point do the competitors start charging, and how do they all log in to the same app.

> **We can already answer Ana's three questions.**
> The app is built around a household. Everyone in a household signs in with their own account and sees the same pets and records live.
> This is the one thing we do better than both competitors, and it is already finished and working. The fourth tab is not new engineering — it is a screen that shows something we already have.
> (Pricing of members has since been decided — see `EXECUTION-PACK.md`.)

One note on Option 1's "Education" tab: do not copy it. Ana elsewhere asks for small how-to explanations placed next to the field they explain. That is better than a separate tab nobody opens.

### Section 3 — Adding a pet

This is where Ana spends the most annotation, and it is the screen the competitors do worst.

**What annoys her.** Both apps, once you pick cat or dog, force you into an alphabetical breed list — Abyssinian, American Bobtail, American Curl — with a search box and no way out. In her words: this really annoys me because strays are not an option; we have to add that, and put it in first place.

The green app's species screen offers exactly four choices: Dog, Cat, Rabbit, Other. Her note: this absolutely has to be an option, so that many more animals can be added.

**What she likes.** The yellow app never forces an exact answer. Its birthday question is "When was Neo born?" with four ways to answer: an exact date, "I know roughly when", "I only know an approximate age", and "I don't know" — under a line saying a rough guess is completely fine. Ana: I like this because here it gives you options to have a ballpark idea.

It asks "Where does Neo spend their time?" — Indoor, Outdoor, or both — and explains underneath that this changes the risk of fleas, ticks and worms, so protection is tailored to match. The pattern worth noticing: every question says why it is being asked and what it will change.

It asks "When did Neo join your care?" with an exact date, "I know roughly when", or Skip. Ana: I like this too — to put in the date from when it's been with us.

At the end of the wizard, before anything is saved, there is a Review screen showing every field, all still editable, with one Save button.

> **Why this section matters more than it looks.**
> Everything Ana marked here points the same way: the app must work for an animal with no papers, no known birthday, and no known breed.
> That is not a small feature. In Serbia it is most of the market. Both competitors fail at it, and it is the cheapest competitive advantage available — it is a list order and a few extra answer options, not new technology.

### Section 4 — The pet overview after the profile is created

The yellow app's Pet Profile has a photo and a line reading "Female, 2 Years, 7 Months", then three pills — Main Details, Microchip, Insurance — then a grid of tiles: Weights, Logs, Reminders, Vaccines, Documents, Photos, each showing a count. Ana: I like it, we can take it, just a different design, maybe a bit clearer.

Four things inside it are marked:

- **Microchip — MANDATORY.** The competitor stores provider, number, and the date it was chipped.
- **Guided empty screens.** When a section is empty the app shows a picture, a sentence explaining why the section matters — "track your pet's weight to spot health changes early" — and a hand-drawn arrow pointing at the + button. Ana: smart and worth stealing; for weight, or for any option, the app shows you how you can do it, like a mini instruction.
- **Photographing documents.** Ana: add the option to photograph documents — need to see where. The competitor asks "Where is the file?" and offers Gallery, Files, or Take a Photo.
- **Custom fields.** The competitor lets you add your own extra fields to a pet — their example is "Favorite Food: Chicken Nuggets".

It is also where the competitor's paywall appears, twice, as a black card reading "Get DogCat Plus to see who made the last change". Elsewhere Ana notes that nobody sane will pay for extra detail fields. Because our app is built around a shared household, we can show who last changed a record, for free, as a normal feature — a direct answer to their paid upgrade.

### Section 5 — Reminders

Marked mandatory. The screenshot Ana chose has a black bar across the top reading "Reminders need notifications. Tap to enable." and her note beside it: and this has to be there too. A reminder app that never asked for permission to notify is a reminder app that silently does nothing.

### Section 6 — Calendar

Marked mandatory. The screenshot answers most of the design questions by itself:

- A dropdown reading "Just one pet", and under it a row of pet chips with a tick on the selected one. Ana: this part absolutely must let you choose the view — to see only what is for Djidji and only what is for Neo.
- Three filter pills: "0 Overdue", Week, Months.
- A week strip, and below it event cards: a green "Completed" badge, an icon and name ("Deworming"), the time and date, a coloured dot next to the pet's name, and two buttons, Skip and Edit.

Adding to the calendar is a three-step flow Ana marked with "this is how it should be added to the calendar": first "Who is it for?" (pick the pet), then "Select event type" — Medical, Grooming, Fitness, Food, Potty, Behavior, Symptom, Other — then the details.

Copy the coloured dot per pet and the Skip button (skipping is honest; real life has skipped doses). Avoid the strip of adverts running along the bottom of the competitor's free calendar.

### Section 7 — Vets

A simple list: clinic name, address, a link, an "Add a new vet" button. Combined with the Pirko note, the requirement is several vets, each with a location and details, and a way to know which pet goes where.

### Sections 8, 9, 10

The last page lists "8.", "9." and "10." with nothing after them. **Closed by the owner — nothing was intended there.**

---

## 2. Three things that changed since the previous roadmap

### a. The app runs on a real phone

The blocker the previous roadmap opened with is gone. A real Firebase project exists. A real Android phone builds, installs and runs the app over USB. Sign-up, household creation, adding pets and records, and camera photos have all been done for real.

Consequence: from here on, every screen can be looked at. **Nothing below is finished until somebody has seen it on the phone and taken a screenshot of it.**

### b. Photo storage had to change, and it constrains three of Ana's requests

Photos are not stored as files. They are compressed to roughly 30–100 KB and stored inside the database record itself, with a hard ceiling of 1 MiB per record.

| Ana's request | What it means in practice |
|---|---|
| "Upload From Files" — attaching a PDF | Not possible under the current arrangement. Photographs of documents are fine; PDF files are not. Most vet paperwork in Serbia is paper anyway. |
| Photographing documents | Possible, but the current code puts every photo from one vet visit into a **single record**. That hits the 1 MiB ceiling at roughly 10–20 photos and fails with an error. Must be restructured — one record per photo — before the documents section is built. Small change now, expensive later. |
| "Share" a record | Fully possible. The phone can build a PDF on the spot and hand it to the normal share sheet — WhatsApp, Viber, email, print. No file storage needed. Also gives a printable pet passport, which neither competitor does well. |

> See `EXECUTION-PACK.md` Part 1 §1 — the billing blocker behind this may be solvable, which changes where photos end up (but not whether the restructure happens).

### c. The app already has a design system

On 13 September the whole app was visually redesigned: a shared set of colours, spacing and components — teal blue as the main colour, warm orange for "add" buttons, an off-white background — and every screen is built from it.

> **This supersedes `DESIGN-GUIDE.md` from the earlier conversation.**
> That file proposed a different palette (greens, paper-white) and a different typeface, written before the redesign existed. **Do not apply it.** Replacing a working design system to chase a document is wasted work.
> One idea carries over: **give each pet its own colour**, and use it consistently — the dot beside their name in the calendar, the ring on their avatar in the All Pets filter, the edge of their card on the home screen. The competitor's own calendar screenshot does exactly this. It is the cheapest way to make "all pets versus this pet" obvious at a glance, and it sits on top of the existing teal and orange without disturbing either.

One genuine gap in the current system: icons are plain emoji. Fine for decoration, wrong for a bottom tab bar. The icon set that ships with Expo covers this and adds nothing new to install.

---

## 3. What we have, and what is missing

| Requirement from the feature document | Status | Where it lands |
|---|---|---|
| Vaccines, medications, weight, expenses, vet visits | Built | — |
| Several people sharing the same pets, live | Built | Shown in Phase 5 |
| Pet photo and document photo from the camera | Built | Reworked in Phase 6 |
| Proper date pickers everywhere | Built | — |
| Shared look and feel across screens | Built | Extended in Phase 1 |
| Bottom menu with four tabs and a centre "+" | Missing | Phase 1 |
| Home screen showing every pet and what is due | Partly | Phase 1 |
| All Pets / one-pet filter on every list | Missing | Phase 1 |
| More species than cat and dog | Missing | Phase 2 |
| Stray, mixed and unknown at the top of the breed list | Missing | Phase 2 |
| "I don't know" answers for age and dates | Missing | Phase 2 |
| "When did they join your care" | Missing | Phase 2 |
| Review screen before saving a new pet | Missing | Phase 2 |
| Microchip details | Missing | Phase 2 |
| Guided empty screens with a short explanation | Missing | Phase 2 onward |
| Reminders and phone notifications | Missing | Phase 3 |
| Calendar, with per-pet view | Missing | Phase 4 |
| Vets as a section, with location and details | Missing | Phase 5 |
| Members / team screen | Missing | Phase 5 |
| Medical records in one place, filtered by pet | Missing | Phase 6 |
| Sharing a record out of the app | Missing | Phase 6 |
| Serbian language | **Not doing** | English confirmed |

---

## 4. Data model deltas

All new fields optional so existing documents need no migration.

### `Pet` — add

`species` (widened enum) · `speciesOther?` · `breed?` (allows sentinels `mixed` / `stray` / `unknown`) · `sex` · `neutered?` · `birthDateIsEstimate` · `birthDatePrecision` (`exact` | `roughly` | `approxAge` | `unknown`) · `approximateAgeMonths?` · `arrivalDate?` + its own precision flag · `colorMarkings?` · `livingEnvironment` (`indoor` | `outdoor` | `both`) · `microchipNumber?` · `microchipDate?` · `microchipProvider?` · `microchipRegistry?` · `photoUrl?` · `colorKey` (pet identity colour, assigned at creation) · `customFields?` (array of `{label, value}`) · `status` (`active` | `remembered` — pets are never hard-deleted).

### `households/{hid}/vets/{vetId}` — new collection

Clinic name, doctor name, address, phone, hours, speciality, `isEmergency`, notes, `petIds`.

Extend the existing `match /households/{householdId}` rules block with an `isHouseholdMember` check plus a `create`-time `hasOnly([...])` allowlist. Per `CLAUDE.md`: **do not** add `hasAll`/`diff()` hijack machinery — that belongs only to `isJoining()`.

### `VetVisit` — add

`vetId?: string`.

### `households/{hid}/events/{eventId}` — new collection

Household-level rather than per-pet, with `petIds: string[]`, so one vet trip covering two animals is one entry that appears under both filters. `type` is one of: `medical`, `grooming`, `fitness`, `food`, `potty`, `behavior`, `symptom`, `other`.

### Documents — restructure (Phase 6)

Currently `VetVisit.documentUrls: string[]` holds every photo on one document. Move to one Firestore document per photo, grouped by a `groupId` for multi-page captures. Migration of existing photos is required — there is already test data in there.

### Reminders — deliberately NOT a collection

Model as a pure derivation:

```ts
computeUpcoming(pets, vaccines, medications, events, vetVisits, horizonDays)
  => UpcomingItem[]
```

A pure function with no Firestore, phone, or screen dependency — fully unit-testable under Jest, and capable of running unchanged on a server later (see Execution Pack Part 1 §2). Calendar, home cards and notification scheduling all consume it. Persist only user decisions (`completedIds`, `skippedIds`, `snoozedUntil`) and notification settings.

---

## 5. Out of scope — recorded so it is not re-argued

| Not building | Why |
|---|---|
| Social feed or community | A different product. Doubles the work, halves the focus. |
| Symptom checking or health advice | We record; we do not diagnose. A liability line, not a scope line. |
| A map inside the app | Large addition for something the phone's own maps app does better. Tapping an address opens it there. |
| Adverts | See Execution Pack Part 1 §3. Decided against. |
| Attaching PDF files | Blocked by the storage situation in §2b. Photographing documents covers the real case. |
| Reminders that reach a partner's phone while offline | Needs server-side code and the paid Firebase plan. Deferred to Phase 8, not abandoned. |
| An iPhone version | Cannot be built from a Windows machine. Separate conversation about a Mac or a cloud build service. |
| Switching between households | Nobody needs it yet and it complicates everything it touches. |
