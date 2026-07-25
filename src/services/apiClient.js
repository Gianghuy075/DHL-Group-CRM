// Thin fetch wrapper around the NestJS backend.
// Base URL comes from window.DHL_CONFIG.apiBaseUrl (config.local.js).
import { getSupabaseClient } from '../supabase/client.js';

function getApiBaseUrl() {
  const base = window.DHL_CONFIG?.apiBaseUrl || '';
  return base.replace(/\/$/, '');
}

// The BE verifies the Supabase access token; attach it on every request.
async function getAccessToken() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

function buildQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    usp.append(key, String(value));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

async function request(method, path, { params, body } = {}) {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('apiBaseUrl chưa được cấu hình. Kiểm tra config.local.js.');
  }

  const url = `${base}${path}${buildQuery(params)}`;

  const headers = { 'Content-Type': 'application/json' };
  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new Error(`Không kết nối được tới API (${base}). ${networkError.message}`);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const raw = payload?.message ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(Array.isArray(raw) ? raw.join(', ') : String(raw));
  }

  return payload;
}

export const apiClient = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
};
