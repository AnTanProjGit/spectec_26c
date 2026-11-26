/**
 * SpecialTech AI ERP — REST API Client for FastAPI + PostgreSQL 17 backend (/api/v1/*)
 * Keeps JWT tokens strictly in module memory (never localStorage/sessionStorage).
 */

export type ApiMode = 'local' | 'fastapi';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    branchId?: string | null;
  };
}

let inMemorySession: AuthSession | null = null;

export function getApiMode(): ApiMode {
  const mode = (import.meta as any).env?.VITE_API_MODE;
  return mode === 'fastapi' ? 'fastapi' : 'local';
}

export function getApiBaseUrl(): string {
  const base = ((import.meta as any).env?.VITE_FASTAPI_BASE_URL || '/api/v1').trim();
  return base.replace(/\/+$/, '');
}

export function setAuthSession(session: AuthSession | null): void {
  inMemorySession = session;
}

export function getAuthSession(): AuthSession | null {
  return inMemorySession;
}

export async function apiRequest<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    rawResponse?: boolean;
  } = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  if (inMemorySession?.accessToken) {
    headers.Authorization = `Bearer ${inMemorySession.accessToken}`;
  }

  let fetchBody: BodyInit | undefined;
  if (options.body instanceof FormData) {
    fetchBody = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: fetchBody,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errData = await res.json();
      message = errData?.detail || errData?.error || message;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(message);
  }

  if (options.rawResponse) {
    return (await res.blob()) as unknown as T;
  }
  return (await res.json()) as T;
}

export const fastApiClient = {
  health: () => apiRequest<{ status: string; database: string; version: string }>('/health'),

  login: async (username: string, password: string) => {
    const data = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: AuthSession['user'];
    }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setAuthSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
    return data;
  },

  logout: () => {
    setAuthSession(null);
  },

  bootstrapWorkspace: (branchId?: string) =>
    apiRequest(`/workspace/bootstrap${branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ''}`),

  setActiveBranch: (branchId: string) =>
    apiRequest('/workspace/active-branch', { method: 'PUT', body: { branchId } }),

  listBranches: () => apiRequest('/branches'),
  updateBranch: (branchId: string, payload: unknown) =>
    apiRequest(`/branches/${encodeURIComponent(branchId)}`, { method: 'PATCH', body: payload }),

  submitShift: (payload: unknown) =>
    apiRequest('/timesheets/shifts/submit', { method: 'POST', body: payload }),
  approveShift: (shiftId: string) =>
    apiRequest(`/timesheets/shifts/${encodeURIComponent(shiftId)}/approve`, { method: 'POST' }),
  moderateShift: (shiftId: string, payload: unknown) =>
    apiRequest(`/timesheets/shifts/${encodeURIComponent(shiftId)}/moderate`, { method: 'PATCH', body: payload }),

  createDeal: (payload: unknown) => apiRequest('/crm/deals', { method: 'POST', body: payload }),
  moveDealStage: (dealId: string, stage: string) =>
    apiRequest(`/crm/deals/${encodeURIComponent(dealId)}/stage`, { method: 'PATCH', body: { stage } }),
  closeDealShift: (dealId: string, payload: unknown) =>
    apiRequest(`/crm/deals/${encodeURIComponent(dealId)}/close-shift`, { method: 'POST', body: payload }),
  closeDealVolume: (dealId: string, volumeHours: number) =>
    apiRequest(`/crm/deals/${encodeURIComponent(dealId)}/close-volume`, {
      method: 'POST',
      body: { volumeHours },
    }),

  submitDriverCardExpense: (payload: unknown) =>
    apiRequest('/driver-bot/card-expenses', { method: 'POST', body: payload }),
  getDriverReconciliation: (driverId: string, month?: string) =>
    apiRequest(
      `/driver-bot/monthly-reconciliation/${encodeURIComponent(driverId)}${
        month ? `?month=${encodeURIComponent(month)}` : ''
      }`,
    ),

  exportBranchExcel: (scope: string, branchId: string) =>
    apiRequest<Blob>(
      `/exchange/excel/export?scope=${encodeURIComponent(scope)}&branch_id=${encodeURIComponent(branchId)}`,
      { rawResponse: true },
    ),
};
