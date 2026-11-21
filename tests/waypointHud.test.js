import test from 'node:test';
import assert from 'node:assert/strict';
import { placeWaypoint } from '../src/game/utils/waypointHud.js';

test('target in view stays at its position', () => {
    const p = placeWaypoint(0.2, 0.1, false);
    assert.equal(p.inView, true);
    assert.equal(p.x, 0.2);
    assert.equal(p.y, 0.1);
});

test('target to the right is pinned to the right edge pointing right', () => {
    const p = placeWaypoint(3, 0, false);
    assert.equal(p.inView, false);
    assert.ok(p.x > 0.8 && p.x <= 0.87);
    assert.ok(Math.abs(p.angle) < 1e-6);
});

test('target to the left points left', () => {
    const p = placeWaypoint(-3, 0, false);
    assert.ok(p.x < -0.8);
    assert.ok(Math.abs(Math.abs(p.angle) - Math.PI) < 1e-6);
});

test('target behind the camera is mirrored and kept on screen', () => {
    const p = placeWaypoint(0.5, 0.2, true);
    assert.equal(p.inView, false);
    assert.ok(p.x < 0);
    assert.ok(Math.abs(p.x) <= 0.87 && p.y >= -0.75 && p.y <= 0.69);
});

test('straight behind points down and never produces NaN', () => {
    const p = placeWaypoint(0, 0, true);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.y < 0);
});
