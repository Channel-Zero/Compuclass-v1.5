# Contributing to CompuClass

> **Setting the project up for the first time?** See [DEPLOYMENT.md](DEPLOYMENT.md)
> for the one-time admin steps: GitHub secrets, Vercel, Expo/EAS, and branch protection.

## Branch flow

```
personal branch (lindo_branch, kamo_branch, lutho_branch, thabo_branch, mila_branch)
        │  push/merge when ready to prove your work
        ▼
   test_branch  ──────────────►  CI: lint, tests, expo-doctor
        │  open a PR once CI is green
        ▼
      main  (CI runs on push; branch protection is a manual owner step)
        │
        ▼
  Vercel deploys the web build (its own Git integration, not a workflow)
  Android EAS builds are started by hand from Actions
```

- Work on your own branch as usual.
- Push to `test_branch` (or open a PR into `main`) to run the full CI check (lint, tests, `expo-doctor`). The same check also runs on every push to `main`.
- Open a PR from `test_branch` into `main`. Branch protection is **not** on until the owner enables it (DEPLOYMENT.md Part 5). Until then a red check does not block the merge.
- Merging into `main` does **not** start an Android build. Start one from **Actions → EAS Build (Android) → Run workflow**.
- **Vercel** deploys the web build via its own Git integration (no workflow involved) and publishes a preview URL for every pull request. Build settings live in `CompuClass-v.1.0-main/vercel.json`; the root directory and environment variables are set in the Vercel dashboard.

## Environment variables

The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
The Gemini key lives only as the Supabase secret `GEMINI_API_KEY` (see DEPLOYMENT.md Part 7).

**`.env` must live in `CompuClass-v.1.0-main/`** — the Expo project root, next to
`app.json`. A `.env` at the repository root is *not* read, and the app will silently
fall back to empty strings and fail to reach Supabase. It is gitignored, so each
developer keeps their own copy.

For deploys, the same two values are configured in the Vercel dashboard (web) and
as GitHub secrets (EAS builds), plus `EXPO_TOKEN` for EAS.

### Platform / feature status

| What | Status |
|---|---|
| Android builds | Manual — Actions → EAS Build. Keystore managed by Expo. Node 22, eas-cli 24.11.0. |
| iOS builds | **Not enabled** — requires a paid Apple Developer account ($99/yr). Available via the manual "Run workflow" inputs once that exists. |
| EAS Update (OTA) | **Disabled** — needs `eas update:configure` first (installs `expo-updates`, adds `runtimeVersion`). See the comment at the top of `.github/workflows/eas-update.yml`. |

> The EAS free tier allows a limited number of builds per month. Builds are
> `workflow_dispatch` only so a push does not consume one.

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
- `services/__tests__/` — unit tests for business logic (auth, AI, lecturer enrolment), with Supabase mocked.
- `components/__tests__/`, `screens/__tests__/` — component tests using React Native Testing Library.

Add tests alongside new services/components/screens using the same pattern. CI fails the build if `npm run test:ci` fails, so broken tests block merges to `main` just like lint errors do.
