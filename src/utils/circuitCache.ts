// src/utils/circuitCache.ts [Offline-first circuit cache for CircuitVerse Desktop (Tauri)]
// -> Fetch user circuits from circuitverse.org and cache locally
// -> Track local edits with timestamps
// -> Detect conflicts (local newer than server OR server newer than local)
//  -> Push local changes to server
// -> Work entirely offline if no network available
// Storage layout in localStorage is as follows:-
//cv_cache_index  is for JSON array of CachedCircuit metadata
//cv_cache_data_{id} is for JSON string of full circuit data per project
//cv_cache_synced_at is for ISO timestamp of last successful sync

import { apiFetch, getAuthToken, isTauri } from './api'

//Types 

export interface CachedCircuit {
    id: number
    name: string
    updatedAt: string        // ISO — server's last_updated value
    localUpdatedAt?: string  // ISO — when we last edited locally
    isDirty: boolean         // true = has local changes not pushed to server
    hasConflict: boolean     // true = both local and server changed since last sync
}

export interface CircuitData {
    id: number
    name: string
    data: any               // full circuit JSON
    updatedAt: string
}

export type SyncStatus =
    | 'idle'
    | 'syncing'
    | 'conflict'
    | 'error'
    | 'offline'
    | 'success'

// Storage keys 

const KEY_INDEX     = 'cv_cache_index'
const KEY_SYNCED_AT = 'cv_cache_synced_at'
const dataKey = (id: number) => `cv_cache_data_${id}`

//Index helpers

export function getCachedIndex(): CachedCircuit[] {
    try {
        const raw = localStorage.getItem(KEY_INDEX)
        if (!raw) return []
        return JSON.parse(raw) as CachedCircuit[]
    } catch {
        return []
    }
}

function saveIndex(index: CachedCircuit[]): void {
    try {
        localStorage.setItem(KEY_INDEX, JSON.stringify(index))
    } catch (err) {
        console.error('[circuitCache] Failed to save index:', err)
    }
}

export function getLastSyncedAt(): string | null {
    return localStorage.getItem(KEY_SYNCED_AT)
}

function setLastSyncedAt(): void {
    localStorage.setItem(KEY_SYNCED_AT, new Date().toISOString())
}

// Circuit data helpers 

export function getCachedCircuitData(id: number): any | null {
    try {
        const raw = localStorage.getItem(dataKey(id))
        if (!raw) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

function saveCircuitData(id: number, data: any): void {
    try {
        localStorage.setItem(dataKey(id), JSON.stringify(data))
    } catch (err) {
        console.error(`[circuitCache] Failed to save circuit ${id}:`, err)
    }
}

function removeCircuitData(id: number): void {
    try {
        localStorage.removeItem(dataKey(id))
    } catch {}
}

 //Fetch the list of user's projects from circuitverse.org-> Returns null if network unavailable or not authenticated.
async function fetchProjectList(): Promise<any[] | null> {
    try {
        const token = getAuthToken()
        if (!token) return null

        const response = await apiFetch('/api/v1/projects?filter=owned', {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Token ${token}`,
            },
        })

        if (!response.ok) {
            console.warn('[circuitCache] fetchProjectList failed:', response.status)
            return null
        }

        const json = await response.json()
        // API returns 
        return json.data ?? []
    } catch (err) {
        console.warn('[circuitCache] fetchProjectList network error:', err)
        return null
    }
}

 //Fetch full circuit data for a single project.Returns null if unavailable.

async function fetchCircuitData(projectId: number): Promise<any | null> {
    try {
        const token = getAuthToken()
        if (!token) return null

        const response = await apiFetch(
            `/api/v1/projects/${projectId}/circuit_data`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Token ${token}`,
                },
            }
        )

        if (!response.ok) return null

        return await response.json()
    } catch (err) {
        console.warn(`[circuitCache] fetchCircuitData(${projectId}) failed:`, err)
        return null
    }
}

// Core sync logic

/**
 * Pull latest project list from server and update cache index.
 * Does NOT overwrite dirty (locally edited) circuits.
 * Detects conflicts when both local and server have changed.
 *
 * @returns SyncStatus
 */
export async function syncFromServer(): Promise<SyncStatus> {
    if (!getAuthToken()) return 'offline'

    const serverProjects = await fetchProjectList()
    if (serverProjects === null) return 'offline'

    const index = getCachedIndex()
    const indexMap = new Map(index.map((c) => [c.id, c]))

    let hasConflict = false

    for (const project of serverProjects) {
        const id: number = parseInt(project.id)
        const name: string = project.attributes?.name ?? 'Untitled'
        const serverUpdatedAt: string = project.attributes?.updated_at ?? new Date().toISOString()

        const existing = indexMap.get(id)

        if (!existing) {
            // New project from server — add to index, fetch data
            const circuitData = await fetchCircuitData(id)
            if (circuitData) {
                saveCircuitData(id, circuitData)
            }
            indexMap.set(id, {
                id,
                name,
                updatedAt: serverUpdatedAt,
                isDirty: false,
                hasConflict: false,
            })
        } else if (existing.isDirty) {
            // Local edits exist — check for conflict
            const serverTime = new Date(serverUpdatedAt).getTime()
            const lastSync   = getLastSyncedAt()
                ? new Date(getLastSyncedAt()!).getTime()
                : 0

            if (serverTime > lastSync) {
                // Server also changed since last sync(conflict)
                existing.hasConflict = true
                existing.updatedAt   = serverUpdatedAt
                hasConflict          = true
                console.warn(`[circuitCache] Conflict detected for project ${id} (${name})`)
            }
            // If server has not changed, local wins 
        } else {
            // Clean local copy, update from server if server is newer..
            const serverTime = new Date(serverUpdatedAt).getTime()
            const localTime  = new Date(existing.updatedAt).getTime()

            if (serverTime > localTime) {
                const circuitData = await fetchCircuitData(id)
                if (circuitData) {
                    saveCircuitData(id, circuitData)
                    existing.updatedAt = serverUpdatedAt
                    existing.name      = name
                }
            }
        }
    }

    saveIndex(Array.from(indexMap.values()))
    setLastSyncedAt()

    return hasConflict ? 'conflict' : 'success'
}

/**
 * Push a locally edited circuit to the server.Clears dirty flag and conflict flag on success.
 * @param projectId  The project to push
 * @param imageData  Base64 JPEG for project thumbnail (optional)
 * @returns true on success
 */
export async function pushToServer(
    projectId: number,
    imageData?: string
): Promise<boolean> {
    const token = getAuthToken()
    if (!token) return false

    const localData = getCachedCircuitData(projectId)
    if (!localData) {
        console.error(`[circuitCache] No local data for project ${projectId}`)
        return false
    }

    const index   = getCachedIndex()
    const entry   = index.find((c) => c.id === projectId)
    const name    = entry?.name ?? localData.name ?? 'Untitled'

    try {
        const response = await apiFetch('/api/v1/projects/update_circuit', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Token ${token}`,
            },
            body: JSON.stringify({
                id:    projectId,
                data:  localData,
                name,
                ...(imageData ? { image: imageData } : {}),
            }),
        })

        if (!response.ok) {
            console.error(`[circuitCache] pushToServer failed: ${response.status}`)
            return false
        }

        // Clear dirty and conflict flags
        const updatedIndex = index.map((c) => {
            if (c.id !== projectId) return c
            return {
                ...c,
                isDirty:      false,
                hasConflict:  false,
                updatedAt:    new Date().toISOString(),
                localUpdatedAt: undefined,
            }
        })
        saveIndex(updatedIndex)
        setLastSyncedAt()

        console.log(`[circuitCache] Pushed project ${projectId} to server`)
        return true

    } catch (err) {
        console.error(`[circuitCache] pushToServer error:`, err)
        return false
    }
}

/**
 * Mark a circuit as locally edited.
 * Call this whenever the user saves a circuit in the desktop app.
 * @param projectId  The project that was edited
 * @param data       The full circuit JSON to cache locally
 */
export function markDirty(projectId: number, data: any): void {
    saveCircuitData(projectId, data)

    const index = getCachedIndex()
    const exists = index.find((c) => c.id === projectId)

    if (exists) {
        const updated = index.map((c) => {
            if (c.id !== projectId) return c
            return {
                ...c,
                isDirty:       true,
                localUpdatedAt: new Date().toISOString(),
            }
        })
        saveIndex(updated)
    } else {
        // Project not in index yet — add it
        index.push({
            id:            projectId,
            name:          data.name ?? 'Untitled',
            updatedAt:     new Date().toISOString(),
            localUpdatedAt: new Date().toISOString(),
            isDirty:       true,
            hasConflict:   false,
        })
        saveIndex(index)
    }

    console.log(`[circuitCache] Marked project ${projectId} as dirty`)
}

/**
 * Resolve a conflict by choosing which version wins.
 * @param projectId   The conflicted project
 * @param resolution  'local' = keep local, push to server
 *                    'server' = discard local, pull from server
 */
export async function resolveConflict(
    projectId: number,
    resolution: 'local' | 'server'
): Promise<boolean> {
    const index = getCachedIndex()
    const entry = index.find((c) => c.id === projectId)

    if (!entry) {
        console.error(`[circuitCache] resolveConflict: project ${projectId} not in index`)
        return false
    }

    if (resolution === 'local') {
        // Push local version to server — local wins
        console.log(`[circuitCache] Conflict resolved: local wins for ${projectId}`)
        return await pushToServer(projectId)

    } else {
        // Pull server version — server wins
        const serverData = await fetchCircuitData(projectId)
        if (!serverData) {
            console.error(`[circuitCache] Could not fetch server data for ${projectId}`)
            return false
        }

        saveCircuitData(projectId, serverData)

        const updatedIndex = index.map((c) => {
            if (c.id !== projectId) return c
            return {
                ...c,
                isDirty:        false,
                hasConflict:    false,
                updatedAt:      new Date().toISOString(),
                localUpdatedAt: undefined,
            }
        })
        saveIndex(updatedIndex)

        console.log(`[circuitCache] Conflict resolved: server wins for ${projectId}`)
        return true
    }
}

 //Remove a project from local cache entirely.
export function evictFromCache(projectId: number): void {
    removeCircuitData(projectId)
    const index = getCachedIndex().filter((c) => c.id !== projectId)
    saveIndex(index)
    console.log(`[circuitCache] Evicted project ${projectId} from cache`)
}

 //Get all circuits that have conflicts.
export function getConflicts(): CachedCircuit[] {
    return getCachedIndex().filter((c) => c.hasConflict)
}

 // Get all circuits that have local unsaved changes.
export function getDirtyCircuits(): CachedCircuit[] {
    return getCachedIndex().filter((c) => c.isDirty)
}

//Returns true if the cache has any data at all. ->Used to decide whether to show offline mode UI.
export function hasCachedData(): boolean {
    return getCachedIndex().length > 0
}