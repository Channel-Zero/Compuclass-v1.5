# Deployment & CI/CD Setup

Everything in this document is **one-time setup that requires repository admin
access** (GitHub Settings → Secrets, branch protection) or an account the project
does not have yet (Expo, Vercel). The pipeline itself is already committed and
working — these steps switch on the parts that need credentials.

**Who needs to do this:** the owner/admin of `Tkumalo-dev/CompuClass-v.1.0`.

---

## Current status

| Piece | State |
|---|---|
| CI (lint, tests, expo-doctor) | ✅ Working — runs on PRs to `main` and pushes to `test_branch` |
| Android EAS Build | ⚙️ Workflow ready — needs `EXPO_TOKEN` (Part 2) |
| Web deploy (Vercel) | ⚙️ Config committed — needs the project importing (Part 3) |
| iOS builds | ⛔ Not enabled — needs a paid Apple Developer account ($99/yr) |
| EAS Update (OTA) | ⛔ Disabled — needs `eas update:configure` (Part 6) |
| Branch protection on `main` | ⛔ Not set — **nothing currently blocks a bad merge** (Part 5) |

---

## Part 1: GitHub secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Where to get it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `CompuClass-v.1.0-main/.env` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `CompuClass-v.1.0-main/.env` |
| `EXPO_PUBLIC_GEMINI_API_KEY` | `CompuClass-v.1.0-main/.env` |
| `EXPO_TOKEN` | Part 2 below |

`.env` is gitignored and never committed — ask a teammate for the values.

---

## Part 2: Expo / EAS (Android builds)

1. Create a free account at **[expo.dev](https://expo.dev)**.
2. The project already has an EAS project ID in `app.json`
   (`de58943b-ff1e-4471-85dd-37198408d602`). If that ID belongs to a different
   account, run `eas init` from `CompuClass-v.1.0-main/` to relink it.
3. **Validate locally before trusting CI** — the feedback loop is far faster:
   ```bash
   npm install -g eas-cli
   eas login
   cd CompuClass-v.1.0-main
   eas build --platform android --profile preview
   ```
   This queues a real cloud build and returns a downloadable `.apk`.
   Expo generates and stores the Android keystore automatically — nothing to configure.
4. Once that works: **expo.dev → Account Settings → Access Tokens → Create token**,
   then add it as the `EXPO_TOKEN` GitHub secret.

After that, builds trigger automatically:

| Trigger | Profile |
|---|---|
| Push to `test_branch` | `preview` |
| Push to `main` | `production` |
| Actions → EAS Build → Run workflow | your choice (incl. iOS) |

> ⚠️ **The EAS free tier allows a limited number of builds per month, and every
> push to `test_branch` or `main` consumes one.** If the team pushes frequently,
> remove `test_branch` from the triggers in `.github/workflows/eas-build.yml` and
> use the manual "Run workflow" button instead.

### iOS
`eas-build.yml` defaults to Android only, because iOS device builds require a paid
Apple Developer account. When one exists, use **Actions → EAS Build → Run workflow →
platform: ios** (or `all`). No file changes needed.

---

## Part 3: Vercel (web deploy)

The web build is already verified working — the exported bundle has been served and
tested locally, including client-side routing. Vercel just needs to be pointed at it.

1. **[vercel.com/new](https://vercel.com/new)** → **Continue with GitHub**.
2. Import **`Tkumalo-dev/CompuClass-v.1.0`**.
   If the repo isn't listed, click **Adjust GitHub App Permissions** and grant access
   (an org owner may need to approve).
3. **Set Root Directory → `CompuClass-v.1.0-main`** ← *the step that matters most.*
   There is no `package.json` at the repository root, so the build fails immediately
   without this.
4. Leave **Framework Preset** as auto-detected (`Other`). Do **not** set Build Command
   or Output Directory by hand — `CompuClass-v.1.0-main/vercel.json` already defines:
   ```json
   "buildCommand": "npx expo export --platform web",
   "outputDirectory": "dist"
   ```
5. Add the three `EXPO_PUBLIC_*` environment variables from Part 1, and tick
   **Production, Preview, and Development** for each. Preview is what powers pull
   request preview URLs.
6. **Deploy.** First build takes roughly 2–4 minutes.

You get a live URL, automatic redeploys on every push to `main`, and a preview URL
commented on every pull request.

There is intentionally **no web deploy GitHub Action** — Vercel's own Git integration
handles it. Adding a workflow back would double-deploy.

---

## Part 4: Local development

**`.env` must live in `CompuClass-v.1.0-main/`**, next to `app.json` — *not* at the
repository root. Expo only reads `.env` from its project root. A root-level `.env`
is silently ignored, and the app falls back to empty Supabase credentials and fails
to connect. (This was an actual bug in the repo; a stale copy still sits at the root.)

```bash
cd CompuClass-v.1.0-main
npm ci            # not `npm install` — matches CI exactly
npm run lint
npm test
npx expo-doctor
npm start
```

If a build behaves oddly after changing `.env`, clear the Metro cache:
`npx expo export --platform web --clear`.

---

## Part 5: Branch protection (important)

CI does not block anything until this is switched on. Right now a red check is only
a suggestion.

**Settings → Branches → Add branch protection rule**

- Branch name pattern: `main`
- ☑️ Require a pull request before merging
- ☑️ Require status checks to pass before merging
  - Select **`Lint, test, and validate project health`**
- ☑️ Require branches to be up to date before merging *(recommended)*

---

## Part 6: EAS Update / OTA (optional, later)

Disabled because the project has no `expo-updates` package and no `runtimeVersion`
in `app.json`, so it could never succeed. To enable:

```bash
cd CompuClass-v.1.0-main
eas update:configure     # installs expo-updates, adds runtimeVersion + updates.url
```

Commit the resulting changes, then restore the `push` trigger in
`.github/workflows/eas-update.yml` (instructions are in the file header).

This lets JavaScript-only changes reach installed apps instantly, without an app
store review.

---

## Known issue: exposed Gemini API key

`EXPO_PUBLIC_*` variables are compiled into the client bundle by design — they are
readable by anyone who inspects the app. This is expected and safe for the Supabase
**anon** key, which is protected by the Row Level Security policies in
`supabase-setup.sql`.

It is **not** safe for `EXPO_PUBLIC_GEMINI_API_KEY`. Anyone can extract it from the
public web bundle and spend the project's Gemini quota. It is currently used directly
from the client in `services/aiService.js`.

The fix is to move Gemini calls behind a Supabase Edge Function that holds the key
server-side, so the client calls the function instead of Google. Worth doing before
the web app is shared publicly. Rotate the key when you do.

---

## Troubleshooting

**Vercel build fails instantly** — Root Directory isn't set to `CompuClass-v.1.0-main`.

**Deployed site loads but login fails** — the three `EXPO_PUBLIC_*` variables are
missing from Vercel, or weren't enabled for that environment. Check the browser
console for `Missing Supabase environment variables`.

**`npm ci` fails in CI after changing dependencies** — `package.json` and
`package-lock.json` are out of sync. Run `npm install` locally and commit the updated
lockfile. Always verify with `npm ci`, not `npm install`; `npm ci` is stricter and is
what CI runs.

**Tests pass locally but fail in CI with "Cannot find module X"** — a package is used
but not declared in `package.json`. It resolves locally by luck of npm hoisting, but
installs nested on the Linux runner. Add it as an explicit dependency.

**EAS build fails on credentials** — for Android, let Expo generate the keystore
(answer yes when prompted). For iOS, a paid Apple Developer account is required.
