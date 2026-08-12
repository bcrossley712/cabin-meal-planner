# Cabin Meal Planner

A small PWA for planning meals on family cabin trips — dates, meals,
ingredients, and who's bringing what. See `PROJECT_NOTES.md` for the
full "why" behind how this is built.

Two independent pieces to deploy:

- **The app itself** — plain HTML/CSS/JS, deployed to **GitHub Pages**.
- **The backend** — a **Cloudflare Worker + KV**, so devices can share
  data without you paying for a server.

Do the backend first — the app needs its URL.

## 1. Deploy the Cloudflare Worker

From the `cf-worker/` folder:

```bash
npm install -g wrangler
wrangler login

# Create the KV namespace that stores the trip data
wrangler kv namespace create CABIN_KV
# Copy the "id" it prints into wrangler.toml (replace REPLACE_WITH_YOUR_KV_NAMESPACE_ID)

# Set the family passcode (you'll be prompted to type it — this is the
# real passcode, checked server-side; it is never stored in the app's code)
wrangler secret put FAMILY_PASSCODE

wrangler deploy
```

Wrangler will print your Worker's URL, something like:
`https://cabin-meal-planner.yoursubdomain.workers.dev`

Since you already have a Cloudflare domain, you can optionally map this
to a custom subdomain (e.g. `api.yourdomain.com`) instead — a Worker
Route or Custom Domain, set up from the Cloudflare dashboard under your
Worker's settings.

## 2. Point the app at the Worker

Edit `api.js`, line near the top:

```js
const API_BASE_URL = "https://cabin-meal-planner.yoursubdomain.workers.dev";
```

Optional but recommended once you know your GitHub Pages URL: in
`cf-worker/wrangler.toml`, uncomment and set:

```toml
[vars]
ALLOWED_ORIGIN = "https://yourusername.github.io"
```

then `wrangler deploy` again. This restricts the API to requests coming
from your actual site instead of any website.

## 3. Deploy the app to GitHub Pages

1. Push this repo to GitHub.
2. Repo → **Settings → Pages → Source → GitHub Actions**.
3. Push to `main` (or run the workflow manually from the Actions tab).
   `.github/workflows/deploy.yml` builds and deploys automatically, and
   stamps the service worker with the commit SHA so updates are picked
   up correctly on devices that already installed the app (see
   `PROJECT_NOTES.md` → "Update flow").

`cf-worker/` and `.github/` are excluded from the deployed site
automatically — only the app files go live.

## Testing locally before deploying

Service workers require a "secure context," but `localhost` counts, so
a plain static server works:

```bash
npx serve .
# or: python3 -m http.server 8000
```

Note the service worker won't do anything interesting locally since
`__VERSION__` only gets replaced by the GitHub Actions deploy — that's
expected, it just means the update-banner flow can only really be
tested after a real deploy.

## How the passcode actually works

Typing a passcode in the app just remembers it on that device
(localStorage) and optimistically unlocks editing. It is **not**
checked by the app itself — the Worker is the only thing that verifies
it, on every save. If it's wrong, the save fails, the app re-locks
itself and asks again. This means the real passcode never has to exist
anywhere in the app's client-side code.

## After first deploy — a few things worth testing on real devices

- Install prompt / "Add to Home Screen" on both an iPhone and an
  Android phone.
- Add a trip/day/meal/ingredient from one device, confirm it shows up
  on another within ~20 seconds (the polling interval).
- Enter the wrong passcode once on purpose — confirm it re-locks
  cleanly rather than silently failing.
- Turn on airplane mode, confirm the app still opens and shows the last
  synced data.
- After a second deploy, confirm the "new version available" banner
  shows up on a device that already had the app open/installed.
