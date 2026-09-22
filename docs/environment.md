# Local device build environment (Windows)

Full detail, archived from `CLAUDE.md`. CLAUDE.md keeps the short checklist; read
this file when a build actually misbehaves or when reproducing the environment
from scratch.

The app has been built and run on a real Android phone from this Windows machine.
None of this was true before 2026-09-13, and reproducing it on a fresh environment
needs all of the following, not just `npm install`.

## Toolchain

- **Java:** Microsoft OpenJDK 21 via `winget install Microsoft.OpenJDK.21`, at
  `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`.
- **Android SDK:** installed manually via the standalone command-line tools (NOT
  Android Studio) at `C:\Android\Sdk` — `platform-tools`,
  `platforms;android-36`, `build-tools;36.0.0` via `sdkmanager`. `ANDROID_HOME`
  and `ANDROID_SDK_ROOT` point there.
- **`firebase emulators:exec` needs Java on `PATH`.** If a plain shell reports
  "Could not spawn `java -version`", prepend
  `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin` to `PATH` for that
  command rather than assuming Java isn't installed.

## Per-checkout files (gitignored, never inherited)

- **`android/local.properties`** must contain `sdk.dir=C\:\\Android\\Sdk`.
  `expo prebuild` deletes and regenerates the whole `android/` directory every
  time it runs, including this file — recreate it after every prebuild.
- **`google-services.json`** at the project root, **and** a manual copy at
  `android/app/google-services.json`. `android/` is tracked in git, so a fresh
  worktree gets a working `android/` straight from `git worktree add` and never
  runs `expo prebuild` — which means the Expo config plugin's auto-copy of
  `google-services.json` never runs either. Without the manual copy the first
  `npx expo run:android` in a new worktree fails with a
  "Searched locations: ...android/app/.../google-services.json" Gradle error.
  (Discovered building Plan 6's worktree.)
- **A new native dependency added in a worktree needs `npm install` run again on
  the main checkout after merging.** `node_modules` is per checkout, not shared,
  so merging a branch that added a package leaves `tsc`/Jest failing with "Cannot
  find module" until `npm install` runs on `master` too. Bit both Plan 4's and
  Plan 5's merges.

## `GRADLE_USER_HOME` is deliberately non-default

Set to `C:\Android\gradle-home`, **not** `~/.gradle`. VS Code's Gradle extension
(`vscjava.vscode-gradle`) runs its own background Gradle daemon against this same
project using a *different* Gradle version than the project's own wrapper, and the
two daemons corrupt each other's shared content-addressable transforms cache
mid-build. The symptom is a hard-to-diagnose `Cannot snapshot ... not a regular
file` or `... (The system cannot find the path specified)` `BUILD FAILED`, on a
different cached file each retry — it looks like random flakiness but reliably
resolves once each tool has its own isolated `GRADLE_USER_HOME`.

This was initially mistaken for antivirus interference. Four AV products are
genuinely registered on this machine at once — Windows Defender, Avast, 360 Total
Security, Reason Cybersecurity — which is unusual and worth the owner's attention
someday, but was not the cause here.

## Never check this project out inside OneDrive — RESOLVED, 2026-09-15

The project used to live in an actively-syncing OneDrive folder
(`C:\Users\PC\OneDrive\Desktop\app`). Every `npx expo run:android` /
`gradlew assembleDebug` attempt there failed partway through with
`Execution failed for task ':<module>:<task>'. > Unable to delete directory
'...\node_modules\<module>\...\build\<generated-folder>'` — a different
module/directory every retry, always the same shape: Gradle writes a build-output
directory then fails to delete it moments later as if something else has it
locked. `GRADLE_USER_HOME`, stray Gradle daemons and the build cache were all
ruled out.

A separate checkout of the same repo at `C:\dev\pet-app` (outside OneDrive) built
successfully on the first attempt (`BUILD SUCCESSFUL in 3m 11s`) with no
recurrence, confirming OneDrive's live sync — and/or one of the four AV products
scanning that synced folder — as the cause. The owner made `C:\dev\pet-app` the
project's one and only checkout to put this failure class permanently out of
scope, rather than chasing an AV-exclusion workaround.

The old OneDrive-specific `jest.config.js` workaround (`haste: { enableSymlinks:
true }` + `watchman: false`, needed because every file in a OneDrive folder —
hydrated or not — reports to Node.js as a reparse point that
`fs.Dirent.isFile()` treats as a symlink rather than a regular file) is left in
place since it's harmless outside OneDrive, but it is no longer load-bearing.

## Windows MAX_PATH and git worktrees

Git worktrees for plans must use a short path — `C:\dev\<plan-name>` — not the
`.claude/worktrees/<name>` default. A worktree nested under a long project path
can be long enough that Windows' 260-character MAX_PATH is hit by CMake/ninja's
own long intermediate object filenames during the native build of
`react-native-safe-area-context` / `react-native-screens`, failing with
`ninja: error: ... Filename longer than 260 characters`. Neither pure-JS
dependency installs nor `tsc` are affected — only `expo run:android`'s native
build step.

If already in a too-deep worktree when this hits: commit whatever's verified so
far, then relocate via `git worktree remove --force` + `git worktree add
<short-path> <branch>`. `git worktree move` itself can fail with a file-lock
permission error on some setups, so prefer remove+add. The old directory may fail
to fully delete with the same "filename too long" error — harmless, it's already
deregistered from git's perspective; clean it up with PowerShell's long-path-safe
`Remove-Item -LiteralPath "\\?\<path>" -Recurse -Force`.

## Crawler exclusions

Both `jest.config.js` and `metro.config.js` exclude `android/` from their file
crawlers and watchers. After even a couple of on-device builds, `android/` holds
1000+ generated native build files (Gradle caches, compiled classes, resources)
that were separately overwhelming both tools' default crawlers — Jest silently
found zero tests; Metro's `packager-status` never responded. `metro.config.js` did
not exist before this was diagnosed; it now sets `resolver.blockList` for
`android/` and `ios/`.

## Metro can end up orphaned

After `npx expo run:android` finishes, `curl http://localhost:8081/status` can
hang indefinitely. Seen repeatedly, not a one-off. Fix: kill the stray `node.exe`
bound to port 8081, restart detached
(`npx expo start --clear < /dev/null > metro.log 2>&1 &`), wait for
`packager-status:running`, then `adb reverse tcp:8081 tcp:8081` again.

## The phone, and adb disconnects

A Honor phone (MagicOS 10, model `MTN-NX1M`) connects via USB debugging; `adb`
lives at `C:\Android\Sdk\platform-tools\adb.exe`.

**Intermittent adb disconnects are the single biggest blocker in this project.**
The phone drops off `adb devices` for no code-related reason — Windows Device
Manager shows the "ADB Interface" USB device itself going to status "Unknown"
while the phone is otherwise recognised. This blocked Plan 5's entire
device-verification pass. Fixes in order:

1. Unplug and replug the USB cable (usually enough).
2. Unlock the phone's screen.
3. Toggle USB debugging off/on in Developer Options and re-accept the
   authorization prompt.

None of these can be done by an agent alone — they need a human hand on the cable
or screen. A software-only PnP device disable/re-enable via PowerShell was tried
once as a remote equivalent and failed ("Generic failure"); don't retry that path.

**For precise on-device UI taps**, use
`adb shell uiautomator dump /sdcard/window_dump.xml`, pull it, and read the exact
`bounds="[x1,y1][x2,y2]"` of the target element. Screenshot-based coordinate
estimation caused real mis-taps during Plan 3.
