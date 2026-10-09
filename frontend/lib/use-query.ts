"use client"

import { useCallback, useEffect, useState } from "react"

import { apiGet } from "@/lib/api"

// Tiny cached GET hook for the lazy listing sections. Requests are cached by path for the
// lifetime of the tab (so reopening a section or revisiting a listing doesn't refetch) and
// a failed request is evicted so "Try again" really retries.
const cache = new Map<string, Promise<unknown>>()

type State<T> = { path: string; attempt: number; status: "ok"; data: T } | { path: string; attempt: number; status: "error" }

// `fresh`: never cached, refetched every time the component mounts. Used for private data
// (trips), which must not be shared between accounts or shown stale after a new booking.
export function useQuery<T>(path: string | null, { fresh = false }: { fresh?: boolean } = {}) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<State<T>>()

  useEffect(() => {
    if (!path) return
    let cancelled = false
    let request = fresh ? undefined : (cache.get(path) as Promise<T> | undefined)
    if (!request) {
      request = apiGet<T>(path).then((data) => {
        if (data === null) throw new Error("request failed")
        return data
      })
      if (!fresh) cache.set(path, request)
    }
    request
      .then((data) => !cancelled && setState({ path, attempt, status: "ok", data }))
      .catch(() => {
        cache.delete(path)
        if (!cancelled) setState({ path, attempt, status: "error" })
      })
    return () => {
      cancelled = true
    }
  }, [path, attempt, fresh])

  // A result only counts for the path and attempt it was made for; otherwise we're loading.
  const current = state && state.path === path && state.attempt === attempt ? state : undefined
  const retry = useCallback(() => {
    if (path) cache.delete(path)
    setAttempt((a) => a + 1)
  }, [path])

  return {
    data: current?.status === "ok" ? current.data : undefined,
    error: current?.status === "error",
    loading: !!path && !current,
    retry,
  }
}
