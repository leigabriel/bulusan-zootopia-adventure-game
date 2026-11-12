import test from 'node:test';
import assert from 'node:assert/strict';
import { WADE_FULL_DEPTH, WADE_MIN_SPEED, WADE_START_DEPTH, sampleRiver, wadeSpeedScale } from '../src/game/utils/riverMath.js';

test('dry or barely wet ground does not slow the player', () => {
    assert.equal(wadeSpeedScale(0), 1);
    assert.equal(wadeSpeedScale(WADE_START_DEPTH), 1);
});

test('deeper water slows smoothly down to the minimum speed', () => {
    let previous = 1;
    for (let depth = WADE_START_DEPTH; depth <= WADE_FULL_DEPTH; depth += 0.05) {
        const scale = wadeSpeedScale(depth);
        assert.ok(scale <= previous + 1e-9);
        assert.ok(scale >= WADE_MIN_SPEED);
        previous = scale;
    }
    assert.equal(wadeSpeedScale(WADE_FULL_DEPTH), WADE_MIN_SPEED);
    assert.equal(wadeSpeedScale(5), WADE_MIN_SPEED);
});

test('sampleRiver finds the channel and ignores far land', () => {
    assert.ok(sampleRiver(-4, 87, 0));
    assert.equal(sampleRiver(0, -150, 0), null);
});
