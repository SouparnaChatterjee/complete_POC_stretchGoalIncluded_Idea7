<!-- src/components/CircuitSync/ConflictModal.vue -->
<template>
    <v-dialog
        v-model="isOpen"
        max-width="600"
        persistent
    >
        <v-card style="background-color: #1e1e2e; color: white;">
            <v-toolbar color="#43b984" flat>
                <v-toolbar-title class="text-white font-weight-bold">
                    ⚠️ Sync Conflict Detected
                </v-toolbar-title>
            </v-toolbar>

            <v-card-text class="pa-4">
                <p class="mb-4" style="color: #ccc;">
                    The following circuits were edited both locally and on the
                    server since your last sync. Choose which version to keep
                    for each circuit.
                </p>

                <v-card
                    v-for="circuit in conflicts"
                    :key="circuit.id"
                    class="mb-3 conflict-card"
                    flat
                >
                    <v-card-text>
                        <div class="d-flex align-center justify-space-between mb-2">
                            <span class="font-weight-bold text-white">
                                {{ circuit.name }}
                            </span>
                            <v-chip size="x-small" color="error">
                                CONFLICT
                            </v-chip>
                        </div>

                        <div class="version-info mb-3">
                            <div class="version-row">
                                <span class="label">Local edit:</span>
                                <span class="value">
                                    {{ formatDate(circuit.localUpdatedAt) }}
                                </span>
                            </div>
                            <div class="version-row">
                                <span class="label">Server version:</span>
                                <span class="value">
                                    {{ formatDate(circuit.updatedAt) }}
                                </span>
                            </div>
                        </div>

                        <div class="d-flex resolution-buttons">
                            <v-btn
                                color="#43b984"
                                size="small"
                                :loading="resolvingId === circuit.id"
                                :disabled="resolvingId !== null"
                                @click="resolve(circuit.id, 'local')"
                            >
                                Keep My Version
                            </v-btn>
                            <v-btn
                                color="#e06c75"
                                size="small"
                                :loading="resolvingId === circuit.id"
                                :disabled="resolvingId !== null"
                                @click="resolve(circuit.id, 'server')"
                            >
                                Use Server Version
                            </v-btn>
                        </div>
                    </v-card-text>
                </v-card>
            </v-card-text>

            <v-card-actions class="pa-4">
                <v-spacer />
                <v-btn
                    variant="text"
                    color="#ccc"
                    :disabled="resolvingId !== null"
                    @click="dismissAll"
                >
                    Remind Me Later
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-snackbar
        v-model="snackbar.visible"
        :color="snackbar.color"
        :timeout="3000"
        location="bottom right"
    >
        {{ snackbar.message }}
    </v-snackbar>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import {
    getConflicts,
    resolveConflict,
} from '#/utils/circuitCache'

// Import type separately — compatible with TS 4.5.4
import type { CachedCircuit } from '#/utils/circuitCache'

//State 

const conflicts   = ref<CachedCircuit[]>([])
const resolvingId = ref<number | null>(null)

const snackbar = ref<{
    visible: boolean
    message: string
    color: string
}>({
    visible: false,
    message: '',
    color: '#43b984',
})

// Open whenever there are unresolved conflicts
const isOpen = computed(() => conflicts.value.length > 0)

//Lifecycle 

onMounted(() => {
    conflicts.value = getConflicts()
})

// ── Exposed — call refresh() after syncFromServer() returns 'conflict' ────

function refresh(): void {
    conflicts.value = getConflicts()
}

defineExpose({ refresh })

//Actions 

async function resolve(
    projectId: number,
    resolution: 'local' | 'server'
): Promise<void> {
    resolvingId.value = projectId

    try {
        const success = await resolveConflict(projectId, resolution)

        if (success) {
            conflicts.value = conflicts.value.filter(
                (c: CachedCircuit) => c.id !== projectId
            )
            showSnackbar(
                resolution === 'local'
                    ? 'Local version pushed to server.'
                    : 'Server version restored locally.',
                '#43b984'
            )
        } else {
            showSnackbar(
                'Failed to resolve conflict. Check your connection.',
                '#e06c75'
            )
        }
    } catch (err) {
        console.error('[ConflictModal] resolve error:', err)
        showSnackbar('Unexpected error during resolution.', '#e06c75')
    } finally {
        resolvingId.value = null
    }
}

function dismissAll(): void {
    // Close modal but keep conflicts in cache index
    // They reappear on next sync
    conflicts.value = []
}

//Helpers 

function formatDate(iso: string | undefined): string {
    if (!iso) return 'Unknown'
    try {
        return new Date(iso).toLocaleString()
    } catch {
        return iso
    }
}

function showSnackbar(message: string, color: string): void {
    snackbar.value = { visible: true, message, color }
}
</script>

<style scoped>
.conflict-card {
    background-color: #2a2a3e !important;
    border: 1px solid #444 !important;
    border-radius: 6px;
}
.version-info {
    font-size: 0.85rem;
}
.version-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.2rem;
}
.label {
    color: #999;
    min-width: 110px;
}
.value {
    color: #eee;
}
.resolution-buttons {
    gap: 0.5rem;
}
</style>