import * as FileSystem from 'expo-file-system';

// Google Gemini API configuration (FREE)
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

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
        const content = await FileSystem.readAsStringAsync(file.uri);
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

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
    // For PDFs, send directly to Gemini
    if (file.mimeType === 'application/pdf') {
      return await this.generateQuizFromPDF(file, title, questionCount);
    }
    const text = await this.extractTextFromFile(file);
    return await this.generateQuizFromText(text, title, questionCount);
  },

  async generateQuizFromPDF(file, title, questionCount = 5) {
    try {
      console.log('=== PDF QUIZ GENERATION START ===');
      
      // Read PDF as base64
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      const base64Data = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      console.log('PDF converted to base64, length:', base64Data.length);
      
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

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      
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