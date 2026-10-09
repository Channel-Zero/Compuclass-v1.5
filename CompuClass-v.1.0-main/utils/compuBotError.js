import { RateLimitError } from './rateLimiter';

export const COMPUBOT_MAX_CHARS = 500;

export function compuBotErrorMessage(error) {
  if (error instanceof RateLimitError) return error.userMessage;
  const text = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  const status = error?.context?.status || error?.status;
  if (status === 429) return 'The AI assistant is busy right now. Please wait a moment and try again.';
  if (/network request failed|failed to fetch|failed to send a request|offline|timeout|network error/.test(text)) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  if (/proxy|unavailable|relay|functionshttperror|non-2xx|edge function/.test(text) || (status >= 500 && status <= 599)) {
    return 'CompuBot is unavailable right now. Please try again in a moment.';
  }
  return 'Sorry, I ran into an issue. Please try again.';
}
