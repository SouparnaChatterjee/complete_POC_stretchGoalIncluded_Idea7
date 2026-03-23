import { describe, test, expect } from 'vitest'
import { computeLayout } from '../src/circuitLayout.js'

describe('Verilog Circuit Auto-Layout (computeLayout)', () => {

    test('returns empty object for empty circuit', () => {
        const result = computeLayout({ devices: {}, connectors: [] })
        expect(result).toEqual({})
    })

    test('returns empty object for missing devices', () => {
        const result = computeLayout({})
        expect(result).toEqual({})
    })

    test('returns empty object for null input', () => {
        const result = computeLayout(null)
        expect(result).toEqual({})
    })

    test('assigns position to a single device', () => {
        const circuit = {
            devices: { dev1: { type: 'And' } },
            connectors: []
        }
        const positions = computeLayout(circuit)
        expect(Object.keys(positions)).toHaveLength(1)
        expect(positions).toHaveProperty('dev1')
        expect(positions.dev1).toHaveProperty('x')
        expect(positions.dev1).toHaveProperty('y')
    })

    test('places connected devices left-to-right', () => {
        const circuit = {
            devices: {
                input:  { type: 'Input' },
                gate:   { type: 'And' },
                output: { type: 'Output' }
            },
            connectors: [
                { from: { id: 'input', port: 'out' },
                  to:   { id: 'gate',  port: 'in1' } },
                { from: { id: 'gate',  port: 'out' },
                  to:   { id: 'output', port: 'in' } }
            ]
        }
        const positions = computeLayout(circuit)
        expect(positions.input.x).toBeLessThan(positions.gate.x)
        expect(positions.gate.x).toBeLessThan(positions.output.x)
    })

    test('assigns all devices a position', () => {
        const circuit = {
            devices: {
                in1:  { type: 'Input' },
                in2:  { type: 'Input' },
                and1: { type: 'And' },
                out1: { type: 'Output' }
            },
            connectors: [
                { from: { id: 'in1',  port: 'out' },
                  to:   { id: 'and1', port: 'in1' } },
                { from: { id: 'in2',  port: 'out' },
                  to:   { id: 'and1', port: 'in2' } },
                { from: { id: 'and1', port: 'out' },
                  to:   { id: 'out1', port: 'in'  } }
            ]
        }
        const positions = computeLayout(circuit)
        expect(Object.keys(positions)).toHaveLength(4)
        expect(positions).toHaveProperty('in1')
        expect(positions).toHaveProperty('in2')
        expect(positions).toHaveProperty('and1')
        expect(positions).toHaveProperty('out1')
    })

    test('produces non-overlapping positions', () => {
        const circuit = {
            devices: {
                a: { type: 'Input' },
                b: { type: 'Input' },
                c: { type: 'And' },
                d: { type: 'Output' }
            },
            connectors: [
                { from: { id: 'a', port: 'out' },
                  to:   { id: 'c', port: 'in1' } },
                { from: { id: 'b', port: 'out' },
                  to:   { id: 'c', port: 'in2' } },
                { from: { id: 'c', port: 'out' },
                  to:   { id: 'd', port: 'in'  } }
            ]
        }
        const positions = computeLayout(circuit)
        const coords = Object.values(positions)
        for (let i = 0; i < coords.length; i++) {
            for (let j = i + 1; j < coords.length; j++) {
                const samePos =
                    coords[i].x === coords[j].x &&
                    coords[i].y === coords[j].y
                expect(samePos).toBe(false)
            }
        }
    })

    test('handles disconnected devices without crashing', () => {
        const circuit = {
            devices: {
                a: { type: 'Input' },
                b: { type: 'And' },
                c: { type: 'Output' }
            },
            connectors: [
                { from: { id: 'a', port: 'out' },
                  to:   { id: 'b', port: 'in1' } }
            ]
        }
        expect(() => computeLayout(circuit)).not.toThrow()
        const positions = computeLayout(circuit)
        expect(positions).toHaveProperty('a')
        expect(positions).toHaveProperty('b')
        expect(positions).toHaveProperty('c')
    })

    test('inputs are always leftmost layer', () => {
        const circuit = {
            devices: {
                inp: { type: 'Input' },
                mid: { type: 'And' },
                out: { type: 'Output' }
            },
            connectors: [
                { from: { id: 'inp', port: 'out' },
                  to:   { id: 'mid', port: 'in1' } },
                { from: { id: 'mid', port: 'out' },
                  to:   { id: 'out', port: 'in'  } }
            ]
        }
        const positions = computeLayout(circuit)
        const minX = Math.min(...Object.values(positions).map(p => p.x))
        expect(positions.inp.x).toBe(minX)
    })

    test('outputs are always rightmost layer', () => {
        const circuit = {
            devices: {
                inp: { type: 'Input' },
                mid: { type: 'And' },
                out: { type: 'Output' }
            },
            connectors: [
                { from: { id: 'inp', port: 'out' },
                  to:   { id: 'mid', port: 'in1' } },
                { from: { id: 'mid', port: 'out' },
                  to:   { id: 'out', port: 'in'  } }
            ]
        }
        const positions = computeLayout(circuit)
        const maxX = Math.max(...Object.values(positions).map(p => p.x))
        expect(positions.out.x).toBe(maxX)
    })

})
