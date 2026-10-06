import { supabase } from '../../config/supabase';
import { aiService } from '../aiService';

jest.mock('../../config/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('aiService.chatWithAI', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the assistant reply from the edge function', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { text: 'RAM is short-term memory.' },
      error: null,
    });

    const reply = await aiService.chatWithAI([{ role: 'user', text: 'What is RAM?' }]);

    expect(reply).toBe('RAM is short-term memory.');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('gemini', {
      body: { action: 'chat', messages: [{ role: 'user', text: 'What is RAM?' }] },
    });
  });

  it('throws the function error message when the edge function fails', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Gemini request failed' },
    });

    await expect(aiService.chatWithAI([{ role: 'user', text: 'Hi' }])).rejects.toThrow(
      'Gemini request failed'
    );
  });
});

describe('aiService.generateQuizFromText', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the quiz payload produced by the edge function', async () => {
    const quiz = {
      title: 'CPU Basics',
      aiGenerated: true,
      questions: [
        { question: 'What does CPU stand for?', options: ['A', 'B', 'C', 'D'], correctAnswer: 1 },
      ],
    };
    supabase.functions.invoke.mockResolvedValue({ data: quiz, error: null });

    const result = await aiService.generateQuizFromText('CPU lesson content', 'CPU Basics', 1);

    expect(result).toEqual(quiz);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('gemini', {
      body: {
        action: 'quiz',
        text: 'CPU lesson content',
        title: 'CPU Basics',
        questionCount: 1,
      },
    });
  });

  it('throws when the edge function returns an error payload', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { error: 'No response from Gemini API' },
      error: null,
    });

    await expect(aiService.generateQuizFromText('text', 'Title', 3)).rejects.toThrow(
      'No response from Gemini API'
    );
  });
});
