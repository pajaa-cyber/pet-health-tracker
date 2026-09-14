# Pet Health Tracker — Execution Pack

**Date:** 13 September 2026
**Status:** Locked decisions and per-phase scope. This file governs Plans 3–9. Companion to `BUILD-PLAN.md` (the analysis and reasoning behind it).

> **Note for Claude Code:** Part 1 is context and decisions. Part 2 is the work. The fenced blocks in Part 2 are prompts written for the owner to paste — treat their contents as the scope of that phase.

---

## Key finding that shapes three decisions

Serbia **does** support Google Play merchant registration — developer registration and merchant registration are both available, with payouts in USD. Selling subscriptions from Serbia is possible.

The moment anything is sold, a payments profile with proper tax details is required anyway. The same thing that unlocks subscriptions unlocks Firebase's paid plan — which is what file storage and offline-partner reminders were both blocked on.

**The storage problem, the offline-reminder problem and the subscription problem are one problem.** See Part 1 §1.

---

# Part 1 — Decisions and advice

## Locked in

| Decision | Answer |
|---|---|
| Language | **English.** No translation work. Removes a whole phase from the plan. |
| Species | Dog, cat, rabbit, bird, small rodent, ferret, reptile, and Other with free text. Horse and fish deferred. |
| Household members | **4 free**, paid beyond that. Driven by the pet-sitter case. |
| Ana's sections 8–10 | Nothing there. Closed. |
| Custom fields | Yes. **3 free**, paid beyond that. |
| Calendar events and health journal | One feature with Ana's eight types. |
| Ads | **None.** See §3. |
| Invites | Invite code + share sheet. Email for sign-in. **No phone authentication.** See §4. |

> **Structural consequence of "4 free, 3 free".**
> There are now limits in the product, and limits get scattered across twenty files until nobody knows what the rules are.
> Build **one small module** that owns every free-tier limit — a function answering "can this household add another member?" and "can this pet have another custom field?". Every screen asks it rather than checking a number itself. For now it returns free-tier constants. In Phase 7 it reads a real subscription, and nothing else changes.
> This is in the Phase 2 prompt onward. Costs almost nothing now; saves a painful week later.

---

## 1. Storage — the VAT number problem

The problem is not the money; Google wants a VAT number. Three routes, in order of preference.

### Route A — try again as an Individual account type

When creating a Google payments profile you choose an account type, and **the choice is permanent**. Google's documentation says individuals not part of an organisation should choose Individual, and that Business accounts are for multi-user managed environments. Serbia is charged 20% VAT on Google Cloud either way — a VAT ID is something you *can* supply so it prints on the invoice, not necessarily something you must have.

If the signup that blocked us was the Business path, this is worth one more attempt from a clean payments profile. Costs an evening; if it works, everything below is unnecessary.

### Route B — use the printing company

This is the likely destination, for a reason unrelated to storage: **we have decided to sell subscriptions.** Nobody sells subscriptions as a private person. Google Play merchant registration, tax withholding, invoicing, declaring revenue — all of it wants a legal entity, and one already exists with a PIB.

So the real question is not "how do I get file storage without a VAT number" but "when do I put this app under the company". Answer: before the first payment, which means before the final phase anyway. Doing it earlier removes three blockers at once.

*This is an accountant conversation, not a technical one. Whether it sits in the existing entity or a new one, how the 20% VAT on Google Cloud is treated, and what Google withholds from Play payouts are all things an accountant answers in one meeting.*

### Route C — a different storage provider, only if A and B both fail

Technically possible, genuinely worse. Cloudflare R2 and Backblaze B2 both have free tiers around 10 GB. But the app cannot hold their keys directly — anyone could extract them from the installed APK — so a small piece of server code is needed to hand out temporary credentials, on top of a second account and a permanently split system where records live at Google and photos live elsewhere.

Roughly two extra days of work now and a small tax on every future change. Only if A and B are genuinely closed.

> **What to do in the meantime.**
> Do not wait for this. Phases 1–5 do not touch storage at all.
> The restructure — one photo per record instead of all in one — happens **regardless** of how billing resolves. It is the difference between the documents feature failing at twenty photos and it not failing. It is in Phase 6 and it is not optional.
> The billing answer changes only whether Phase 6 *also* moves photos out to real file storage. Decide before Phase 6 starts, not before Phase 1.

---

## 2. Reminders that reach a partner who is offline

Same lock, same key. A reminder arriving on Ana's phone because Marko added a vaccine date needs code running on a server — Ana's phone cannot schedule something it has never seen. Server code means the paid Firebase plan, which means §1.

Not a separate project: a feature that switches on once billing is sorted. Build Phase 3 so it does not have to be rewritten later — **the logic that works out what is due must be a single self-contained piece that does not care whether it runs on a phone or a server.** Then "add server-side reminders" is a short phase rather than a rewrite. This requirement is written into the Phase 3 prompt.

Until then, be honest in the app: reminders are scheduled on each phone from what that phone has seen. For two people who both open the app every few days this is almost never visible. Worth one line in the reminder settings screen rather than a surprise later.

---

## 3. Money — free tier, ads, and the trial

### The trap with crippling the free tier

In a pet health app specifically, holding back a safety feature reads as holding a sick animal hostage. That is where one-star reviews come from, and reviews are most of what decides whether an app in a small market ever gets installed. The competitor charges to see who last edited a record — exactly the kind of decision that makes a product feel mean without making much money.

### Charge for outputs and scale, not for completeness

Everything a person types in stays free, forever, for everyone. What costs money is what the app gives back out, and what costs us money to run.

| | Free | Pro |
|---|---|---|
| Pets | Unlimited | Unlimited |
| All record types, reminders, calendar | Yes | Yes |
| Household members | 4 | Unlimited |
| Custom fields per pet | 3 | Unlimited |
| Document photos | ~20 per pet | Unlimited (this is the real cost) |
| Sitter access — temporary, expiring | — | Yes |
| Printable PDF pet passport | — | Yes |
| Sharing a record out of the app | — | Yes |
| Ads | None | None |

> **The feature to build the subscription around: Sitter access.**
> Leaving a pet with a friend for a few days and wanting them to see the records if something goes wrong is the most compelling thing in this product, and neither competitor has it.
> Its shape is **temporary**. You do not want the friend reading your records forever, and you do not want to remember to remove them. So it is not "add a fifth member" — it is its own thing: pick a pet, pick an end date, it switches itself off.
> Better on product, safer on privacy, and commercially the strongest subscription trigger available: people buy at the moment of need, and the moment of need is the week before a holiday. "You hit your fifth member" is a much weaker prompt than "you are going away on Friday."

### On ads — decided against

1. **They pay almost nothing at this scale.** Banner advertising in this region earns roughly $1–2 per thousand views. A thousand daily users seeing a handful each is a few dollars a day.
2. **They need the same paperwork.** Ad payouts also require a payments profile with tax details. They do not route around the blocker.
3. **They fight the subscription.** An ad-supported free tier has to be pleasant enough to keep people in it, which makes the upgrade harder to justify — adding the exact problem we are trying to avoid.
4. **Ana screenshotted the competitor's ad strip.** It sits on the calendar screen under a reminder about a dog's worming treatment. That is what we are differentiating from.

Revisit at tens of thousands of users, not before.

### On the trial — yes, but not seven days

Seven days is too short: the value of a pet health app arrives on a delay. The moment it proves itself is the first reminder that catches something, which might be three months after installation.

- **A 14-day Pro trial at signup** — long enough to get the pets in, photograph the booklets, and generate a passport PDF, so the person has *felt* the paid features.
- **A second trial offered at the moment of need** — when someone taps Sitter access, or tries to generate a passport at the vet's desk.

Price annually rather than monthly. Retention in small utility apps is poor month to month and fine year to year, and an annual price makes the number feel small. Roughly €2–3/month billed yearly is the shape of the market — a guess until there are a hundred users to ask.

---

## 4. Email or phone number for invites?

Neither. The thing already built is better than both.

The app already creates a short invite code and the joiner types it in. Sharing that code over WhatsApp or Viber is how people in Serbia actually pass things to each other, it works instantly, and it costs nothing. **All that is missing is a share button next to the code.**

Email as sign-in identity is already built — keep it. Phone numbers as a sign-in method would mean sending SMS, which Firebase charges for and which needs the paid plan and a billing account. It would buy nothing except another dependency on the thing currently blocking us.

---

## 5. Design — how to get from "fine" to "good"

> **Honest caveat:** nobody advising here has seen the app. The design system is described in `CLAUDE.md` but no screen has been looked at. A previous design guide proposed a palette that conflicted with one already built, precisely because of this. **Screenshots are needed before specific critique is possible.**

### The five things that most reliably make an app look amateur

In rough order of cost. One is confirmed present.

1. **Emoji used as interface icons.** *Confirmed* — `CLAUDE.md` states species and section icons are plain emoji. They render differently on every phone, sit at the wrong weight next to text, and nothing signals "built quickly" faster. A proper icon set ships with Expo and adds nothing to install. **If one thing changes, change this.**
2. **Too many sizes of text.** Amateur apps have fourteen because each screen was styled on its own day. Good ones have five or six, defined once.
3. **Inconsistent spacing.** Everything on multiples of 4 or 8. When gaps are 13 here and 15 there, nobody can name what is wrong but everyone feels it.
4. **Colour used too often.** One accent, used rarely, reads as confident. Coloured headers, buttons, chips and icons all at once read as a demo.
5. **Empty screens that are actually empty.** Ana already spotted this in the competitor: a picture, one sentence on why the section matters, an arrow to the button. Empty states are most of a new user's first ten minutes.

### The one structural upgrade

Give every pet its own colour and use it consistently — the edge of their card on the home screen, the ring around their photo in the All Pets filter, the dot beside their name in the calendar. The competitor's calendar does this and it is why that screenshot reads clearly despite being busy. Small change; makes the central idea of the app visible at a glance; sits on top of the existing colours rather than replacing them.

### The process that works

- Build one **hidden style-guide screen** showing every colour, text size and component in one place. Screenshot it. Fix it until it looks right. Every screen built afterwards inherits it — by far the cheapest place to improve the whole app at once.
- After every screen: photograph it on the phone, paste the photo in, ask what is wrong with it. Prompt in Part 2. **Every time, not occasionally.**
- Pick three apps — any apps, not pet apps — that look excellent, and say in one sentence each what you like. Give those as the reference. "Make it nicer" produces nothing; "this, but for pets" produces something.

### Options worth pricing

- Buy a well-made mobile UI kit as the reference — tens of euros, and it gives something concrete to match instead of a description.
- Hire a designer for the ten or twelve screens that matter — a reference the app gets built *against*, not a redesign after the fact.

Do the free things first — icons, style screen, screenshot loop. They often get most of the way.

---

# Part 2 — The seven phases

Each phase is one conversation with Claude Code, on its own git worktree, merged when finished **and seen working on the phone**.

> **The two habits that matter more than any prompt.**
> 1. Always make it write the plan first, and read the plan yourself before letting it build. You do not need to read code to notice something does not match what Ana asked for.
> 2. **Nothing is finished until it has been run.** This project has already had one bug that would have locked every user out of the app, written confidently, which survived three separate reviews and was found the moment it was actually executed. *Reviewed is not verified.*

### Use at the start of every session

```
Read CLAUDE.md and NEXTSTEPS.md first, in that order, before doing anything else.
Then read BUILD-PLAN.md and EXECUTION-PACK.md.

Do not write any code yet. Tell me three things: your understanding of the
current state of the app in five bullet points; anything in these documents
that conflicts with what is already built; and anything in them you think is
a bad idea, and why.
```

---

## Phase 0 — Billing and entity (owner, not Claude Code)

Not a development phase. Runs in the background during Phases 1–5. **Must be resolved before Phase 6 starts.**

- Try the Google payments profile again as an **Individual** account type, from a clean profile.
- If that fails, talk to the accountant about putting the app under the printing company — needed before taking any payment regardless.
- Once the paid Firebase plan is active, tell Claude Code. It changes what Phase 6 does and unlocks Phase 8.

---

## Phase 1 — The shell: bottom menu, home screen, pet colours

**Goal:** open the app, see all your pets and what each one needs next, and move around with a bar at the bottom. ~10 tasks.

### Planning prompt

```
Write Plan 3, "App shell and home screen", as a document under
docs/superpowers/plans/, following the structure and detail of the existing
plan documents.

Scope:
- A bottom tab bar with four tabs — Pets, Calendar, Vets, Household — and a
  raised "+" button in the middle that opens a sheet for adding anything. If a
  single pet is currently selected, pre-fill it.
- Replace the emoji icons in the tab bar and anywhere else they act as
  interface controls with a real icon set. Use the one that already ships with
  Expo; do not add a new native dependency for this.
- Rebuild the home screen as one card per pet: photo, name, species and age,
  and the next thing due for that pet, with overdue items visually distinct
  from upcoming ones.
- Build a single shared "All pets / one pet" selector component, with one piece
  of shared state behind it, and use it on the home screen. Every later list
  screen will reuse this exact component — design it for that.
- Assign each pet a colour when it is created, stored on the pet. Use it on the
  edge of their card and the ring around their avatar in the selector. Let it be
  changed when editing a pet.
- Add a developer-only style guide screen that renders every colour, text size,
  spacing value and shared component in one place.
- The Calendar and Vets tabs appear now but are empty, with a written empty
  state rather than a blank screen.

Do not replace the existing design system. Extend it. The teal and orange
palette and the existing shared components stay.

Requirements for the plan document: break it into individually buildable and
checkable tasks; every task states how it will be verified, and "reviewed" is
not a verification — say whether it is a type check, a named test, the rules
emulator, or a screenshot on the phone. List every new dependency and whether
it needs the app rebuilt on the phone. List every security-rules change and
follow the constraints already in CLAUDE.md. End with an exhaustive
"Assumptions and open questions" section — if you are unsure whether something
exists the way you have written it, say so there rather than asserting it.

Write the plan. Do not start building it.
```

### Before approving the plan, check

- It names the four tabs and describes the centre button as a sheet, not a fifth tab.
- The pet selector is **one shared component**, not something each screen builds for itself. If it is per-screen, send it back — this mistake costs three times over the next four phases.
- Nothing proposes replacing the existing colours, components or design system.
- The assumptions section is not empty or three lines long. An empty assumptions section means it did not look.

### Build prompt

```
Build Plan 3 using subagent-driven development, in a fresh git worktree off
current master.

Standing rules: after every task the type check and the tests must both pass.
Any change to security rules must be run against the real emulator before that
task is done — do not reason about rules on paper. Never copy code from a plan
document; copy from current source files. Stop and ask me if a task needs a
decision the plan does not cover, and stop and ask me before adding anything
that requires rebuilding the app on the phone.
```

### On the phone, look for

- The bottom bar does not cover the last item of a long list, and sits above the Android navigation bar rather than under it.
- Tapping a tab and coming back does not lose your place.
- A pet with no photo still looks deliberate rather than broken.
- A pet with nothing due says something sensible, not a blank space.
- The two pet colours are clearly different and both readable against the background.

---

## Phase 2 — Adding a pet, rebuilt

**Goal:** add a stray with no papers in under a minute without lying about a single field. ~13 tasks.

### Planning prompt

```
Write Plan 4, "Pet profile depth", following the same structure.

Scope:
- Species selection across: dog, cat, rabbit, bird, small rodent, ferret,
  reptile, and Other with free text. Personalise the step titles the way the
  reference app does ("Neo's species").
- Breed becomes optional. When the breed list opens, the first three entries,
  above the alphabetical list and visually separated from it, are Mixed,
  Stray or rescued, and Don't know. A person must be able to finish adding a
  pet without ever opening this field.
- Every date question gets graceful degradation: an exact date, "I know roughly
  when", "I only know an approximate age", and "I don't know" — storing which
  one was used. Put a reassuring line under each one; a rough guess is
  genuinely fine.
- "When did they join your care" as its own question, separate from birth date,
  with a Skip option.
- Microchip: provider, number, date implanted, registry.
- Sex, neutered, colour and markings, and indoor / outdoor / both. Each question
  carries one line explaining why it is asked and what it changes.
- A Review step at the end showing every field, still editable, before Save.
- Custom fields: the owner can add their own named fields to a pet. Three are free.
- Guided empty states start here: a picture, one sentence on why the section
  matters, and an arrow to the "+" button.
- Editing a pet afterwards, and a "remembered" state for a pet that has died.
  There is no delete button for a pet.

Important: create one small module that owns every free-tier limit — a function
that answers questions like "can this pet have another custom field?" and "can
this household add another member?". Every screen asks it rather than checking a
number itself. For now it returns the free-tier values as constants. In a later
phase it will read a real subscription, and nothing else should have to change.

All new pet fields must be optional so that pets already in the database keep
working without migration.

Same requirements as before for task breakdown, verification, dependencies,
rules changes, and the assumptions section. Write the plan; do not build it.
```

### Before approving the plan, check

- Mixed / Stray / Don't know are **pinned above** the alphabetical list, not merged into it alphabetically. This is the single most important line in the whole plan.
- There is a task for the limits module, and the custom-field limit reads from it.
- It says existing pets keep working without a migration.
- There is no delete-pet task.

### Build prompt

Same as Phase 1, changing the plan number.

### On the phone, look for

- Add a pet giving only a name. It should work, and the result should not look half-broken.
- The breed screen: the three options visible without scrolling and obviously separated from the list below.
- A very long pet name and a very long custom field name. Nothing overflows or gets cut off mid-word.
- The Review step: every row goes back to the right question when tapped.
- Try to add a fourth custom field. The message should explain what is available, not just refuse.

---

## Phase 3 — Reminders and notifications

**Goal:** the phone tells you before a vaccine is due or a tablet needs giving. ~12 tasks.

### Planning prompt

```
Write Plan 5, "Reminders and notifications", following the same structure.

Scope:
- One self-contained module that works out everything coming up from the
  records already in the app — vaccine due dates, medication schedules,
  follow-up visits — given the data and a time horizon. It must be a pure
  function with no dependency on Firebase, the phone, or any screen, so that it
  can be fully unit tested, and so that the exact same code could later run on a
  server. This is the most important requirement in the plan; treat it as such.
- Local notifications scheduled from that module, recomputed and rescheduled
  whenever the data changes.
- A permission bar at the top of the reminders and calendar screens reading that
  reminders need notifications, tapping to enable, shown only when permission has
  not been granted.
- Settings for how far in advance and at what time of day.
- Done, Skip and Snooze on each reminder. Skipping is a normal thing that happens
  and should not feel like failure.
- One honest line in settings explaining that reminders are scheduled on this
  phone from what this phone has seen.

Write thorough tests for the calculation module specifically, covering: a vaccine
with no due date, an overdue item, a medication that has ended, a pet added today
with no history, a date in a different month, and a leap day. These tests are the
only part of this feature that can be proved correct without a device, so they
carry more weight than usual.

Same requirements as before. Write the plan; do not build it.
```

### Before approving the plan, check

- The calculation module is described as **pure and testable, with no Firebase in it**. If Firebase is mixed in, send it back — this is what makes the later server-side version cheap instead of a rewrite.
- There is a real list of test cases, not "add unit tests".
- The permission bar is a task, not an afterthought. Ana singled this out specifically.

### Build prompt

Same as Phase 1, changing the plan number, plus:

```
Build the calculation module and its tests first, as the first tasks, before any
screen work. I want to see those tests passing before anything else is built on
top of them.
```

### On the phone, look for

- Deny the notification permission deliberately. The app must stay usable and the bar must explain how to fix it.
- Set something due tomorrow, then move the phone clock forward. The notification should actually arrive.
- Skip a dose, then look at the history. It should be visible as skipped, not deleted.
- Add a vaccine on one phone with the other phone open. The list should update on both.

---

## Phase 4 — Calendar

**Goal:** see the week or month, filtered to all pets or just one. ~11 tasks.

### Planning prompt

```
Write Plan 6, "Calendar", following the same structure.

Scope:
- Week and month views over the calculation module from Plan 5, plus a new
  household-level events collection for things entered by hand.
- An overdue count shown as a filter alongside Week and Month.
- The shared "All pets / one pet" selector from Plan 3, reused unchanged.
- Each entry shows the pet's colour, its status, and Skip and Edit actions.
- Adding: three steps — who is it for, then the event type, then the details.
  Event types are Medical, Grooming, Fitness, Food, Potty, Behaviour, Symptom
  and Other.
- Events belong to the household and carry a list of pets, so one vet trip
  covering two animals is a single entry that appears under both filters.
- No advertising anywhere.

Choose a calendar component that is pure JavaScript and does not require
rebuilding the app on the phone. If you believe no such option is adequate, say
so in the assumptions section and let me decide rather than adding a native
dependency yourself.

Same requirements as before. Write the plan; do not build it.
```

### Before approving the plan, check

- It reuses the Phase 1 selector rather than building a second one.
- The calendar component picked does not require a rebuild on the phone, or it has asked.
- Events are household-level with a list of pets, not buried under a single pet.

### On the phone, look for

- A day with six things on it. Does it still read clearly, or turn into a wall?
- Switching from All pets to one pet and back. The right things disappear and come back.
- A month with nothing in it. Does it look intentional?
- The colours of two pets side by side on the same day.

---

## Phase 5 — Vets and the household

**Goal:** every vet you have used, and everyone who can see your pets. ~11 tasks.

### Planning prompt

```
Write Plan 7, "Vets directory and household members", following the same structure.

Scope:
- Vets become their own collection under the household: clinic name, doctor name,
  address, phone, opening hours, speciality, whether it is a 24-hour emergency
  clinic, notes, and which pets go there. Extend the existing households rules
  block rather than adding a new top-level collection, and follow the constraints
  in CLAUDE.md exactly — a member check plus a field allowlist on create, and no
  hasAll or diff machinery, which belongs only to the join flow.
- Tapping an address opens the phone's own maps app; tapping a number calls. No
  map inside the app.
- Vet visits get linked to a vet.
- The Household tab: who is in it, the invite code with a share button that opens
  the normal phone share sheet, and the member count against the limit.
- The member limit reads from the limits module built in Plan 4. Four members
  free. When the limit is reached, explain what is available rather than simply
  refusing.
- Fix the known gap where a person removed from a household has no way back in.
  Anything that builds a members screen will eventually have someone press
  something, and the recovery path should exist before that happens.

Do not add phone-number sign-in. Email sign-in and the invite code are the
mechanism.

Same requirements as before. Write the plan; do not build it.
```

### Before approving the plan, check

- The rules section explicitly follows the `CLAUDE.md` constraints and does not invent new machinery.
- There is a task for the recovery path, not a note saying it is out of scope.
- The member limit is read from the limits module, not hardcoded in the screen.

### On the phone, look for

- **Actually join from a second phone using the share button.** This is the feature the whole product is built on — test it properly, twice.
- The message when a fifth person tries to join. Clear and not insulting?
- Tap an address with no internet. It should fail gracefully.
- A vet with only a name and nothing else.

---

## Phase 6 — Records, documents, and the pet passport

**Goal:** every record in one place, booklets photographed, and a printable summary. ~12 tasks. **This is the phase with the real technical risk.**

> **Do not start this phase until Phase 0 is resolved.**
> The billing answer changes what this plan should do. If the paid Firebase plan is active, photos move to real file storage and the size ceiling disappears. If not, photos stay inside the records and the restructure below is the thing standing between us and a feature that fails at twenty photos.
> Either way the restructure happens. Only the destination changes.

### Planning prompt — include the relevant bracketed line

```
Write Plan 8, "Medical records, documents and the pet passport", following the
same structure.

Context you must account for first: at present a vet visit stores all of its
document photos as base64 data inside a single Firestore document, which has a
one megabyte limit. This will fail once a visit has roughly ten to twenty photos.
Restructuring this to one Firestore document per photo is the first task of this
plan and everything else depends on it, including migrating any photos already
stored the old way.

[If Phase 0 succeeded, add:] The paid Firebase plan is now active and Cloud
Storage is available. After the restructure, move photo storage to Cloud Storage
with proper storage rules, and keep a small thumbnail inline so lists stay fast
offline.

[If Phase 0 has not succeeded, add:] Cloud Storage is still unavailable. Photos
stay as compressed base64, one per document, and the app must warn the owner when
a pet's documents are approaching a size where things will start failing — before
anything fails, not after.

Remaining scope:
- The records screen from the feature document: the shared pet selector, record
  cards showing what and when, and View and Share on each.
- Photographing documents, several pages in one go, grouped as one document.
- A printable one-page PDF pet passport: photo, microchip number, vaccination
  history, vet contacts. Generated on the phone and handed to the normal share
  sheet, so it can go to WhatsApp, email or a printer without needing any server.
- Sharing a single record the same way.

Same requirements as before. Write the plan; do not build it.
```

### Before approving the plan, check

- The restructure is the **first** task, and there is a task for migrating photos already stored the old way. If migration is missing, send it back — Ana's test photos are already in there.
- The passport is generated on the phone, with no server involved.
- There is a size-warning task if storage is still unavailable.

### On the phone, look for

- Photograph twelve pages of a booklet in one go. This is the exact case that used to break. Then do twelve more.
- Check that photos taken before this phase still open.
- Generate a passport for a pet with almost no data, and for one with a lot. Both should look like a document, not a printout of a database.
- **Actually print one.**

---

## Phase 7 — Subscriptions, sitter access, and release

**Goal:** the app is on Google Play and can take money. ~14 tasks, and the most paperwork.

### Planning prompt

```
Write Plan 9, "Subscriptions and release", following the same structure.

Scope:
- Sitter access: the owner picks a pet or pets and an end date, and generates an
  invitation that gives someone read access which expires automatically on that
  date. Expiry must be enforced in the security rules, not only hidden in the
  interface. This is a paid feature.
- Wire the limits module from Plan 4 to a real subscription instead of constants.
  Free: four household members, three custom fields per pet, document photos
  capped, no passport, no record sharing, no sitter access. Paid: all lifted.
- A 14-day trial of the paid tier at signup, and the offer of a trial again at
  the moment someone first taps a paid feature.
- Google Play billing, with annual and monthly options.
- Everything a person has already entered stays readable and exportable forever
  whether or not they pay. Nothing a user typed in is ever locked behind payment.
- App icon, splash screen, store listing, privacy policy, crash reporting.

Before writing the plan, tell me what you need from me that is not code — store
listing text, screenshots, a privacy policy, the merchant account, tax details —
as a separate checklist, because those have their own lead time and I should
start them now rather than when you reach that task.

Same requirements as before. Write the plan; do not build it.
```

### Before approving the plan, check

- Sitter expiry is enforced **in the security rules**. If it is only enforced in the interface, it is not enforced.
- Nothing the user typed in is behind the paywall.
- The paperwork checklist exists and has been started.

### On the phone, look for

- Let a sitter invitation expire, then have that phone try to open the app. It must lose access cleanly, not crash.
- Let the trial expire with data already in the app. Everything must still be readable.
- Every paywall message. Read each one out loud. If any sounds mean, rewrite it.

---

## Phase 8 (later) — Reminders that reach a partner who is offline

Once the paid Firebase plan is active and Phase 3's calculation module exists as a self-contained piece, this is a short phase rather than a rewrite: run that same calculation on a schedule on the server and send the notification directly. ~6 tasks. Do not attempt before Phase 0 is resolved.

---

# The three prompts used constantly

### After every screen is built — use this every single time

```
Here is a screenshot of this screen running on the phone.

Critique it. Is it using the shared colours, text sizes and spacing, or has it
invented its own values? Is the most important thing on this screen also the most
prominent thing? Is the spacing consistent with the screens next to it? Does
anything overflow, truncate, or sit under the bottom bar? Are there any emoji
being used as interface icons?

Give me the three highest-impact fixes, then apply them.
```

### At the end of every phase

```
This plan is complete. Before merging:

1. Run the full set of checks, including the rules emulator.
2. Update CLAUDE.md with anything that changed about how the app is built.
3. Rewrite NEXTSTEPS.md for a fresh session that knows nothing about this one.
4. List explicitly everything you built that has NOT been looked at on the phone,
   so it does not get forgotten.

Then merge and delete the worktree.
```

### When something feels wrong

```
Stop. Do not fix anything yet.

Tell me what you actually verified about this, versus what you assumed. If you
reasoned about it on paper rather than running it, say so plainly. Then tell me
what would have to be run to actually prove it.
```

---

**Start Phase 0 this week** — it has the longest lead time and nothing else waits on it. **Start Phase 1 whenever ready** — it depends on nothing.
