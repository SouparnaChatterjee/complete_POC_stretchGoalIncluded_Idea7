<template>
    <Navbar />
    <ContextMenu />
    <Extra />
    <Helper />
    <!-- Conflict modal only mounts in Tauri — zero cost on web -->
    <ConflictModal
        v-if="isDesktop"
        ref="conflictModalRef"
    />
</template>

<script setup lang="ts">
import Navbar from '@/Navbar/Navbar.vue'
import ContextMenu from '@/ContextMenu/ContextMenu.vue'
import Extra from '@/Extra.vue'
import Helper from '#/components/helpers/Helper.vue'
import ConflictModal from '#/components/CircuitSync/ConflictModal.vue'
import { defineComponent, onMounted, ref } from 'vue'
import { setup as setupSimulator } from '../simulator/src/setup'
import { isTauri } from '#/utils/api'
import { syncFromServer } from '#/utils/circuitCache'
import type { SyncStatus } from '#/utils/circuitCache'

defineComponent({
    components: {
        Navbar,
        ContextMenu,
        Extra,
        ConflictModal,
    },
})

// Evaluated once at setup — does not change during session
const isDesktop = isTauri()

const conflictModalRef = ref<InstanceType<typeof ConflictModal> | null>(null)

onMounted(async () => {
    setupSimulator()

    // Cloud sync only runs in Tauri desktop
    // Web version uses server-side session auth — no sync needed
    if (isDesktop) {
        await runInitialSync()
    }
})

async function runInitialSync(): Promise<void> {
    try {
        const status: SyncStatus = await syncFromServer()
        console.log('[simulator] Initial sync status:', status)

        if (status === 'conflict') {
            // Tell the modal to reload conflict list
            conflictModalRef.value?.refresh()
        }
    } catch (err) {
        console.error('[simulator] Initial sync error:', err)
    }
}
</script>