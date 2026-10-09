import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { aiService } from '../aiService';
import { limiters, RateLimitError } from '../../utils/rateLimiter';
import SearchScreen from '../../screens/SearchScreen';
import { supabase } from '../../config/supabase';

jest.mock('../../config/supabase', () => {
  const query = { select: () => query, ilike: () => Promise.resolve({ data: [] }) };
  return { supabase: { from: jest.fn(() => query) } };
});
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///docs/' }));
jest.mock('expo-sharing', () => ({}));

const okGeminiResponse = {
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
};

describe('AI endpoint rate limiting', () => {
  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue(okGeminiResponse);
    await limiters.aiChat.reset('device');
  });

  it('returns a 429 RateLimitError once a rapid loop exceeds 10 messages/minute', async () => {
    const results = [];
    for (let i = 0; i < 15; i++) {
      results.push(await aiService.chatWithAI([{ role: 'user', text: `q${i}` }]).then(() => 'ok', (e) => e));
    }

    expect(results.slice(0, 10)).toEqual(Array(10).fill('ok'));
    results.slice(10).forEach((r) => {
      expect(r).toBeInstanceOf(RateLimitError);
      expect(r.status).toBe(429);
    });
    // Blocked calls never reach the network.
    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  it('does not affect normal usage (a few messages spread out)', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(aiService.chatWithAI([{ role: 'user', text: 'hi' }])).resolves.toBe('ok');
    }
  });
});

describe('Search request debouncing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    supabase.from.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('fires one search (2 table queries) for a burst of keystrokes instead of one per keystroke', async () => {
    const { getByPlaceholderText } = render(<SearchScreen navigation={{ navigate: jest.fn() }} />);
    const input = getByPlaceholderText('Search lessons, quizzes, topics...');

    'motherboard'.split('').reduce((typed, ch) => {
      const next = typed + ch;
      fireEvent.changeText(input, next);
      act(() => { jest.advanceTimersByTime(50); });
      return next;
    }, '');
    expect(supabase.from).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(300); });
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });
});
