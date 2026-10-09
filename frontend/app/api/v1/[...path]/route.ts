import type { NextRequest } from "next/server"

// Same-origin relay to FastAPI (see CLAUDE.md). No logic here: it forwards the request
// and hands back the response, including Set-Cookie, so the browser never needs CORS.
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000"
const FORWARDED_REQUEST_HEADERS = ["cookie", "origin", "idempotency-key", "content-type"]

async function relay(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const upstream = await fetch(`${API_BASE_URL}/api/v1/${path.join("/")}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  })

  const responseHeaders = new Headers()
  const contentType = upstream.headers.get("content-type")
  if (contentType) responseHeaders.set("content-type", contentType)
  const requestId = upstream.headers.get("x-request-id")
  if (requestId) responseHeaders.set("x-request-id", requestId)
  for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie)

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export { relay as GET, relay as POST, relay as PUT, relay as PATCH, relay as DELETE }
