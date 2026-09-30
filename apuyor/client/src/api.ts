import type { LikenessProfile, PendingUser, User } from './types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type AuthResult = { token: string; user: User };
async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
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
};
