// Proxy mode (EXPO_PUBLIC_USE_AI_PROXY=true): requests go to the gemini-proxy
// Edge Function and the Gemini key is never used by the app.

const loadProxyModeService = () => {
  process.env.EXPO_PUBLIC_USE_AI_PROXY = 'true';
  let mod;
  jest.isolateModules(() => {
    jest.doMock('../../config/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
    mod = { ...require('../aiService'), supabase: require('../../config/supabase').supabase, limiters: require('../../utils/rateLimiter').limiters };
  });
  return mod;
};

describe('aiService in proxy mode', () => {
  let aiService, supabase, limiters;

  beforeEach(async () => {
    ({ aiService, supabase, limiters } = loadProxyModeService());
    global.fetch = jest.fn();
    await limiters.aiChat.reset('device');
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_USE_AI_PROXY;
  });

  it('sends chat through the Edge Function and never calls Gemini directly', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { text: 'A CPU is the processor.' }, error: null });

    const reply = await aiService.chatWithAI([{ role: 'user', text: 'What is a CPU?' }]);

    expect(reply).toBe('A CPU is the processor.');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('gemini-proxy', {
      body: { action: 'chat', messages: [{ role: 'user', text: 'What is a CPU?' }] },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps a quiz response from the Edge Function to the app quiz format', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { questions: [{ question: 'Q?', options: ['A', 'B'], correctAnswer: 1 }] },
      error: null,
    });

    const quiz = await aiService.generateQuizFromText('some notes', 'Notes quiz', 3);

    expect(supabase.functions.invoke.mock.calls[0][1].body).toEqual({ action: 'quiz', title: 'Notes quiz', questionCount: 3, text: 'some notes' });
    expect(quiz).toMatchObject({ title: 'Notes quiz', aiGenerated: true, questions: [{ question: 'Q?', options: ['A', 'B'], correctAnswer: 1, type: 'multiple-choice' }] });
  });

  it('turns a server 429 into a friendly RateLimitError', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: { status: 429 } } });
    await expect(aiService.chatWithAI([{ role: 'user', text: 'hi' }])).rejects.toMatchObject({ status: 429, userMessage: expect.stringMatching(/busy/) });
  });
});
