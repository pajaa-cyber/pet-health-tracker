# Where we left off (2026-09-13)

Read this before doing anything else in this project. It's a handoff for
resuming work, not permanent documentation (see `CLAUDE.md` for that — it
documents the full data model/architecture/UI system, including the known
gaps below). Assume the reader knows nothing about what happened in this
session.

## What this is

Pet Health Tracker (React Native/Expo + Firebase), beating 11pets on price/
reliability/simplicity, built for/with a non-technical solo owner on a
Windows PC. Context:

- Original design spec: `docs/superpowers/specs/2026-09-11-pet-health-app-design.md`
- Plan 1 ("Foundation & Auth") and Plan 2 ("Pet Records Core") — **complete, merged, on `master`.**
- Plan 3 ("Reminders & Notifications") — **not written yet.**
- `ROADMAP-and-claude-code-playbook.md` (project root) — the owner's own
  plan for Plans 3-9 (bottom-tab redesign, i18n for Serbian, reminders,
  calendar, vets directory, records hub, release readiness). It references
  two files that **do not exist yet**: `docs/superpowers/specs/2026-09-13-ux-and-feature-spec.md`
  and `docs/design/DESIGN-GUIDE.md`. Its "Part 0" blocker ("this app has
  never been seen running") is now resolved — see below — so its Plan 3
  onward is the likely next real work, once those two spec files exist.

## The single biggest thing that changed this session

**The app has been seen running on a real device for the first time, ever.**
Previously: no real Firebase project, no Android SDK, no device/emulator,
placeholder config files only, and multiple "not yet visually verified"
caveats on recent work. As of today:

- A real Firebase project exists: **`pet-tracker-app-63512`**. Firestore is
  enabled with `firestore.rules` deployed and confirmed working against
  real data. Authentication's Email/Password provider is enabled.
- **Cloud Storage is NOT usable on this project** — Google now requires the
  paid Blaze plan for Storage, Blaze requires a Google Cloud billing
  account, and that signup asked for tax/business info the owner (a
  personal, non-organization account) can't supply. This was discovered
  the hard way (photo uploads failing with a 404 "terminated the upload
  session" error) after building a whole Storage-based photo feature.
  **Fix:** pivoted to storing photos as compressed base64 data URIs
  directly in Firestore fields instead — see `CLAUDE.md`'s "Photo storage"
  section. `@react-native-firebase/storage` was removed from the project.
  `storage.rules` is still in the repo, unused, in case a future
  business-entity upgrade makes real Storage viable.
- A real Android phone (Honor, MagicOS 10) now builds, installs, and runs
  the app over USB debugging from this Windows machine. Sign-up, sign-in,
  household creation, and adding pets/records have all been used for real,
  not just hand-traced or unit-tested.
- The whole app was visually redesigned (shared theme + component set —
  see `CLAUDE.md`'s "UI/Design system"). Camera support was added for pet
  photos and vet-visit documents (previously library-picker only).
- A full local Android build toolchain now exists on this machine that did
  not exist before (Java, Android SDK, an isolated Gradle cache) — see
  `CLAUDE.md`'s "Local device build environment" section for exactly what
  was installed and why each piece is configured the way it is. **This is
  the section to read before attempting another build on this machine** —
  several of its details (the isolated `GRADLE_USER_HOME`, the OneDrive
  symlink quirk, `local.properties` getting wiped by every `expo prebuild`)
  are non-obvious and will cause confusing failures if skipped.

## Environment constraints (this machine specifically)

- This project folder is inside an actively-syncing **OneDrive** folder
  (`C:\Users\PC\OneDrive\Desktop\app`). This causes two separate, real
  problems, both already fixed but worth knowing about if something
  similar recurs: (1) Node/Jest saw every file as a symlink rather than a
  regular file, silently breaking test discovery — fixed via
  `jest.config.js`'s `haste.enableSymlinks`/`watchman: false`; (2)
  unrelated to OneDrive, `android/`'s 1000+ post-build generated files
  separately overwhelmed both Jest's and Metro's file crawlers — fixed via
  excluding `android/` in both `jest.config.js` and the new `metro.config.js`.
- **VS Code's Gradle extension** (`vscjava.vscode-gradle`) runs its own
  background Gradle daemon against this same project on a different
  Gradle version than the project's wrapper, corrupting the shared Gradle
  cache mid-build if both use the same `GRADLE_USER_HOME`. Fixed by giving
  our builds an isolated cache at `C:\Android\gradle-home` (env var, set
  persistently for this Windows user). If a build ever again fails with
  `Cannot snapshot ... not a regular file` or a similarly odd file-system
  error, check for this before assuming antivirus or disk corruption.
- Four antivirus products are registered simultaneously on this machine
  (Windows Defender, Avast, 360 Total Security, Reason Cybersecurity) —
  genuinely unusual, and was the first (wrong) theory for the Gradle
  failures above. Not fixed, not blocking anything currently understood,
  but worth flagging to the owner at some point as likely unintentional
  and possibly a performance/conflict problem in its own right.
- No iOS prebuild on Windows (`expo prebuild` refuses iOS on this OS) —
  unchanged, not attempted this session.
- `google-services.json`/`GoogleService-Info.plist` at the project root are
  gitignored and machine-local. The real ones (for `pet-tracker-app-63512`)
  are in place on this machine now, but a fresh clone/environment starts
  with neither file present — see `.env.example`, and note that even a
  fake placeholder pair (to merely unblock `expo prebuild`) needs to be
  recreated from scratch, not assumed to exist.
- `android/local.properties` (gitignored, holds `sdk.dir`) is wiped by
  every `expo prebuild` run along with the rest of `android/` — recreate
  it (`sdk.dir=C\:\\Android\\Sdk`) after every prebuild, every time.

## Known, deliberately-parked gaps (not silently dropped — real work, not yet scheduled)

1. **No in-app recovery if a household becomes unreadable.** If a household
   document's read ever fails (e.g. a future "remove member" feature),
   both `createHousehold` and `joinHousehold` fail permanently for that
   user, because their `users/{uid}` pointer write is evaluated as a
   denied `update` once it already exists. Needs UX design, not a patch.
2. `generateInviteCode()` in `householdService.ts` uses `Math.random()`,
   not a CSPRNG. Not currently exploitable; a proper fix needs a new
   native crypto dependency (`expo-crypto`) and another prebuild/rebuild
   cycle, so it's parked as low-severity.
3. No client-side size/dimension warning if a vet visit accumulates enough
   document photos to approach Firestore's 1 MiB per-document limit (see
   CLAUDE.md's "Photo storage" section for the math) — would fail loudly
   with a Firestore error today, not silently, but there's no proactive
   UI warning before that point.
4. Minor, low-severity, pre-existing: no positive-value validation beyond
   what's already there; `MedicationListScreen`'s dose log has no filter
   UI at all (nothing to fix, just never built).

## If resuming with an SDD-style process again (e.g. for Plan 3, or the owner's Plan 3-9 roadmap)

The two prior plans were executed via `superpowers:subagent-driven-development`
inside a dedicated git worktree (created via `superpowers:using-git-worktrees`),
merged back to `master` via `superpowers:finishing-a-development-branch`
once complete. That's a reasonable pattern to repeat — set up a fresh
worktree/branch off current `master` for each plan, don't develop directly
on `master`. Everything in this session (device setup, redesign, photo
storage pivot) was done directly on `master` as ad-hoc same-day work with
the owner actively testing on their phone throughout, which was the right
call for this kind of exploratory/environment-setup work but is not the
pattern to default back to for the next real feature plan.
