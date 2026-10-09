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
| CI (lint, tests, expo-doctor) | ✅ Working — runs on PRs to `main` and pushes to `main` and `test_branch` |
| Android EAS Build | ⚙️ Manual only (`workflow_dispatch`) — needs `EXPO_TOKEN` (Part 2) |
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
| `EXPO_TOKEN` | Part 2 below |

Delete the old `EXPO_PUBLIC_GEMINI_API_KEY` secret from GitHub Actions and from Vercel if it is still there. Gemini now runs in a Supabase Edge Function (Part 7). The client must not receive that key.

`.env` is gitignored and never committed — ask a teammate for the values.

---

## Part 2: Expo / EAS (Android builds)

1. Create a free account at **[expo.dev](https://expo.dev)**.
2. The project already has an EAS project ID in `app.json`
   (`de58943b-ff1e-4471-85dd-37198408d602`). If that ID belongs to a different
   account, run `eas init` from `CompuClass-v.1.0-main/` to relink it.
3. **Validate locally before trusting CI** — the feedback loop is far faster:
   ```bash
   npm install -g eas-cli@24.11.0
   eas login
   cd CompuClass-v.1.0-main
   eas build --platform android --profile preview
   ```
   This queues a real cloud build and returns a downloadable `.apk` (preview profile).
   Expo generates and stores the Android keystore automatically — nothing to configure.
   Use Node.js 22 or newer. `eas-cli` 24.x pulls `@oclif/plugin-autocomplete`, which
   refuses to install on Node 20.
4. Once that works: **expo.dev → Account Settings → Access Tokens → Create token**,
   then add it as the `EXPO_TOKEN` GitHub secret. The token's Expo account must own
   project `de58943b-ff1e-4471-85dd-37198408d602`. If it does not, run `eas init`
   while logged into the account that should own the app, then commit the new
   `projectId`. Do not invent an `owner` field.
5. **Google Play**: the Android package is `com.lint123.compuclass` (all lowercase).
   Play Console rejects an application id that contains uppercase letters. This is a
   new application id, so an existing Play listing created under
   `CompuClasscom.lint123.compuclass` cannot be updated in place. Create a new app
   in Play Console for `com.lint123.compuclass`, or keep the old listing only if you
   revert the package name before the first upload.

Builds do **not** run on push. Open **Actions → EAS Build (Android) → Run workflow**
and choose the platform and profile (`preview` for an APK, `production` for an AAB).

> The EAS free tier allows a limited number of builds per month. A production build
> on every push to `main` was removed for that reason.

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
5. Add the two `EXPO_PUBLIC_SUPABASE_*` environment variables from Part 1, and tick
   **Production, Preview, and Development** for each. Preview is what powers pull
   request preview URLs. Do not add a Gemini key.
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

## Part 7: Supabase schema and Gemini (required before the app works)

`EXPO_PUBLIC_*` variables are compiled into the client bundle. That is expected for
the Supabase **anon** key, which is limited by Row Level Security. A Gemini key must
never be one of those variables.

### Existing Supabase project

Do **not** re-run `supabase-setup.sql` on a database that already has data. In the
SQL editor, run the preflight `SELECT` block at the top of the migration by
itself and read the result. Then run the whole file:

`CompuClass-v.1.0-main/supabase/migrations/20261006140000_security_hardening.sql`

The migration accepts either `quizzes.created_by` (the live project) or
`quizzes.lecturer_id` (a database built from `supabase-setup.sql`). If a column
or table it needs is missing, or a policy is not the shape it knows how to
replace, the transaction stops and rolls back.

### Brand-new project

Run `CompuClass-v.1.0-main/supabase-setup.sql`, then the maze, runner, and Windows
simulator scripts, then the security migration above. `supabase-setup.sql` still
creates the pre-hardening policies. The migration is what locks them down. It has
not been executed against any database.

### Promote a lecturer

Signups are always students. In the SQL editor (which runs as `postgres`):

```sql
UPDATE public.profiles SET role = 'lecturer' WHERE id = '<user-uuid>';
```

### Edge Function

From `CompuClass-v.1.0-main/`:

```bash
supabase link --project-ref <project-ref>
supabase secrets set GEMINI_API_KEY=<rotated key>
supabase functions deploy gemini-proxy
```

Create a new key in Google AI Studio, put that value in the Supabase secret, deploy
the function, then delete the old key. Remove `EXPO_PUBLIC_GEMINI_API_KEY` from
GitHub Actions secrets and from Vercel. The app calls `supabase.functions.invoke('gemini-proxy')`
and has no direct Gemini path. AI features fail until this function is deployed.

CI and the EAS workflows use Node 20, which is what Expo SDK 57 is verified on.

---

## Troubleshooting

**Vercel build fails instantly** — Root Directory isn't set to `CompuClass-v.1.0-main`.

**Deployed site loads but login fails** — the two `EXPO_PUBLIC_SUPABASE_*` variables are
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
