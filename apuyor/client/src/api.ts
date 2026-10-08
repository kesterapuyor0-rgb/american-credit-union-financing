import type { LikenessProfile, PendingUser, User, VerifiedConsent } from './types';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

type AuthResult = { token: string; user: User };

function getStoredToken(): string | undefined {
  if (typeof localStorage === 'undefined') return undefined;

  const legacyToken = localStorage.getItem('token')?.trim();
  try {
    const rawSession = localStorage.getItem('apuyor-session');
    const session: unknown = rawSession ? JSON.parse(rawSession) : null;
    if (session && typeof session === 'object' && 'token' in session) {
      const sessionToken = (session as { token?: unknown }).token;
      if (typeof sessionToken === 'string' && sessionToken.trim()) return sessionToken.trim();
    }
  } catch {
    // Ignore malformed session data and try the legacy token key.
  }
  return legacyToken || undefined;
}

async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const authToken = token?.trim() || getStoredToken();
  if (authToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${authToken}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.detail || 'Request failed. Please try again.');
  return payload as T;
}

export const api = {
  login: (login: string, password: string) => request<AuthResult>('/api/auth/login', undefined, { method: 'POST', body: JSON.stringify({ login, password }) }),
  register: (username: string, email: string, password: string) => request<{ message: string }>('/api/auth/register', undefined, { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  pendingUsers: (token: string) => request<{ users: PendingUser[] }>('/api/admin/users/pending', token),
  reviewUser: (token: string, id: string, decision: 'approve' | 'reject') => request(`/api/admin/users/${id}/review`, token, { method: 'PATCH', body: JSON.stringify({ decision }) }),
  pendingLikeness: (token: string) => request<{ profiles: LikenessProfile[] }>('/api/admin/likeness/pending', token),
  updateLikeness: (token: string, id: string, changes: Partial<Pick<LikenessProfile, 'status' | 'forcedLabelState'>>) => request(`/api/admin/likeness/${id}`, token, { method: 'PUT', body: JSON.stringify(changes) }),
  myLikeness: (token: string) => request<{ profiles: LikenessProfile[] }>('/api/likeness/mine', token),
  verifiedConsents: (token: string) => request<{ consents: VerifiedConsent[] }>('/api/likeness/consents', token),
  uploadLikeness: (token: string, file: File, consentRecordId: string) => {
    const body = new FormData();
    body.append('file', file);
    body.append('consentRecordId', consentRecordId);
    return request<{ profile: LikenessProfile; message: string }>('/api/likeness/upload', token, { method: 'POST', body });
  },
};
