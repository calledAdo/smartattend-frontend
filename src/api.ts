export const API_ORIGIN = 'https://real-time-attendance-auth-service.onrender.com'
const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '').replace(/\/api$/, '')
const baseUrl = configured ?? (import.meta.env.DEV ? '' : API_ORIGIN)
const TOKEN_KEY = 'smartattend-live-token'

export function getApiToken() { return sessionStorage.getItem(TOKEN_KEY) }
export function setApiToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

function endpoint(path: string) { return `${baseUrl}${path}` }

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const token = getApiToken()
  const form = body instanceof FormData
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(endpoint(path), {
      method,
      headers,
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
      cache: 'no-store',
    })
  } catch (issue) {
    if ((issue as Error).name === 'TimeoutError') throw new Error('The attendance service did not respond. It may still be starting; try again shortly.')
    throw new Error('Cannot reach the attendance service. Check your connection and try again.')
  }
  if (!response.ok) {
    const raw = await response.text()
    let payload: { code?: string; message?: string } | null = null
    try { payload = JSON.parse(raw) } catch { /* Legacy service returns plain-text errors. */ }
    const message = payload?.message || raw || `Request failed (${response.status}).`
    throw new Error(message)
  }
  return response
}

export async function apiJson<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await send(method, path, body)
  const raw = await response.text()
  if (!raw) return {} as T
  try { return JSON.parse(raw) as T }
  catch { throw new Error('The attendance service returned an unexpected response format.') }
}

export async function apiText(method: string, path: string, body?: unknown): Promise<string> {
  const response = await send(method, path, body)
  return response.text()
}

export async function apiBlob(method: string, path: string): Promise<Blob> {
  const response = await send(method, path)
  return response.blob()
}
