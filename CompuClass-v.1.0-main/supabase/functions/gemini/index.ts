// CompuBot / quiz generation. The Gemini API key lives in the function secret
// GEMINI_API_KEY (`supabase secrets set GEMINI_API_KEY=...`), never in the app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_TEXT = 30000;
const MAX_PDF_CHARS = 8_000_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function callGemini(apiKey: string, parts: unknown[]) {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText.slice(0, 500)}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini API');
  return text as string;
}

function parseQuiz(raw: string) {
  const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Gemini did not return any questions');
  }
  return parsed.questions.map((q: { question?: string; options?: string[]; correctAnswer?: number }, index: number) => {
    const options = Array.isArray(q.options) ? q.options.map((option) => String(option)) : [];
    if (!q.question || options.length < 2) throw new Error('Gemini returned a malformed question');
    const correctAnswer = Number.isInteger(q.correctAnswer) ? q.correctAnswer : 0;
    return {
      id: Date.now() + index,
      question: String(q.question),
      options,
      correctAnswer: Math.min(Math.max(correctAnswer, 0), options.length - 1),
      type: 'multiple-choice',
    };
  });
}

const quizPrompt = (count: number, source: string) => `Create exactly ${count} multiple choice questions based on this content:

"${source}"

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}

IMPORTANT: Generate exactly ${count} questions. Make them educational and test understanding of key concepts.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'Gemini is not configured' }, 500);

    const body = await req.json();
    const action = body?.action;
    const questionCount = Math.min(20, Math.max(1, Number(body?.questionCount) || 5));

    if (action === 'chat') {
      const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
      const systemPrompt = `You are CompuBot, a helpful AI assistant for CompuClass — a computer hardware and software learning platform for students.
You help students understand PC components (CPU, GPU, RAM, storage, motherboard, PSU), troubleshoot hardware issues, prepare for quizzes, and learn about computer science concepts.
Keep responses clear, concise, and educational. Use simple language suitable for students.`;
      const transcript = messages
        .map((message: { role?: string; text?: string }) => `${message.role === 'user' ? 'Student' : 'CompuBot'}: ${String(message.text ?? '').slice(0, 4000)}`)
        .join('\n');
      const text = await callGemini(apiKey, [{ text: `${systemPrompt}\n\nConversation:\n${transcript}\n\nCompuBot:` }]);
      return json({ text });
    }

    if (action === 'quiz') {
      const title = String(body.title ?? 'Quiz').slice(0, 200);
      let raw: string;
      if (body.pdfBase64) {
        const pdfBase64 = String(body.pdfBase64);
        if (pdfBase64.length > MAX_PDF_CHARS) return json({ error: 'PDF is too large' }, 413);
        raw = await callGemini(apiKey, [
          { text: quizPrompt(questionCount, 'the attached PDF') },
          { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
        ]);
      } else {
        const text = String(body.text ?? '').slice(0, MAX_TEXT);
        if (!text.trim()) return json({ error: 'No content to generate a quiz from' }, 400);
        raw = await callGemini(apiKey, [{ text: quizPrompt(questionCount, text) }]);
      }
      return json({
        title,
        questions: parseQuiz(raw),
        aiGenerated: true,
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini request failed';
    return json({ error: message }, 500);
  }
});
