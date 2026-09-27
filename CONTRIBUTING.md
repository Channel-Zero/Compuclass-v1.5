# Contributing to CompuClass

> **Setting the project up for the first time?** See [DEPLOYMENT.md](DEPLOYMENT.md)
> for the one-time admin steps: GitHub secrets, Vercel, Expo/EAS, and branch protection.

## Branch flow

```
personal branch (lindo_branch, kamo_branch, lutho_branch, thabo_branch, mila_branch)
        │  push/merge when ready to prove your work
        ▼
   test_branch  ──────────────►  CI: lint, tests, expo-doctor
        │                          EAS Build (Android, 'preview' profile)
        │  open a PR once CI is green
        ▼
      main  (protected — PR + passing CI required to merge)
        │  on merge
        ▼
  EAS Build (Android, 'production' profile)
        +
  Vercel deploys the web build (its own Git integration, not a workflow)
```

- Work on your own branch as usual.
- Push to `test_branch` (or open a PR into it) to run the full CI check (lint, tests, `expo-doctor`) before you touch `main`.
- Open a PR from `test_branch` into `main`. The same CI check runs as a required status check — a red check blocks the merge.
- Merging into `main` automatically triggers an Android **EAS Build** on the `production` profile.
- **Vercel** deploys the web build via its own Git integration (no workflow involved) and publishes a preview URL for every pull request. Build settings live in `CompuClass-v.1.0-main/vercel.json`; the root directory and environment variables are set in the Vercel dashboard.

## Environment variables

The app reads `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and
`EXPO_PUBLIC_GEMINI_API_KEY`.

**`.env` must live in `CompuClass-v.1.0-main/`** — the Expo project root, next to
`app.json`. A `.env` at the repository root is *not* read, and the app will silently
fall back to empty strings and fail to reach Supabase. It is gitignored, so each
developer keeps their own copy.

For deploys, the same three values are configured in the Vercel dashboard (web) and
as GitHub secrets (EAS builds).

### Platform / feature status

| What | Status |
|---|---|
| Android builds | Active — EAS free tier, keystore managed by Expo |
| iOS builds | **Not enabled** — requires a paid Apple Developer account ($99/yr). Available via the manual "Run workflow" inputs once that exists. |
| EAS Update (OTA) | **Disabled** — needs `eas update:configure` first (installs `expo-updates`, adds `runtimeVersion`). See the comment at the top of `.github/workflows/eas-update.yml`. |

> **Heads up:** the EAS free tier allows a limited number of builds per month.
> Every push to `test_branch` or `main` consumes one. If you're iterating rapidly,
> remove `test_branch` from the triggers in `.github/workflows/eas-build.yml` and
> use the manual "Run workflow" button instead.

## Running checks locally

From `CompuClass-v.1.0-main/`:

```bash
npm ci
npm run lint       # ESLint
npm test           # Jest (watch mode)
npm run test:ci    # Jest with coverage, CI mode
npx expo-doctor    # project/dependency health check
```

## Tests

Tests live next to what they cover, in `__tests__/` folders:
- `services/__tests__/` — unit tests for business logic (auth, AI, offline sync), with Supabase/`fetch` mocked.
- `components/__tests__/`, `screens/__tests__/` — component tests using React Native Testing Library.

Add tests alongside new services/components/screens using the same pattern. CI fails the build if `npm run test:ci` fails, so broken tests block merges to `main` just like lint errors do.
