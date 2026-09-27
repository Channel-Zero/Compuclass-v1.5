import { aiService } from '../aiService';

describe('aiService.chatWithAI', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the assistant reply text from a successful Gemini response', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'RAM is short-term memory.' }] } }],
      }),
    });

    const reply = await aiService.chatWithAI([{ role: 'user', text: 'What is RAM?' }]);

    expect(reply).toBe('RAM is short-term memory.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(JSON.parse(options.body).contents.at(-1)).toEqual({
      role: 'user',
      parts: [{ text: 'What is RAM?' }],
    });
  });

  it('throws with the API status and body when Gemini responds with an error', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    await expect(aiService.chatWithAI([{ role: 'user', text: 'Hi' }])).rejects.toThrow(
      'Gemini API error: 429 - Rate limit exceeded'
    );
  });
});

describe('aiService.generateQuizFromText', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('parses the JSON quiz payload returned by Gemini into question objects', async () => {
    const quizJson = JSON.stringify({
      questions: [
        { question: 'What does CPU stand for?', options: ['A', 'B', 'C', 'D'], correctAnswer: 1 },
      ],
    });
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '```json\n' + quizJson + '\n```' }] } }],
      }),
    });

    const quiz = await aiService.generateQuizFromText('CPU lesson content', 'CPU Basics', 1);

    expect(quiz.title).toBe('CPU Basics');
    expect(quiz.aiGenerated).toBe(true);
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0]).toMatchObject({
      question: 'What does CPU stand for?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 1,
      type: 'multiple-choice',
    });
  });

  it('throws when Gemini returns no candidates', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });

    await expect(aiService.generateQuizFromText('text', 'Title', 3)).rejects.toThrow(
      'No response from Gemini API'
    );
  });
});
