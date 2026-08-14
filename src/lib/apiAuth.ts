const API_AUTH_TOKEN = (import.meta.env.VITE_API_AUTH_TOKEN as string | undefined)?.trim() ?? '';

export function hasApiAuthToken() {
  return API_AUTH_TOKEN.length > 0;
}

export function buildApiHeaders(extra: HeadersInit = {}): HeadersInit {
  if (!API_AUTH_TOKEN) return extra;

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${API_AUTH_TOKEN}`,
    'x-api-key': API_AUTH_TOKEN,
  };

  if (extra instanceof Headers) {
    const merged = new Headers(extra);
    for (const [key, value] of Object.entries(authHeaders)) merged.set(key, value);
    return merged;
  }

  if (Array.isArray(extra)) {
    return [...extra, ...Object.entries(authHeaders)];
  }

  return {
    ...(extra as Record<string, string>),
    ...authHeaders,
  };
}
