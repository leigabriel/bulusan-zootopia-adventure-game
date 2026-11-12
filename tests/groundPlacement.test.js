import test from 'node:test';
import assert from 'node:assert/strict';
import { footprintRadius, lowestGroundHeight, plantedBottomY } from '../src/game/utils/groundPlacement.js';

const slope = (x) => x * 0.5; // rises toward +x

test('lowest footprint height is below the centre height on a slope', () => {
    const centre = slope(10);
    const lowest = lowestGroundHeight((x) => slope(x), 10, 0, 2);
    assert.ok(lowest < centre);
    assert.ok(Math.abs(lowest - slope(8)) < 1e-9);
});

test('flat ground or zero radius returns the centre height', () => {
    assert.equal(lowestGroundHeight(() => 3, 0, 0, 5), 3);
    assert.equal(lowestGroundHeight((x) => slope(x), 4, 0, 0), slope(4));
});

test('planted bottom sits under the lowest ground point', () => {
    const size = { x: 4, y: 2, z: 6 };
    const bottom = plantedBottomY((x) => slope(x), 10, 0, size, 0.15);
    const radius = footprintRadius(size);
    assert.ok(Math.abs(bottom - (slope(10 - radius) - 0.3)) < 1e-9);
    assert.ok(bottom < slope(10 - radius));
});

test('footprint radius uses the smaller horizontal side', () => {
    assert.equal(footprintRadius({ x: 10, y: 1, z: 4 }), 1.8);
});
