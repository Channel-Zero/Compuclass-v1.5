import { Platform } from 'react-native';
// readAsStringAsync lives in the legacy entry point since expo-file-system 54;
// importing it from 'expo-file-system' throws at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../config/supabase';
import { limiters, RateLimitError } from '../utils/rateLimiter';

// Every AI call goes through the gemini-proxy Edge Function. The Gemini key
// lives in the GEMINI_API_KEY secret and is never read by the app.
// See supabase/functions/gemini-proxy/README.md.
const PROXY_MAX_TEXT_CHARS = 100_000;
const PROXY_MAX_MESSAGES = 30;

async function invokeAiProxy(body) {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', { body });
  if (error) {
    if (error.context?.status === 429) {
      throw new RateLimitError(0, 'The AI assistant is busy right now. Please wait a moment and try again.');
    }
    throw error;
  }
  return data;
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
  questions: questions.map((q, index) => ({
    id: Date.now() + index,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    type: 'multiple-choice',
  })),
  aiGenerated: true,
});

export const aiService = {
  // Extract text from different file types
  async extractTextFromFile(file) {
    try {
      console.log('=== FILE EXTRACTION ===');
      console.log('File name:', file.name);
      console.log('File type:', file.mimeType);
      console.log('File URI:', file.uri);
      
      // Try to read as text for all file types
      try {
        const content = await readPickedFile(file);
        console.log('Extracted text length:', content.length);
        console.log('First 200 chars:', content.substring(0, 200));
        return content;
      } catch (readError) {
        console.log('Could not read as text:', readError.message);
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
    const { questions } = await invokeAiProxy({
      action: 'quiz',
      title,
      questionCount,
      text: String(text).slice(0, PROXY_MAX_TEXT_CHARS),
    });
    return toQuiz(title, questions);
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
    const { text } = await invokeAiProxy(body);
    return text;
  },

  async generateQuizFromPDF(file, title, questionCount = 5) {
    try {
      console.log('=== PDF QUIZ GENERATION START ===');
      
      // Read PDF as base64 using expo-file-system (React Native compatible)
      const base64Data = await readPickedFile(file, { base64: true });
      
      console.log('PDF converted to base64, length:', base64Data.length);

      const { questions } = await invokeAiProxy({ action: 'quiz', title, questionCount, pdfBase64: base64Data });
      console.log('=== PDF QUIZ GENERATION SUCCESS ===');
      return toQuiz(title, questions);
    } catch (error) {
      console.error('=== PDF QUIZ GENERATION ERROR ===');
      console.error('Error:', error.message);
      throw error;
    }
  }
};