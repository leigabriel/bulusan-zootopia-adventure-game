import test from 'node:test';
import assert from 'node:assert/strict';
import { easeFactor, shortestArc, stepGhost, TELEPORT_DISTANCE } from '../src/game/multiplayer/ghostMath.js';

test('shortestArc goes the short way round', () => {
    assert.ok(Math.abs(shortestArc(3.0, -3.0) - (2 * Math.PI - 6)) < 1e-9);
    assert.equal(shortestArc(1, 1), 0);
});

test('easeFactor is 0 for no time and grows toward 1', () => {
    assert.equal(easeFactor(0), 0);
    assert.ok(easeFactor(0.016) > 0 && easeFactor(1) < 1);
    assert.ok(easeFactor(1) > easeFactor(0.1));
});

test('stepGhost glides to a near target and flags moving', () => {
    const next = stepGhost({ x: 0, y: 0, z: 0, yaw: 0 }, { x: 2, y: 1, z: 0, yaw: 1 }, 0.1);
    assert.ok(next.x > 0 && next.x < 2);
    assert.ok(next.yaw > 0 && next.yaw < 1);
    assert.equal(next.moving, true);
});

test('stepGhost settles and stops moving', () => {
    let g = { x: 0, y: 0, z: 0, yaw: 0 };
    for (let i = 0; i < 200; i += 1) g = stepGhost(g, { x: 1, y: 0, z: 1, yaw: 0 }, 0.05);
    assert.ok(Math.abs(g.x - 1) < 0.01);
    assert.equal(g.moving, false);
});

test('stepGhost teleports when far away', () => {
    const next = stepGhost({ x: 0, y: 0, z: 0, yaw: 0 }, { x: TELEPORT_DISTANCE + 1, y: 2, z: 0, yaw: 2 }, 0.016);
    assert.equal(next.x, TELEPORT_DISTANCE + 1);
    assert.equal(next.yaw, 2);
});
