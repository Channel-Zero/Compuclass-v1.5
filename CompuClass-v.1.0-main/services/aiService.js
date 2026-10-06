import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../config/supabase';

const MAX_PDF_BYTES = 8 * 1024 * 1024;

async function invokeGemini(body) {
  const { data, error } = await supabase.functions.invoke('gemini', { body });
  if (error) {
    let message = error.message || 'Gemini request failed';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const payload = await error.context.json();
        if (payload?.error) message = payload.error;
      }
    } catch {
      // The function response was not JSON; keep the client error message.
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const aiService = {
  async extractTextFromFile(file) {
    try {
      const content = await FileSystem.readAsStringAsync(file.uri);
      return content;
    } catch (readError) {
      return `Generate educational quiz questions about: ${file.name.replace(/\.[^/.]+$/, '')}`;
    }
  },

  async generateQuizFromText(text, title, questionCount = 5) {
    return invokeGemini({ action: 'quiz', text, title, questionCount });
  },

  async generateQuizFromFile(file, title, questionCount = 5) {
    if (file.mimeType === 'application/pdf') {
      return this.generateQuizFromPDF(file, title, questionCount);
    }
    const text = await this.extractTextFromFile(file);
    return this.generateQuizFromText(text, title, questionCount);
  },

  async chatWithAI(messages) {
    const data = await invokeGemini({ action: 'chat', messages });
    if (!data?.text) throw new Error('No response from Gemini API');
    return data.text;
  },

  async generateQuizFromPDF(file, title, questionCount = 5) {
    if (file.size && file.size > MAX_PDF_BYTES) {
      throw new Error('PDF must be 8 MB or smaller');
    }
    const base64Data = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return invokeGemini({
      action: 'quiz',
      pdfBase64: base64Data,
      title,
      questionCount,
    });
  },
};
