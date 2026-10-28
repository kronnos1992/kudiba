import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function getTokenTenantId(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.tenant_id === 'string' ? decoded.tenant_id : null;
  } catch {
    return null;
  }
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken, activeTenant, activeBranch } = useAuthStore.getState();
    const token = accessToken || localStorage.getItem('kudiba_access_token');
    const tenantId = activeTenant?.id || getTokenTenantId(token);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const requestedTenantId = config.headers.get('X-Tenant-ID');
    if (typeof requestedTenantId === 'string' && requestedTenantId) {
      if (requestedTenantId !== activeTenant?.id) {
        delete config.headers['X-Branch-ID'];
      }
    } else if (tenantId) {
      config.headers.set('X-Tenant-ID', tenantId);
    }

    if (activeBranch?.id && (!requestedTenantId || requestedTenantId === activeTenant?.id)) {
      config.headers['X-Branch-ID'] = activeBranch.id;
    }

    const correlationId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `corr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    config.headers['X-Correlation-ID'] = correlationId;

    // Idempotência transversal: toda a mutação recebe uma chave única por tentativa.
    // Chamadas que já definem a sua própria chave (ex.: reconciliação POS offline)
    // mantêm a chave estável para permitir replay seguro após timeout de rede.
    const method = (config.method || 'get').toLowerCase();
    const isMutation = method === 'post' || method === 'put' || method === 'patch' || method === 'delete';
    if (isMutation && !config.headers['Idempotency-Key']) {
      config.headers['Idempotency-Key'] =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const authStore = useAuthStore.getState();
    const refreshToken = authStore.refreshToken;

    if (!refreshToken || originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      authStore.logout(refreshToken ? 'expired' : undefined);
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;
      authStore.updateTokens(access_token, newRefreshToken || refreshToken, expires_in);

      processQueue(null, access_token);
      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return apiClient(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr as AxiosError, null);
      authStore.logout('expired');
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
