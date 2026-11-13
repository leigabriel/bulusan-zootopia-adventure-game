import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/game/utils/meadowScatter.js';
import { FOOTPRINTS, footprintCircles, scatterPlacements } from '../src/game/utils/propPlacement.js';

test('footprint circles are scaled, rotated and offset like the prop', () => {
    const [a, b] = footprintCircles({ x: 10, z: 20, rotation: Math.PI / 2, scale: 2 }, [{ x: 0, z: 1, radius: 0.5 }, { x: 1, z: 0, radius: 1 }]);
    // +90 degrees turns +z towards +x.
    assert.ok(Math.abs(a.x - 12) < 1e-9 && Math.abs(a.z - 20) < 1e-9 && a.radius === 1);
    assert.ok(Math.abs(b.x - 10) < 1e-9 && Math.abs(b.z - 18) < 1e-9 && b.radius === 2);
});

test('scatter keeps its spacing, ground rules and is repeatable', () => {
    const options = {
        count: 12, extent: 100, minGap: 10, scale: [1, 2],
        isBlocked: (x, z) => Math.hypot(x, z) < 30,
        existing: [{ x: 50, z: 50 }],
    };
    const first = scatterPlacements({ ...options, rng: createRng(5) });
    const second = scatterPlacements({ ...options, rng: createRng(5) });
    assert.deepEqual(first, second);
    assert.equal(first.length, 12);
    for (const [i, a] of first.entries()) {
        assert.ok(Math.hypot(a.x, a.z) >= 30);
        assert.ok(Math.hypot(a.x - 50, a.z - 50) >= 10);
        assert.ok(a.scale >= 1 && a.scale <= 2);
        for (const b of first.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 10);
    }
});

test('scatter gives up gracefully when the area is full', () => {
    const placements = scatterPlacements({ count: 5, rng: createRng(1), extent: 10, minGap: 100, isBlocked: () => false });
    assert.equal(placements.length, 1);
});

test('every prop footprint has circles with a positive radius', () => {
    for (const [name, circles] of Object.entries(FOOTPRINTS)) {
        assert.ok(circles.length > 0 && circles.every((c) => c.radius > 0), name);
    }
});
