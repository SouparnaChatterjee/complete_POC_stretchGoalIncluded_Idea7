// src/simulator/src/circuitLayout.js
// Extracted from Verilog2CV.js for testability

export function computeLayout(circuit) {
    if (!circuit || !circuit.devices) return {}

    const devices = circuit.devices
    const connectors = circuit.connectors || []

    if (Object.keys(devices).length === 0) return {}

    // Build adjacency list
    const graph = {}
    const inDegree = {}

    for (const id of Object.keys(devices)) {
        graph[id] = []
        inDegree[id] = 0
    }

    for (const conn of connectors) {
        const from = conn.from.id
        const to = conn.to.id
        if (graph[from] && inDegree[to] !== undefined) {
            graph[from].push(to)
            inDegree[to]++
        }
    }

    // Topological sort — assign layers
    const layer = {}
    const queue = []

    for (const id of Object.keys(devices)) {
        if (inDegree[id] === 0) {
            queue.push(id)
            layer[id] = 0
        }
    }

    while (queue.length > 0) {
        const node = queue.shift()
        for (const neighbour of graph[node]) {
            layer[neighbour] = Math.max(
                layer[neighbour] || 0,
                layer[node] + 1
            )
            inDegree[neighbour]--
            if (inDegree[neighbour] === 0) {
                queue.push(neighbour)
            }
        }
    }

    // Group by layer
    const layerGroups = {}
    for (const [id, l] of Object.entries(layer)) {
        layerGroups[l] = layerGroups[l] || []
        layerGroups[l].push(id)
    }

    // Assign pixel coordinates
    const LAYER_WIDTH = 200
    const NODE_HEIGHT = 100
    const positions = {}

    for (const [l, ids] of Object.entries(layerGroups)) {
        ids.forEach((id, index) => {
            positions[id] = {
                x: parseInt(l) * LAYER_WIDTH,
                y: index * NODE_HEIGHT
            }
        })
    }

    return positions
}
