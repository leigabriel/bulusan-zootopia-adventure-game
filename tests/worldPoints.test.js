import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_POINTS, TIGER_ENCLOSURE, isInKeepClearZone, isInsideTigerEnclosure } from '../src/game/data/worldPoints.js';
import { isRiverArea, getRiverTerrainOffset, findAccessiblePosition, getRiverMetrics } from '../src/game/utils/riverMath.js';

test('every mission point is on dry land', () => {
    for (const [name, point] of Object.entries(MISSION_POINTS)) {
        if (name === 'river') continue; // the river mission stands on the bank
        assert.equal(isRiverArea(point.x, point.z), false, `${name} must not be in the river`);
    }
});

test('river mission point is on the bank, not in the water', () => {
    assert.equal(isRiverArea(MISSION_POINTS.river.x, MISSION_POINTS.river.z), false);
});

test('tiger viewing point is outside the enclosure and well clear of the river', () => {
    const view = MISSION_POINTS['tiger-view'];
    assert.equal(isInsideTigerEnclosure(view.x, view.z), false);
    assert.equal(isRiverArea(view.x, view.z, 6), false);
    assert.ok(Math.hypot(view.x - TIGER_ENCLOSURE.x, view.z - TIGER_ENCLOSURE.z) < 60);
});

test('keep-clear zones cover mission points', () => {
    assert.equal(isInKeepClearZone(MISSION_POINTS.carrot.x, MISSION_POINTS.carrot.z), true);
    assert.equal(isInKeepClearZone(MISSION_POINTS['tiger-view'].x, MISSION_POINTS['tiger-view'].z), true);
    assert.equal(isInKeepClearZone(-150, -150), false);
});

test('river terrain offset is zero far away and negative in the channel', () => {
    assert.equal(getRiverTerrainOffset(0, -150), 0);
    const centre = getRiverMetrics(-4, 87).point;
    assert.ok(getRiverTerrainOffset(centre.x, centre.y) < -1);
});

test('findAccessiblePosition moves a point out of the river', () => {
    const centre = getRiverMetrics(-4, 87).point;
    const safe = findAccessiblePosition(centre.x, centre.y, 1);
    assert.equal(isRiverArea(safe.x, safe.z), false);
});
