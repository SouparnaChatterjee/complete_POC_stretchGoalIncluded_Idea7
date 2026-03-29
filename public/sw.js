'use strict';

const CACHE_NAME = 'yosys-wasm-v1'
const CACHE_URLS = [
    '/yosys-bundle.js',
    '/yosys-worker.js',
    '/yosys2digitaljs-browser.js'
]

self.addEventListener('install', function (e) {
    console.log('[SW] Installing � caching WASM assets')
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(CACHE_URLS)
            })
            .then(function () {
                console.log('[SW] Pre-cache complete')
                return self.skipWaiting()
            })
            .catch(function (err) {
                console.error('[SW] Pre-cache failed:', err)
            })
    )
})

self.addEventListener('activate', function (e) {
    console.log('[SW] Activating � removing old caches')
    e.waitUntil(
        caches.keys()
            .then(function (keys) {
                return Promise.all(
                    keys
                        .filter(function (k) { return k !== CACHE_NAME })
                        .map(function (k) {
                            console.log('[SW] Deleting old cache:', k)
                            return caches.delete(k)
                        })
                )
            })
            .then(function () {
                return self.clients.claim()
            })
    )
})

self.addEventListener('fetch', function (e) {
    var url = e.request.url
    var isWasmAsset =
        url.includes('yosys-bundle') ||
        url.includes('yosys-worker') ||
        url.includes('yosys2digitaljs-browser')

    if (!isWasmAsset) return

    e.respondWith(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.match(e.request)
                    .then(function (cached) {
                        if (cached) {
                            console.log('[SW] Cache hit:',
                                url.split('/').pop())
                            return cached
                        }
                        console.log('[SW] Cache miss � fetching:',
                            url.split('/').pop())
                        return fetch(e.request)
                            .then(function (response) {
                                if (!response || response.status !== 200) {
                                    return response
                                }
                                cache.put(e.request, response.clone())
                                return response
                            })
                    })
            })
    )
})

self.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'GET_CACHE_STATUS') {
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return Promise.all(
                    CACHE_URLS.map(function (url) {
                        return cache.match(url).then(function (hit) {
                            return { url: url, cached: !!hit }
                        })
                    })
                )
            })
            .then(function (results) {
                e.source.postMessage({
                    type: 'CACHE_STATUS',
                    results: results
                })
            })
    }

    if (e.data && e.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(function () {
            console.log('[SW] Cache cleared')
            e.source.postMessage({ type: 'CACHE_CLEARED' })
        })
    }
})
