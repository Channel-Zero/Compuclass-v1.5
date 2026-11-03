import { Platform } from 'react-native';
// readAsStringAsync lives in the legacy entry point since expo-file-system 54;
// importing it from 'expo-file-system' throws at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../config/supabase';
import { limiters, RateLimitError } from '../utils/rateLimiter';
import { spreadCorrectAnswer } from '../utils/quizFlow';
import { AppError } from '../utils/errorMessages';

// Every AI call goes through the gemini-proxy Edge Function. The Gemini key
// is the Supabase secret GEMINI_API_KEY, or Compuclass-gemini-new when that
// is unset. The app never reads it. See supabase/functions/gemini-proxy/README.md.
const PROXY_MAX_TEXT_CHARS = 100_000;
const PROXY_MAX_MESSAGES = 30;
export const AI_REQUEST_TIMEOUT_MS = 20_000;
let timeoutOverride = 0;

// Tests set a short deadline. Production leaves this at 0 and uses AI_REQUEST_TIMEOUT_MS.
export function setAiRequestTimeoutForTests(ms) {
  timeoutOverride = ms;
}

// supabase-js hides a non-2xx body behind FunctionsHttpError.context, which is
// the Response. The message on the error itself is only "non-2xx status code".
async function messageFromProxyError(error) {
  const context = error?.context;
  if (!context) return null;
  if (typeof context.json === 'function') {
    try {
      const source = typeof context.clone === 'function' ? context.clone() : context;
      const body = await source.json();
      if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim();
    } catch {
      return null;
    }
  }
  if (typeof context.error === 'string' && context.error.trim()) return context.error.trim();
  return null;
}

async function requestAiProxy(body) {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', { body });
  if (error) {
    const status = error.context?.status ?? error.status;
    if (status === 429) {
      throw new RateLimitError(0, 'The AI assistant is busy right now. Please wait a moment and try again.');
    }
    const serverMessage = await messageFromProxyError(error);
    if (serverMessage) throw new AppError(serverMessage);
    throw error;
  }
  return data;
}

// The Edge Function waits up to 60s on Gemini. Without a client deadline the
// chat stays on the typing indicator and never shows an error.
async function invokeAiProxy(body) {
  const timeoutMs = timeoutOverride || AI_REQUEST_TIMEOUT_MS;
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });
  const request = requestAiProxy(body).then(
    (value) => ({ timedOut: false, value }),
    (error) => ({ timedOut: false, error }),
  );
  try {
    const result = await Promise.race([request, timeout]);
    if (result.timedOut) throw new AppError('CompuBot took too long to answer. Please try again.');
    if (result.error) throw result.error;
    return result.value;
  } finally {
    clearTimeout(timer);
  }
}

// Reads a file chosen with expo-document-picker. expo-file-system has no web
// implementation; on web the picker gives a blob: URI that fetch can read.
async function readPickedFile(file, { base64 = false } = {}) {
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    if (!base64) return response.text();
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  return base64
    ? FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 })
    : FileSystem.readAsStringAsync(file.uri);
}

const toQuiz = (title, questions) => ({
  title,
  questions: questions.map((q, index) => {
    const spread = spreadCorrectAnswer(q.options, q.correctAnswer);
    return {
      id: Date.now() + index,
      question: q.question,
      options: spread.options,
      correctAnswer: spread.correctIndex,
      type: 'multiple-choice',
    };
  }),
  aiGenerated: true,
});

export const aiService = {
  // Extract text from different file types
  async extractTextFromFile(file) {
    try {
      // Try to read as text for all file types
      try {
        const content = await readPickedFile(file);
        return content;
      } catch {
        // Fallback: use filename and ask AI to generate generic questions
        return `Generate educational quiz questions about: ${file.name.replace(/\.[^/.]+$/, '')}`;
      }
    } catch (error) {
      console.error('Extraction error:', error);
      throw new Error('Failed to extract text from file');
    }
  },

  // Generate quiz using Google Gemini (FREE)
  async generateQuizFromText(text, title, questionCount = 5) {
    const data = await invokeAiProxy({
      action: 'quiz',
      title,
      questionCount,
      text: String(text).slice(0, PROXY_MAX_TEXT_CHARS),
    });
    if (!Array.isArray(data?.questions)) {
      throw new AppError('CompuBot is unavailable right now. Please try again in a moment.');
    }
    return toQuiz(title, data.questions);
  },

  // Main function to generate quiz from file
  async generateQuizFromFile(file, title, questionCount = 5) {
    await limiters.aiQuiz.consume('device');
    // For PDFs, send directly to Gemini
    if (file.mimeType === 'application/pdf') {
      return await this.generateQuizFromPDF(file, title, questionCount);
    }
    const text = await this.extractTextFromFile(file);
    return await this.generateQuizFromText(text, title, questionCount);
  },

  // Chat with AI assistant
  async chatWithAI(messages, context = null, imageBase64 = null) {
    await limiters.aiChat.consume('device');

    const recent = messages.slice(-PROXY_MAX_MESSAGES).map((m) => ({
      role: m.role === 'user' ? 'user' : 'ai',
      text: String(m.text || '').trim(),
    })).filter((m, index, all) => m.text || index === all.length - 1);
    if (recent.length === 0) throw new Error('Invalid conversation.');
    const last = recent[recent.length - 1];
    if (!last.text) last.text = 'Please look at the attached image.';
    if (context) last.text = `${last.text}\n\n(The user is currently viewing: ${context})`;
    const body = { action: 'chat', messages: recent };
    if (imageBase64) body.imageBase64 = imageBase64;
    const data = await invokeAiProxy(body);
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) throw new AppError('CompuBot is unavailable right now. Please try again in a moment.');
    return text;
  },

  async generateQuizFromPDF(file, title, questionCount = 5) {
    try {
      // Read PDF as base64 using expo-file-system (React Native compatible)
      const base64Data = await readPickedFile(file, { base64: true });
      const data = await invokeAiProxy({ action: 'quiz', title, questionCount, pdfBase64: base64Data });
      if (!Array.isArray(data?.questions)) {
        throw new AppError('CompuBot is unavailable right now. Please try again in a moment.');
      }
      return toQuiz(title, data.questions);
    } catch (error) {
      console.error('=== PDF QUIZ GENERATION ERROR ===');
      console.error('Error:', error.message);
      throw error;
    }
  }
};