// src/utils/api.ts
//
// Drop-in fetch wrapper for CircuitVerse.
//
// Web:   fetch('/api/v1/...') — relative URL, cookies handled by browser
// Tauri: fetch('https://circuitverse.org/api/v1/...') — absolute URL,
//        auth token injected from localStorage
//
// No Rust command. No invoke(). No IPC.
// Tauri WebView handles CORS via capabilities/default.json allowlist.

export function isTauri(): boolean {
    return (
        typeof window !== 'undefined' &&
        !!(window as any).__TAURI_INTERNALS__
    )
}

const CV_PRODUCTION_URL = 'https://circuitverse.org'

export function getApiBaseUrl(): string {
    return isTauri() ? CV_PRODUCTION_URL : ''
}

/*Resolve a path to a full URL.
 If path is already absolute (starts with http), pass through unchanged.
 This handles imgur calls correctly ie. they must not get circuitverse.org prepended.
 */
export function apiUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path
    }
    return `${getApiBaseUrl()}${path}`
}

 // Get auth token.
 // Tauri reads from localStorage (cv_token)
 // Web reads from localStorage first, falls back to cvt cookie

export function getAuthToken(): string | undefined {
    try {
        const stored = localStorage.getItem('cv_token')
        if (stored) return stored
    } catch {
        // localStorage unavailable
    }

    if (!isTauri()) {
        const match = document.cookie.match(/(^| )cvt=([^;]+)/)
        if (match) return match[2]
    }

    return undefined
}

export function authHeaders(): Record<string, string> {
    const token = getAuthToken()
    return token ? { Authorization: `Token ${token}` } : {}
}

/*
 * apiFetch: we use this everywhere instead of fetch(). It handles:
 -> URL resolution (relative on web, absolute on Tauri)
 -> Auth token injection in Tauri
 -> Absolute URL passthrough (imgur, external APIs)
 */
export async function apiFetch(
    input: string,
    init?: RequestInit
): Promise<Response> {
    const url = apiUrl(input)

    const headers = new Headers(init?.headers)

    // In Tauri, cookies do not carry to circuitverse.org
    // Inject the stored token automatically
    if (isTauri()) {
        const token = getAuthToken()
        if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Token ${token}`)
        }
    }

    return fetch(url, { ...init, headers })
}