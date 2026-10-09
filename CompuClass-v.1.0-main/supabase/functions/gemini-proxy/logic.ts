// Pure request validation, prompt building, response parsing and rate
// limiting for the gemini-proxy Edge Function. No Deno or network APIs here,
// so it can be unit-tested outside the Supabase runtime.

export const LIMITS = {
  maxMessages: 30,
  maxMessageChars: 2000,
  maxTitleChars: 200,
  maxTextChars: 100_000,
  // ~10 MB PDF once base64-encoded.
  maxPdfBase64Chars: 14_000_000,
  minQuestions: 1,
  maxQuestions: 20,
};

export const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  chat: { max: 10, windowMs: 60_000 },
  quiz: { max: 5, windowMs: 10 * 60_000 },
};

export class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ChatMessage = { role: 'user' | 'ai'; text: string };
export type ChatRequest = { action: 'chat'; messages: ChatMessage[] };
export type QuizRequest = { action: 'quiz'; title: string; questionCount: number; text?: string; pdfBase64?: string };

const CHAT_SYSTEM_PROMPT = `You are CompuBot, a helpful AI assistant for CompuClass — a computer hardware and software learning platform for students.
You help students understand PC components (CPU, GPU, RAM, storage, motherboard, PSU), troubleshoot hardware issues, prepare for quizzes, and learn about computer science concepts.
Keep responses clear, concise, and educational. Use simple language suitable for students.`;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validateRequest(body: unknown): ChatRequest | QuizRequest {
  if (!isPlainObject(body)) throw new RequestError(400, 'Invalid request.');

  if (body.action === 'chat') {
    const { messages } = body;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > LIMITS.maxMessages) {
      throw new RequestError(400, 'Invalid conversation.');
    }
    const clean = messages.map((m) => {
      if (!isPlainObject(m) || (m.role !== 'user' && m.role !== 'ai') || typeof m.text !== 'string') {
        throw new RequestError(400, 'Invalid conversation.');
      }
      const text = m.text.trim();
      if (!text || text.length > LIMITS.maxMessageChars) throw new RequestError(400, 'Message is empty or too long.');
      return { role: m.role, text } as ChatMessage;
    });
    return { action: 'chat', messages: clean };
  }

  if (body.action === 'quiz') {
    const { title, questionCount, text, pdfBase64 } = body;
    if (typeof title !== 'string' || !title.trim() || title.length > LIMITS.maxTitleChars) throw new RequestError(400, 'Invalid quiz title.');
    if (!Number.isInteger(questionCount) || (questionCount as number) < LIMITS.minQuestions || (questionCount as number) > LIMITS.maxQuestions) {
      throw new RequestError(400, `Question count must be between ${LIMITS.minQuestions} and ${LIMITS.maxQuestions}.`);
    }
    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasPdf = typeof pdfBase64 === 'string' && pdfBase64.length > 0;
    if (hasText === hasPdf) throw new RequestError(400, 'Provide either document text or a PDF.');
    if (hasText && (text as string).length > LIMITS.maxTextChars) throw new RequestError(413, 'Document is too large.');
    if (hasPdf && ((pdfBase64 as string).length > LIMITS.maxPdfBase64Chars || !/^[A-Za-z0-9+/=\s]+$/.test((pdfBase64 as string).slice(0, 1000)))) {
      throw new RequestError(413, 'PDF is too large or invalid.');
    }
    return {
      action: 'quiz',
      title: title.trim(),
      questionCount: questionCount as number,
      ...(hasText ? { text: text as string } : { pdfBase64: pdfBase64 as string }),
    };
  }

  throw new RequestError(400, 'Invalid request.');
}

const QUIZ_FORMAT_INSTRUCTIONS = `Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}`;

export function buildGeminiBody(req: ChatRequest | QuizRequest) {
  if (req.action === 'chat') {
    return {
      contents: [
        { role: 'user', parts: [{ text: CHAT_SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'Understood! I am CompuBot, your CompuClass AI assistant. How can I help you today?' }] },
        ...req.messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
      ],
    };
  }

  const n = req.questionCount;
  if (req.pdfBase64) {
    return {
      contents: [{
        parts: [
          { text: `Analyze this PDF document and create exactly ${n} multiple choice questions based on its content.\n\n${QUIZ_FORMAT_INSTRUCTIONS}\n\nIMPORTANT: Generate exactly ${n} questions that test understanding of the key concepts in the document.` },
          { inline_data: { mime_type: 'application/pdf', data: req.pdfBase64 } },
        ],
      }],
    };
  }
  return {
    contents: [{
      parts: [{ text: `Create exactly ${n} multiple choice questions based on this content:\n\n"${req.text}"\n\n${QUIZ_FORMAT_INSTRUCTIONS}\n\nIMPORTANT: Generate exactly ${n} questions. Make them educational and test understanding of key concepts.` }],
    }],
  };
}

export function extractText(geminiResponse: unknown): string {
  const text = (geminiResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Gemini returned no text');
  return text;
}

export function parseQuiz(aiText: string, questionCount: number) {
  const cleaned = aiText.replace(/```json\n?|```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed?.questions)) throw new Error('Gemini quiz JSON has no questions array');

  const questions = parsed.questions
    .filter((q: any) =>
      typeof q?.question === 'string' && q.question.trim() &&
      Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 6 &&
      q.options.every((o: unknown) => typeof o === 'string' && o.trim()) &&
      Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0 && q.correctAnswer < q.options.length)
    .slice(0, questionCount)
    .map((q: any) => ({
      question: q.question.trim().slice(0, 1000),
      options: q.options.map((o: string) => o.trim().slice(0, 300)),
      correctAnswer: q.correctAnswer,
    }));

  if (questions.length === 0) throw new Error('Gemini quiz JSON had no valid questions');
  return questions;
}

// Best-effort, per-instance sliding window. Edge Function instances don't
// share memory, so this caps bursts from one user rather than giving an exact
// global quota. Set a hard quota on the API key in Google Cloud as the backstop.
export function createRateLimiter(now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return {
    check(userId: string, action: string): { allowed: boolean; retryAfterSeconds: number } {
      const limit = RATE_LIMITS[action];
      const key = `${userId}:${action}`;
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < limit.windowMs);
      if (recent.length >= limit.max) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.ceil((limit.windowMs - (t - recent[0])) / 1000) };
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 10_000) hits.delete(hits.keys().next().value as string);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
