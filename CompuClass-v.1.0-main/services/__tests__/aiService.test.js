import { supabase } from '../../config/supabase';
import { aiService } from '../aiService';

jest.mock('../../config/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

describe('aiService.chatWithAI', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    supabase.functions.invoke.mockReset();
  });

  it('returns the assistant reply from the gemini-proxy function and never calls Gemini', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { text: 'RAM is short-term memory.' }, error: null });

    const reply = await aiService.chatWithAI([{ role: 'user', text: 'What is RAM?' }]);

    expect(reply).toBe('RAM is short-term memory.');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('gemini-proxy', {
      body: { action: 'chat', messages: [{ role: 'user', text: 'What is RAM?' }] },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when the Edge Function returns an error', async () => {
    const failure = new Error('The AI service is unavailable right now. Please try again later.');
    supabase.functions.invoke.mockResolvedValue({ data: null, error: failure });

    await expect(aiService.chatWithAI([{ role: 'user', text: 'Hi' }])).rejects.toBe(failure);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('aiService.generateQuizFromText', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    supabase.functions.invoke.mockReset();
  });

  it('maps the Edge Function quiz payload into question objects', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        questions: [
          { question: 'What does CPU stand for?', options: ['A', 'B', 'C', 'D'], correctAnswer: 1 },
        ],
      },
      error: null,
    });

    const quiz = await aiService.generateQuizFromText('CPU lesson content', 'CPU Basics', 1);

    expect(supabase.functions.invoke).toHaveBeenCalledWith('gemini-proxy', {
      body: { action: 'quiz', title: 'CPU Basics', questionCount: 1, text: 'CPU lesson content' },
    });
    expect(quiz.title).toBe('CPU Basics');
    expect(quiz.aiGenerated).toBe(true);
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0]).toMatchObject({
      question: 'What does CPU stand for?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 1,
      type: 'multiple-choice',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when the Edge Function returns an error', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: new Error('Gemini returned no text') });

    await expect(aiService.generateQuizFromText('notes', 'Notes', 1)).rejects.toThrow('Gemini returned no text');
  });
});
