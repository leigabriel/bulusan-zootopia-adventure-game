import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BRIDGE_HALF_LENGTH, BRIDGE_HALF_WIDTH, getBridgeFrame, getBridgeDeckHeight, clampToBridgeRails,
} from '../src/game/data/bridge.js';
import { RIVER_CROSSING, getRiverShoreDistance } from '../src/game/utils/riverMath.js';
import { getRouteSamples } from '../src/game/data/pathways.js';
import { sampleTerrainHeight } from '../src/game/utils/terrainField.js';

const along = (distance, lateral = 0) => {
    const f = getBridgeFrame();
    return { x: f.x + f.ax * distance - f.az * lateral, z: f.z + f.az * distance + f.ax * lateral };
};

test('the creek is narrow enough at the crossing for the bridge to span it', () => {
    const f = getBridgeFrame();
    assert.ok(Math.hypot(f.x - RIVER_CROSSING.x, f.z - RIVER_CROSSING.z) < 1);
    // Water edge (shore distance 0) sits well inside the bridge ends.
    for (const sign of [-1, 1]) {
        const p = along(sign * (BRIDGE_HALF_LENGTH - 0.8));
        assert.ok(getRiverShoreDistance(p.x, p.z, 12) > 0.5, 'bridge ends rest on land');
    }
});

test('the visitor path crosses the creek at the bridge', () => {
    const f = getBridgeFrame();
    const tiger = getRouteSamples().find((route) => route.id === 'tiger').samples;
    const nearest = Math.min(...tiger.map((p) => Math.hypot(p.x - f.x, p.z - f.z)));
    assert.ok(nearest < 3, `path passes ${nearest.toFixed(1)} from the bridge centre`);
});

test('deck height is only defined over the bridge and arches in the middle', () => {
    const middle = getBridgeDeckHeight(along(0).x, along(0).z);
    const quarter = getBridgeDeckHeight(along(BRIDGE_HALF_LENGTH * 0.9).x, along(BRIDGE_HALF_LENGTH * 0.9).z);
    assert.ok(middle > quarter);
    assert.equal(getBridgeDeckHeight(along(BRIDGE_HALF_LENGTH + 2).x, along(BRIDGE_HALF_LENGTH + 2).z), null);
    assert.equal(getBridgeDeckHeight(along(0, BRIDGE_HALF_WIDTH + 0.5).x, along(0, BRIDGE_HALF_WIDTH + 0.5).z), null);
});

test('the deck is above the water in the middle and meets the banks at the ends', () => {
    const f = getBridgeFrame();
    const middle = getBridgeDeckHeight(f.x, f.z);
    assert.ok(middle - sampleTerrainHeight(f.x, f.z) > 1.2, 'deck clears the bed');
    for (const sign of [-1, 1]) {
        const p = along(sign * (BRIDGE_HALF_LENGTH - 0.2));
        assert.ok(Math.abs(getBridgeDeckHeight(p.x, p.z) - sampleTerrainHeight(p.x, p.z)) < 0.8, 'deck ends meet the banks');
    }
});

test('rails keep a walker inside the deck width', () => {
    assert.equal(clampToBridgeRails(along(0, 0).x, along(0, 0).z), null);
    const wide = along(0, BRIDGE_HALF_WIDTH - 0.05);
    const fixed = clampToBridgeRails(wide.x, wide.z);
    assert.ok(fixed);
    const f = getBridgeFrame();
    const lateral = -(fixed.x - f.x) * f.az + (fixed.z - f.z) * f.ax;
    assert.ok(Math.abs(lateral) < BRIDGE_HALF_WIDTH - 0.25);
});
