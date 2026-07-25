// Self-managed auth against the NestJS backend (username + password → HS256 JWT).
// The token is stored in localStorage and attached by apiClient on every request.
// Supabase Auth is no longer used.
import { apiClient } from './apiClient.js';

const TOKEN_KEY = 'dhl_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage errors */
  }
}

let cachedProfile = null;

export const AuthService = {
  // Returns a minimal session ({ user: { id } }) when a valid token exists,
  // otherwise null. Also caches the profile for getCurrentProfile().
  async initialize() {
    const token = getToken();
    if (!token) return null;
    try {
      cachedProfile = await apiClient.get('/auth/me');
      return { user: { id: cachedProfile.id } };
    } catch {
      setToken(null);
      cachedProfile = null;
      return null;
    }
  },

  async getCurrentSession() {
    const token = getToken();
    if (!token) return null;
    return { user: { id: cachedProfile?.id } };
  },

  async signInWithUsername(username, password) {
    const result = await apiClient.post('/auth/login', { username, password });
    setToken(result.token);
    cachedProfile = null;
    return result;
  },

  async register({ username, displayName, password }) {
    const result = await apiClient.post('/auth/register', {
      username,
      displayName,
      password,
    });
    setToken(result.token);
    cachedProfile = null;
    return result;
  },

  async signOut() {
    setToken(null);
    cachedProfile = null;
  },

  // eslint-disable-next-line no-unused-vars
  async getCurrentProfile(_userId) {
    if (cachedProfile) return cachedProfile;
    cachedProfile = await apiClient.get('/auth/me');
    return cachedProfile;
  },
};
