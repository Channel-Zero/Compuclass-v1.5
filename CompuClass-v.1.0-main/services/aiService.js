import { Platform } from 'react-native';
// readAsStringAsync lives in the legacy entry point since expo-file-system 54;
// importing it from 'expo-file-system' throws at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../config/supabase';
import { limiters, RateLimitError } from '../utils/rateLimiter';

// When EXPO_PUBLIC_USE_AI_PROXY=true, AI requests go through the gemini-proxy
// Supabase Edge Function, which holds the Gemini key server-side. Once that is
// deployed and switched on, remove EXPO_PUBLIC_GEMINI_API_KEY from every
// environment so the key is no longer compiled into the app.
// See supabase/functions/gemini-proxy/README.md.
const USE_AI_PROXY = process.env.EXPO_PUBLIC_USE_AI_PROXY === 'true';
const PROXY_MAX_TEXT_CHARS = 100_000;
const PROXY_MAX_MESSAGES = 30;

// Legacy direct mode: Google Gemini API configuration (key ships in the app bundle)
const GEMINI_API_KEY = USE_AI_PROXY ? undefined : process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-3.6-flash';

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
    if (USE_AI_PROXY) {
      const { questions } = await invokeAiProxy({ action: 'quiz', title, questionCount, text: String(text).slice(0, PROXY_MAX_TEXT_CHARS) });
      return toQuiz(title, questions);
    }
    try {
      console.log('=== AI QUIZ GENERATION START ===');
      console.log('Text length:', text.length);
      console.log('Question count:', questionCount);
      
      const prompt = `Create exactly ${questionCount} multiple choice questions based on this content:

"${text}"

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

IMPORTANT: Generate exactly ${questionCount} questions. Make them educational and test understanding of key concepts.`;

      const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      console.log('API URL:', url.replace(GEMINI_API_KEY, 'KEY_HIDDEN'));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        }),
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API ERROR RESPONSE:', errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API Response:', JSON.stringify(data, null, 2));
      
      if (!data.candidates || !data.candidates[0]) {
        console.error('No candidates in response');
        throw new Error('No response from Gemini API');
      }
      
      const aiResponse = data.candidates[0].content.parts[0].text;
      console.log('AI Response text:', aiResponse);
      
      // Clean response and parse JSON
      const cleanResponse = aiResponse.replace(/```json\n?|```\n?/g, '').trim();
      console.log('Cleaned response:', cleanResponse);
      
      const parsedQuiz = JSON.parse(cleanResponse);
      console.log('Parsed quiz:', parsedQuiz);
      
      console.log('=== AI QUIZ GENERATION SUCCESS ===');
      return {
        title,
        questions: parsedQuiz.questions.map((q, index) => ({
          id: Date.now() + index,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          type: 'multiple-choice'
        })),
        aiGenerated: true
      };
    } catch (error) {
      console.error('=== AI QUIZ GENERATION ERROR ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
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
  async chatWithAI(messages, context = null, imageBase64 = null, retries = 3) {
    await limiters.aiChat.consume('device');

    if (USE_AI_PROXY) {
      // The proxy builds its own system prompt and accepts text only, so the
      // screen context rides along on the last user message. Image chat has no
      // proxy equivalent yet; see supabase/functions/gemini-proxy/logic.ts.
      if (imageBase64) {
        throw new Error('Image questions are not available while the AI proxy is enabled.');
      }
      const recent = messages.slice(-PROXY_MAX_MESSAGES).map((m) => ({
        role: m.role === 'user' ? 'user' : 'ai',
        text: m.text,
      }));
      if (context && recent.length > 0) {
        const last = recent[recent.length - 1];
        last.text = `${last.text}\n\n(The user is currently viewing: ${context})`;
      }
      const { text } = await invokeAiProxy({ action: 'chat', messages: recent });
      return text;
    }

    const systemPrompt = `You are CompuBot, a helpful AI assistant for CompuClass — a computer hardware and software learning platform for students.
You help students understand PC components (CPU, GPU, RAM, storage, motherboard, PSU), troubleshoot hardware issues, prepare for quizzes, and learn about computer science concepts.
Keep responses clear, concise, and educational. Use simple language suitable for students.
Always respond in the same language the user writes in.${
  context ? `\nThe user is currently viewing: ${context}. Use this as context if relevant.` : ''
}`;

    const mappedMessages = messages.map((m, i) => {
      const isLast = i === messages.length - 1;
      const parts = [];
      if (m.text) parts.push({ text: m.text });
      if (isLast && imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
      return { role: m.role === 'user' ? 'user' : 'model', parts };
    });

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood! I am CompuBot, your CompuClass AI assistant. How can I help you today?' }] },
      ...mappedMessages,
    ];

    const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
        });

        if (response.status === 503 && attempt < retries) {
          await new Promise(res => setTimeout(res, attempt * 2000));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          const apiError = new Error(`Gemini API error: ${response.status} - ${errorBody}`);
          // A rejected request (bad key, quota, malformed body) returns the same
          // answer however often it is repeated, so it must not be retried.
          apiError.noRetry = true;
          throw apiError;
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
      } catch (error) {
        // Only transport-level failures are worth another attempt.
        if (error.noRetry || attempt === retries) throw error;
        await new Promise(res => setTimeout(res, attempt * 2000));
      }
    }
  },

  async generateQuizFromPDF(file, title, questionCount = 5) {
    try {
      console.log('=== PDF QUIZ GENERATION START ===');
      
      // Read PDF as base64 using expo-file-system (React Native compatible)
      const base64Data = await readPickedFile(file, { base64: true });
      
      console.log('PDF converted to base64, length:', base64Data.length);

      if (USE_AI_PROXY) {
        const { questions } = await invokeAiProxy({ action: 'quiz', title, questionCount, pdfBase64: base64Data });
        return toQuiz(title, questions);
      }
      
      const prompt = `Analyze this PDF document and create exactly ${questionCount} multiple choice questions based on its content.

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

IMPORTANT: Generate exactly ${questionCount} questions that test understanding of the key concepts in the document.`;

      const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      
      const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'application/pdf', data: base64Data } }
            ]
          }]
        }),
      });
      
      console.log('Response status:', apiResponse.status);
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('API ERROR:', errorText);
        throw new Error(`Gemini API error: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      const aiResponse = data.candidates[0].content.parts[0].text;
      const cleanResponse = aiResponse.replace(/```json\n?|```\n?/g, '').trim();
      const parsedQuiz = JSON.parse(cleanResponse);
      
      console.log('=== PDF QUIZ GENERATION SUCCESS ===');
      return {
        title,
        questions: parsedQuiz.questions.map((q, index) => ({
          id: Date.now() + index,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          type: 'multiple-choice'
        })),
        aiGenerated: true
      };
    } catch (error) {
      console.error('=== PDF QUIZ GENERATION ERROR ===');
      console.error('Error:', error.message);
      throw error;
    }
  }
};