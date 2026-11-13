import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT, MIN_CAMERA_OFFSET,
    clampZoom, isAtZoomLimit, zoomFromWheel, zoomFromPinch, zoomFromButton,
    easeZoom, freeCameraFraction, easeCollisionFraction,
} from '../src/game/utils/cameraZoom.js';

// camera zoom limits
test('clamps to min and max and survives bad input', () => {
    assert.equal(clampZoom(0), ZOOM_MIN);
    assert.equal(clampZoom(99), ZOOM_MAX);
    assert.equal(clampZoom(NaN), ZOOM_DEFAULT);
});

test('wheel up zooms in, wheel down zooms out, and stops at limits', () => {
    assert.ok(zoomFromWheel(1, -100) < 1);
    assert.ok(zoomFromWheel(1, 100) > 1);
    assert.equal(zoomFromWheel(ZOOM_MAX, 500), ZOOM_MAX);
    assert.equal(zoomFromWheel(ZOOM_MIN, -500), ZOOM_MIN);
});

test('pinch out zooms in, pinch in zooms out', () => {
    assert.ok(zoomFromPinch(1, 100, 200) < 1);
    assert.ok(zoomFromPinch(1, 200, 100) > 1);
    assert.equal(zoomFromPinch(1, 0, 100), 1);
});

test('buttons step and stop at limits', () => {
    assert.ok(zoomFromButton(1, 1) < 1);
    assert.equal(zoomFromButton(ZOOM_MIN, 1), ZOOM_MIN);
    assert.equal(zoomFromButton(ZOOM_MAX, -1), ZOOM_MAX);
    assert.equal(isAtZoomLimit(ZOOM_MIN, 1), true);
    assert.equal(isAtZoomLimit(ZOOM_MAX, -1), true);
    assert.equal(isAtZoomLimit(1, 1), false);
});

test('eases without overshoot', () => {
    let value = 1;
    for (let i = 0; i < 200; i += 1) {
        value = easeZoom(value, 1.6, 1 / 60);
        assert.ok(value <= 1.6);
    }
    assert.equal(value, 1.6);
});

// camera collision
const flat = () => 0;
const focus = { x: 0, y: 2, z: 0 };

test('keeps the full distance in open ground', () => {
    assert.equal(freeCameraFraction(focus, { x: 0, y: 5, z: 7 }, flat), 1);
});

test('pulls in when the camera would go below the terrain', () => {
    const hill = (x, z) => (z > 3 ? 8 : 0);
    const fraction = freeCameraFraction(focus, { x: 0, y: 5, z: 9 }, hill);
    assert.ok(fraction < 1);
});

test('pulls in before an obstacle behind the player', () => {
    const fraction = freeCameraFraction(focus, { x: 0, y: 5, z: 9 }, flat, [{ x: 0, z: 6, radius: 1 }]);
    assert.ok(fraction < 1);
});

test('ignores an obstacle the player is touching', () => {
    const fraction = freeCameraFraction(focus, { x: 0, y: 5, z: 7 }, flat, [{ x: 0, z: 1, radius: 1 }]);
    assert.equal(fraction, 1);
});

test('never goes closer than the minimum offset', () => {
    const wall = () => 100;
    const desired = { x: 0, y: 5, z: 7 };
    const fraction = freeCameraFraction(focus, desired, wall);
    const length = Math.hypot(0, 3, 7);
    assert.ok(fraction * length >= MIN_CAMERA_OFFSET - 1e-6);
});

test('snaps in faster than it drifts out', () => {
    const inStep = 1 - easeCollisionFraction(1, 0.5, 0.05) / 1;
    const outStep = easeCollisionFraction(0.5, 1, 0.05) - 0.5;
    assert.ok(inStep > outStep);
});
