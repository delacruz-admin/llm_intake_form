/**
 * Cognito Hosted UI auth helper.
 * Stores ID token in sessionStorage, redirects to Cognito login when missing/expired.
 *
 * Configure these values from your SAM stack outputs.
 */

const CONFIG = {
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN || '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/callback',
  logoutUri: import.meta.env.VITE_LOGOUT_URI || 'http://localhost:5173',
};

const TOKEN_KEY = 'arb_id_token';

/** Get the stored ID token, or null if missing/expired. */
export function getToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

/** Get user info from the ID token. */
export function getUser() {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const groups = payload['cognito:groups'] || [];
    return {
      email: payload.email || '',
      name: payload.name || payload.email || '',
      sub: payload.sub,
      groups,
      isReviewer: groups.includes('arb-reviewers'),
    };
  } catch {
    return null;
  }
}

/** Redirect to Cognito Hosted UI for login. */
export function login() {
  const url =
    `${CONFIG.cognitoDomain}/login?` +
    `client_id=${CONFIG.clientId}` +
    `&response_type=token` +
    `&scope=openid+email+profile` +
    `&redirect_uri=${encodeURIComponent(CONFIG.redirectUri)}`;
  window.location.href = url;
}

/** Clear token and redirect to Cognito logout. */
export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  const url =
    `${CONFIG.cognitoDomain}/logout?` +
    `client_id=${CONFIG.clientId}` +
    `&logout_uri=${encodeURIComponent(CONFIG.logoutUri)}`;
  window.location.href = url;
}

/** Handle the OAuth callback — extract token from URL hash. */
export function handleCallback() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const idToken = params.get('id_token');

  if (idToken) {
    sessionStorage.setItem(TOKEN_KEY, idToken);
    window.history.replaceState(null, '', '/');
    return true;
  }
  return false;
}

/** Require auth — redirect to login if no valid token. */
export function requireAuth() {
  const token = getToken();
  if (!token) {
    login();
    return false;
  }
  return true;
}
