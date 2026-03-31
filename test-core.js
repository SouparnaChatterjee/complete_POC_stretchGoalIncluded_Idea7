// test-core.js
// node test-core.js
// Proves yosys2digitaljs core works with our WASM JSON output

const core = require('./node_modules/yosys2digitaljs/dist/core.js')

console.log('=== Exported functions ===')
console.log(Object.keys(core))

// this is exactly what your WASM worker produces for a full adder
const sampleYosysJson = {
    "modules": {
        "full_adder": {
            "attributes": { "top": 1 },
            "ports": {
                "a":   { "direction": "input",  "bits": [2] },
                "b":   { "direction": "input",  "bits": [3] },
                "cin": { "direction": "input",  "bits": [4] },
                "sum": { "direction": "output", "bits": [7] },
                "cout":{ "direction": "output", "bits": [8] }
            },
            "cells": {
                "xor1": {
                    "type": "$_XOR_",
                    "port_directions": { "A": "input", "B": "input", "Y": "output" },
                    "connections": { "A": [2], "B": [3], "Y": [5] }
                },
                "xor2": {
                    "type": "$_XOR_",
                    "port_directions": { "A": "input", "B": "input", "Y": "output" },
                    "connections": { "A": [5], "B": [4], "Y": [7] }
                },
                "and1": {
                    "type": "$_AND_",
                    "port_directions": { "A": "input", "B": "input", "Y": "output" },
                    "connections": { "A": [2], "B": [3], "Y": [6] }
                },
                "and2": {
                    "type": "$_AND_",
                    "port_directions": { "A": "input", "B": "input", "Y": "output" },
                    "connections": { "A": [5], "B": [4], "Y": [9] }
                },
                "or1": {
                    "type": "$_OR_",
                    "port_directions": { "A": "input", "B": "input", "Y": "output" },
                    "connections": { "A": [6], "B": [9], "Y": [8] }
                }
            },
            "netnames": {}
        }
    }
}

try {
    const result = core.yosys2digitaljs(sampleYosysJson, {})
    console.log('\n=== yosys2digitaljs core output ===')
    console.log(JSON.stringify(result, null, 2))
    console.log('\n=== Device types produced ===')
    Object.entries(result.devices).forEach(([id, dev]) => {
        console.log(id, '->', dev.type, dev.net || dev.label || '')
    })
    console.log('\n=== Connector count ===', result.connectors.length)
    console.log('\n FEASIBLE — core works with WASM JSON output')
} catch(e) {
    console.log('\n Error:', e.message)
}