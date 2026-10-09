const NETWORK_ERROR = /network request failed|failed to fetch|network error|timeout|offline|econn|internet connection|aborted/i;
const AUTH_ERROR = /invalid refresh token|refresh token not found|refresh token|auth session missing|session expired|jwt expired|invalid jwt|invalid claim|user from sub claim/i;

function errorText(error) {
  return `${error?.name || ''} ${error?.message || ''} ${error?.code || ''}`;
}

// 'signOut' only for a definite auth failure. A network failure keeps the
// cached session so a dropped connection does not log the student out.
export function sessionCheckDecision(error) {
  if (!error) return 'continue';
  const text = errorText(error);
  if (NETWORK_ERROR.test(text)) return 'offline';
  if (AUTH_ERROR.test(text) || error.status === 401 || error.status === 403) return 'signOut';
  return 'offline';
}
