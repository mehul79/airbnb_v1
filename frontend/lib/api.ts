// Thin fetch wrapper for the same-origin /api/v1 relay. Errors follow the backend's
// envelope: {"error": {"code", "message", "fields", "request_id"}}.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
    // Any other keys the API put in the error, e.g. the fresh `quote` on PRICE_CHANGED.
    public extra: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

async function send<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the server. Check your connection and try again.")
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const { code, message, fields, ...rest } = data?.error ?? {}
    delete rest.request_id
    throw new ApiError(res.status, code ?? "UNKNOWN", message ?? "Something went wrong.", fields, rest)
  }
  return data as T
}

export const apiPost = <T>(path: string, body: unknown, headers?: Record<string, string>) =>
  send<T>("POST", path, body, headers)
export const apiPut = <T>(path: string, body?: unknown) => send<T>("PUT", path, body)
export const apiDelete = <T>(path: string) => send<T>("DELETE", path)
export const apiPatch = <T>(path: string, body: unknown) => send<T>("PATCH", path, body)

export async function apiGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`/api/v1${path}`).catch(() => null)
  return res?.ok ? ((await res.json()) as T) : null
}
