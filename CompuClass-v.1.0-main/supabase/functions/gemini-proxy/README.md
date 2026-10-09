# gemini-proxy

Keeps the Gemini API key on the server. The app calls this function with the
user's Supabase session. The function checks that a real user is signed in,
validates and rate-limits the request (chat: 10/min per user, quiz: 5 per
10 min per user), and calls Gemini with a secret key.

Until you switch it on, the app keeps calling Gemini directly with
`EXPO_PUBLIC_GEMINI_API_KEY`, which is compiled into the APK and the web
bundle, where anyone can extract it.

## Switch-over (in this order)

Run these from `CompuClass-v.1.0-main/`. They need the
[Supabase CLI](https://supabase.com/docs/guides/cli).

1. **Create a new Gemini key** in Google AI Studio / Google Cloud. The current
   key has already shipped in public builds, so treat it as compromised.
   In Google Cloud, also set a daily quota on the new key as a hard cost cap.
2. **Store it as a function secret:**
   ```sh
   supabase secrets set GEMINI_API_KEY=<new key> --project-ref qdtbmdsssjmapodladcs
   # optional; defaults to gemini-1.5-flash, which the app used before
   supabase secrets set GEMINI_MODEL=<model name> --project-ref qdtbmdsssjmapodladcs
   ```
3. **Deploy:**
   ```sh
   supabase functions deploy gemini-proxy --project-ref qdtbmdsssjmapodladcs
   ```
4. **Turn on proxy mode** by setting `EXPO_PUBLIC_USE_AI_PROXY=true` in `.env`,
   EAS environment variables, Vercel env vars, and the GitHub Actions secrets
   used by the workflows. Test the chatbot and AI quiz generation.
5. **Remove `EXPO_PUBLIC_GEMINI_API_KEY`** from all of those places and from
   the workflow files, then rebuild.
6. **Revoke the old key** in Google Cloud.

## Logs

Dashboard → Edge Functions → gemini-proxy → Logs. Each line is JSON, with
`event` set to one of: `unauthenticated_request`, `invalid_request`,
`rate_limited`, `ai_request_failed`, or `ai_request_ok`. Lines include the
user id and client IP where available.

## Limits

The per-user rate limit is kept in memory for each function instance. It stops
bursts from one user, but it isn't an exact global quota. The Google Cloud key
quota from step 1 is the hard backstop.
