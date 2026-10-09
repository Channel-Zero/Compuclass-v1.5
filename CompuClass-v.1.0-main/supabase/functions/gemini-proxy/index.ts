// gemini-proxy: keeps the Gemini API key on the server.
//
// The app sends { action: 'chat' | 'quiz', ... } with the user's Supabase
// session token. This function checks the token belongs to a real signed-in
// user, validates and rate-limits the request, calls Gemini with the secret
// key, and returns only the result. Full error details are logged here
// (Supabase Dashboard -> Edge Functions -> gemini-proxy -> Logs); clients only
// ever get a generic message.
//
// Secrets (supabase secrets set ...): GEMINI_API_KEY, optional GEMINI_MODEL.
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by the runtime.

import { buildGeminiBody, createRateLimiter, extractText, parseQuiz, RequestError, validateRequest } from './logic.ts';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_TIMEOUT_MS = 60_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const rateLimiter = createRateLimiter();

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

async function getUserId(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
  });
  if (!response.ok) return null;
  const user = await response.json();
  // The anon key is itself a valid JWT; only accept real user sessions.
  return typeof user?.id === 'string' ? user.id : null;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const requestId = crypto.randomUUID();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  let userId: string | null = null;

  try {
    userId = await getUserId(req.headers.get('Authorization'));
    if (!userId) {
      log('warn', 'unauthenticated_request', { requestId, ip });
      return json(401, { error: 'Please sign in to use AI features.' });
    }

    let body: unknown;
    try { body = await req.json(); } catch { throw new RequestError(400, 'Invalid request.'); }
    const request = validateRequest(body);

    const { allowed, retryAfterSeconds } = rateLimiter.check(userId, request.action);
    if (!allowed) {
      log('warn', 'rate_limited', { requestId, ip, userId, action: request.action, retryAfterSeconds });
      return json(429, { error: 'Too many requests. Please wait a moment and try again.' }, { 'Retry-After': String(retryAfterSeconds) });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY secret is not set');
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-1.5-flash';

    const geminiResponse = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      // Key in a header, not the URL, so it never shows up in request logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGeminiBody(request)),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (!geminiResponse.ok) {
      throw new Error(`Gemini ${geminiResponse.status}: ${(await geminiResponse.text()).slice(0, 2000)}`);
    }

    const text = extractText(await geminiResponse.json());
    log('info', 'ai_request_ok', { requestId, userId, action: request.action });

    return request.action === 'chat'
      ? json(200, { text })
      : json(200, { questions: parseQuiz(text, request.questionCount) });
  } catch (error) {
    if (error instanceof RequestError) {
      log('warn', 'invalid_request', { requestId, ip, userId, status: error.status, reason: error.message });
      return json(error.status, { error: error.message });
    }
    log('error', 'ai_request_failed', { requestId, ip, userId, error: String((error as Error)?.stack ?? error) });
    return json(502, { error: 'The AI service is unavailable right now. Please try again later.', requestId });
  }
}

Deno.serve(handler);
