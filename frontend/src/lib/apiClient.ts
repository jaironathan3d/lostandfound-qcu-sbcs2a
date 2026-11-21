const fallbackApiUrl = 'http://localhost:4000/api';

export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL ?? fallbackApiUrl;
const authTokenStorageKey = 'qcu-lost-and-found-token';

export const getAuthToken = (): string | null => window.localStorage.getItem(authTokenStorageKey);

export const apiRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error('Could not connect to the server. Check that the backend is running.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body
      && typeof body.message === 'string'
      ? body.message
      : 'The request could not be completed. Please try again.';
    throw new Error(message);
  }
  return body as T;
};
