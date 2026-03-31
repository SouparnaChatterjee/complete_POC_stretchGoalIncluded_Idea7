<template>
    <template v-if="isLoading">
        <h1>Loading...</h1>
    </template>
    <template v-else-if="!isLoading && !hasAccess">
        <h1>403</h1>
    </template>
    <template v-else-if="!isLoading && hasAccess">
        <simulator />
    </template>
</template>

<script lang="ts">
// Kept for legacy imports from other files that call getToken()... New code should use getAuthToken() from #/utils/api
export function getToken(name: string): string | undefined {
    const match = document.cookie.match(
        new RegExp('(^| )' + name + '=([^;]+)')
    )
    if (match) return match[2]
    return undefined
}
</script>

<script setup lang="ts">
import simulator from './simulator.vue'
import { onBeforeMount, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '#/store/authStore'
import { useSimulatorMobileStore } from '#/store/simulatorMobileStore'
import { apiFetch, getAuthToken } from '#/utils/api'

const route = useRoute()
const hasAccess = ref(true)
const isLoading = ref(true)
const authStore = useAuthStore()
const simulatorMobileStore = useSimulatorMobileStore()

// Check if user has edit access to the project
// Uses apiFetch — works on web (cookies) and Tauri (localStorage token)
async function checkEditAccess() {
    await apiFetch(
        `/api/v1/projects/${(window as any).logixProjectId}/check_edit_access`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                // apiFetch auto-injects token in Tauri
                // On web, explicitly pass it for belt-and-suspenders
                ...(getAuthToken()
                    ? { Authorization: `Token ${getAuthToken()}` }
                    : {}),
            },
        }
    ).then((res) => {
        if (res.ok) {
            res.json().then((data) => {
                authStore.setUserInfo(data.data)
                ;(window as any).isUserLoggedIn = true
                isLoading.value = false
            })
        } else if (res.status === 403) {
            hasAccess.value = false
            isLoading.value = false
        } else if (res.status === 404) {
            hasAccess.value = false
            isLoading.value = false
        } else if (res.status === 401) {
            window.location.href = '/users/sign_in'
        }
    })
}

// Get logged in user information when blank simulator is opened
async function getLoginData() {
    try {
        const response = await apiFetch('/api/v1/me', {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                ...(getAuthToken()
                    ? { Authorization: `Token ${getAuthToken()}` }
                    : {}),
            },
        })
        if (response.ok) {
            const data = await response.json()
            authStore.setUserInfo(data.data)
            ;(window as any).isUserLoggedIn = true
        } else if (response.status === 401) {
            ;(window as any).isUserLoggedIn = false
        }
    } catch (err) {
        console.error('[simulatorHandler] getLoginData failed:', err)
    }
}

onBeforeMount(() => {
    const windowLogixProjectId = (window as any).logixProjectId
    if (windowLogixProjectId && windowLogixProjectId !== '0') {
        ;(window as any).logixProjectId = windowLogixProjectId
        checkEditAccess()
    } else if (route.params.projectId) {
        ;(window as any).logixProjectId = route.params.projectId
        checkEditAccess()
    } else {
        getLoginData()
        isLoading.value = false
    }
})

onMounted(() => {
    window.addEventListener('resize', checkShowSidebar)
})

function checkShowSidebar() {
    simulatorMobileStore.showMobileView =
        window.innerWidth < simulatorMobileStore.minWidthToShowMobile
            ? true
            : false
}
</script>