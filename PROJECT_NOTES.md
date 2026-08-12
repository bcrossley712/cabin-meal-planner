# Project Notes — Cabin Meal Planner

Read this first if you're picking this project up in a new chat. It's
context for you (the next Claude), not end-user documentation.

## Usage-efficiency expectations for Claude

- **Assume the code in this conversation is current** unless told
  otherwise. Don't re-pull the repo if it's already been fetched this
  session — re-fetch only when told something changed outside the
  conversation, or at the start of a new session.
- **Pull or view only what the task touches.** Grep for the specific
  function/selector/section first, then view a targeted range — don't
  read whole files to make a small, well-scoped change.
- **Match verification effort to the change.** Only meaningfully test
  logic changes (e.g. the merge/sync logic, passcode gating). Skip
  deep verification for CSS/copy/layout changes.
- **Don't build throwaway sandboxes** to check something reasoning
  from the code can already answer. The wireframing phase (interactive
  React mockups) is done — it was for layout/flow decisions only and
  is not part of the real codebase, which is vanilla JS.
- **Keep this file lean.** Current state and the *why*, not a
  session-by-session diary — that belongs in git commits.
- **Deliver only the files that actually changed**, not a full re-zip.
- **Check in before packaging/shipping** — confirm the plan or show
  the diff before finalizing files, even for a single-file change,
  unless clearly told to just go ahead.
- **Batch related changes** into one pass rather than iterating
  file-by-file across separate turns once scope is clear.

## Working agreements with this user

- **Confirm before starting new builds/changes** — don't proceed on a
  feature without checking scope/direction first, especially where
  there's real design ambiguity.
- **Confirm before packaging/sending files** — and when sending, only
  include files actually touched by the change, not the whole project.
- **When packaging, include only files changed since the last actual
  delivery** (last time files were handed over for download) — not
  since the last git push. Those are different events.
- User uses VS Code + GitHub, deploying via GitHub Pages. Comfortable
  with basic coding but not an expert — okay to skip deep terminal
  hand-holding, but don't assume framework/tooling fluency.
- **Stack: vanilla JS, no build step.** `index.html`, `style.css`,
  `main.js` as the default three files. Split further by
  responsibility (e.g. a `storage.js` for localStorage/passcode
  handling, an `api.js` for Worker calls) once a file would otherwise
  push past ~500 lines — don't wait until it's unwieldy, but don't
  split preemptively either.
- **Accessibility is a real requirement, not a nice-to-have.** User
  checks builds with a browser contrast/accessibility extension
  (Lighthouse/axe-style). Verify contrast ratios (WCAG AA, 4.5:1 text
  / 3:1 large text) computationally when choosing colors, don't just
  eyeball them.
- **Mobile-only design target.** Phones/tablets, no desktop layout
  needed — don't add responsive breakpoints or affordances for wide
  screens unless asked.
- **No native browser dialogs** (`confirm()`, `alert()`, default
  `<input type="date">` chrome where avoidable) — custom-styled
  equivalents only, for visual consistency and to control contrast.
- Preference for validating code before handing it off, and being
  upfront about anything that can't be verified outside a real
  deployed environment (e.g. actual native date-picker behavior across
  iOS/Android, real cross-device sync).

## What this is

A small PWA for one family to plan meals for cabin trips: pick dates,
list meals per day, list ingredients per meal, and claim who's
bringing each ingredient. Built for a handful of known family members,
not the public — low-stakes threat model, no need for real accounts.

## Key architectural decisions (and why)

- **Vanilla HTML/CSS/JS, no framework, no build step.** Matches
  GitHub Pages' zero-config static hosting and the user's stated
  preference; nothing about this app's complexity justifies a
  framework or bundler.
- **Cloudflare Worker + KV as the backend.** GitHub Pages is
  static-only, so shared/synced data needs something else. The user
  already owns a Cloudflare account + domain, and Workers/KV are free
  at this scale — avoids paying for a server or introducing a new
  vendor (e.g. Firebase).
- **Shared family passcode instead of real accounts/Auth0.** Auth0
  was considered and explicitly rejected as overkill for a handful of
  known family members. The passcode is enforced **server-side in the
  Worker** on any write (add/edit/delete) — a client-side-only lock
  would be trivially bypassed by calling the API directly. Reading
  data stays open (no passcode to view), since the real risk is
  accidental/unauthorized edits and deletes, not privacy.
- **Passcode remembered per device via localStorage**, so it's a
  one-time entry per device, not a login every visit.
- **Custom confirm modals for all destructive actions** (delete trip/
  day/meal/ingredient) — replacing native `confirm()` both for style
  consistency and predictable contrast/accessibility.
- **Mobile-only layout.** This will only ever be opened on a phone or
  tablet at a cabin — no desktop design work needed.
- **Offline = strictly view-only, no queued/optimistic edits.** The app
  shows the last-synced data (from `localStorage`, via `storage.js`)
  and is fully navigable offline, but `canEdit()` in `render.js` hides
  every add/edit/delete control whenever `state.online` is false,
  regardless of whether the device is passcode-unlocked — matching the
  fact that a cabin trip is exactly when there's no signal. This was a
  deliberate simplification over queuing edits to sync later: an
  earlier version let edits happen optimistically while offline and
  retried saving in the background, which had a real bug (an edit made
  offline and never flushed before the tab closed got silently
  overwritten by the server's version on next load) and was confusing
  regardless (looked like it saved, didn't). `main.js` also has
  defensive `!state.online` guards in the mutation functions
  themselves, not just hidden UI, in case connectivity drops between a
  tap and the handler running. Uses the browser's standard
  `navigator.onLine` / `online`/`offline` events — not bulletproof
  (reflects "has a network interface," not "internet actually
  reachable"), but adequate for "no signal at a cabin."
- **Single source icon, generated into the full platform set.** One
  master image (1024×1024+) gets exported to: `apple-touch-icon.png`
  (180×180, iOS home screen), manifest icons at 192×192 and 512×512
  (Android), and a maskable 512×512 variant with safe-zone padding so
  Android's adaptive-icon masking doesn't crop the design. Also a
  standard favicon. Generated once, committed as static files — no
  runtime icon generation.
- **Update flow: waiting-worker + banner prompt, not silent
  auto-reload.** Standard pattern: the service worker does *not* call
  `self.skipWaiting()` in its install handler (deliberate omission —
  don't "fix" this). When a new version is deployed, the browser
  installs it in the background but keeps serving the old cached
  version until the user acts. The app shows a "new version available"
  banner with a Refresh button; tapping it messages the waiting worker
  to activate and reloads. Avoids yanking the UI out from under someone
  mid-edit on the ingredient list.
- **GitHub Actions stamps a version into the service worker on every
  deploy**, so the browser reliably detects "this is a new version" and
  the flow above actually fires. A `__VERSION__` placeholder in
  `service-worker.js` gets replaced with the commit hash (or a
  timestamp) at deploy time, which changes the cache name and forces
  the app shell to re-fetch. Without this, aggressive PWA caching can
  make a real deploy invisible to already-installed devices.

## Current state

Design/UX has been iterated through interactive wireframes (React,
sandbox-only — not the real codebase) to nail down structure and
flow before writing real code:

- Structure: **Trip → Day → Meal → Ingredients (with assignee)**.
- Trip list screen (create/select/delete trips) confirmed as needed —
  originally missing from an early pass, added back.
- Locked/unlocked editing pattern confirmed: view is always open,
  editing requires the family passcode, controlled via a lock toggle.
- Collapsible days and collapsible meals, confirmed.
- Known issue from the wireframe, to be solved properly in the real
  build rather than re-wireframed: the "tap to add a day" flow used an
  invisible overlay `<input type="date">` trick to jump straight to
  the native date picker on one tap — this did not work reliably.
  Needs a real, tested solution in the actual deployed PWA (native
  date input behavior doesn't sandbox well in an artifact preview).
- Color palette and type system (pine/brass/cream, Bitter + Work Sans
  + IBM Plex Mono) verified against WCAG AA contrast — not yet
  re-verified against the real rendered CSS (only checked as raw hex
  pairs during wireframing).

## What's realistically next

- **Initial build delivered** (first full project drop, as a zip per
  the user's request — see "Working agreements": don't send files
  until the build actually starts, and the first drop is the whole
  project). Delivered: `index.html`, `style.css`, `main.js`,
  `render.js`, `storage.js`, `api.js`, `sw-register.js`,
  `service-worker.js`, `manifest.json`, `icons/`, `cf-worker/`
  (Worker + wrangler.toml), `.github/workflows/deploy.yml`,
  `README.md`, this file. **Untested against a real deployed Worker or
  a real device** — the user still needs to run through
  `README.md`'s deploy steps (create KV namespace, set the
  `FAMILY_PASSCODE` secret, deploy the Worker, set `API_BASE_URL` in
  `api.js`, enable GitHub Pages) before anything here has been proven
  to actually work end-to-end.
- From here on, per the packaging-diff rule: only re-deliver files
  that changed since this delivery, not a full re-zip.
- Not yet built/tested, flagged in README as things to verify on real
  devices after first deploy: install prompt on iOS + Android, cross-
  device sync timing, wrong-passcode re-lock behavior, offline
  behavior, and the update banner after a second deploy.
- No code has shipped to the user yet — nothing to track as
  "delivered" for the packaging-diff rule above yet.
- **Icon done.** Cabin silhouette (two-tone brass A-frame roof, cream
  walls) with a plate/fork/knife "window," in the app's pine/brass/
  cream palette. Source SVGs (`icon-master.svg`, full-bleed; and
  `icon-maskable-master.svg`, content scaled to ~80% and centered for
  Android's safe zone) plus the exported PNG/ICO set already delivered
  — see delivery note below, don't regenerate from scratch.
