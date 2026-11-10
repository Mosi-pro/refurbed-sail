/** Thin fetch wrapper: JSON handling, CSRF header, typed errors. */
export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|; )rs_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

type Params = Record<string, string | number | boolean | null | undefined>;

export function qs(params?: Params): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (method !== "GET") {
    if (!csrfToken()) await fetch("/api/health", { credentials: "same-origin" });
    headers["X-CSRF-Token"] = csrfToken();
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Der Server ist nicht erreichbar. Bitte prüfe deine Verbindung und versuche es erneut.");
  }
  if (res.status === 403 && retry && method !== "GET" && !csrfToken()) return request<T>(method, path, body, false);
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail
      : res.status >= 500 ? "Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es später erneut."
      : "Die Anfrage konnte nicht verarbeitet werden.";
    throw new ApiError(res.status, detail, data?.fields);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>("GET", path + qs(params)),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
};

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Es ist ein unerwarteter Fehler aufgetreten.";
