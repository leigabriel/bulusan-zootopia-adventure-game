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

test('river stays well clear of the tiger enclosure and viewing area', () => {
    const { x, z, halfSize } = TIGER_ENCLOSURE;
    let closest = Infinity;
    for (let px = x - halfSize - 20; px <= x + halfSize + 20; px += 2) {
        for (let pz = z - halfSize - 20; pz <= z + halfSize + 30; pz += 2) {
            const metrics = getRiverMetrics(px, pz);
            const edgeGap = metrics.lateral - metrics.width;
            if (isInsideTigerEnclosure(px, pz, 0) || (Math.abs(px - x) < halfSize && pz > z + halfSize)) closest = Math.min(closest, edgeGap);
        }
    }
    assert.ok(closest > 10, `river bank is only ${closest.toFixed(1)} units from the tiger area`);
});

test('tiger enclosure and viewing area sit on level ground', async () => {
    const { computeTerrainHeight } = await import('../src/game/utils/terrainField.js');
    const { x, z, halfSize } = TIGER_ENCLOSURE;
    const heights = [];
    for (let px = x - halfSize; px <= x + halfSize; px += 4) {
        for (let pz = z - halfSize; pz <= z + halfSize + 20; pz += 4) heights.push(computeTerrainHeight(px, pz));
    }
    assert.ok(Math.max(...heights) - Math.min(...heights) < 0.01, 'pad is not level');
});

test('hand-placed props are on dry land, inside the map and clear of the tiger enclosure', async () => {
    const { WORLD_PROPS } = await import('../src/game/data/worldPoints.js');
    const props = [WORLD_PROPS.stable, WORLD_PROPS.parrotRun, WORLD_PROPS.signBoard, ...WORLD_PROPS.haystacks];
    for (const prop of props) {
        assert.equal(isRiverArea(prop.x, prop.z, 12), false, `prop at ${prop.x},${prop.z} is near the river`);
        assert.equal(isInsideTigerEnclosure(prop.x, prop.z, 6), false);
        assert.ok(Math.abs(prop.x) < 185 && Math.abs(prop.z) < 185);
        assert.equal(isInKeepClearZone(prop.x, prop.z), true, 'props reserve their ground');
    }
});

test('props do not overlap mission points', async () => {
    const { WORLD_PROPS } = await import('../src/game/data/worldPoints.js');
    const props = [WORLD_PROPS.stable, WORLD_PROPS.parrotRun, WORLD_PROPS.signBoard, ...WORLD_PROPS.haystacks];
    for (const [name, point] of Object.entries(MISSION_POINTS)) {
        for (const prop of props) {
            assert.ok(Math.hypot(point.x - prop.x, point.z - prop.z) > 9, `${name} too close to a prop`);
        }
    }
});

test('safety board faces the player start', async () => {
    const { WORLD_PROPS, getSignBoardRotation, STATUE_CENTER, PLAYER_START_OFFSET } = await import('../src/game/data/worldPoints.js');
    const rotation = getSignBoardRotation();
    // The model's front is +z, so its forward vector must point at the start.
    const forward = { x: Math.sin(rotation), z: Math.cos(rotation) };
    const toStart = { x: STATUE_CENTER.x + PLAYER_START_OFFSET.x - WORLD_PROPS.signBoard.x, z: STATUE_CENTER.z + PLAYER_START_OFFSET.z - WORLD_PROPS.signBoard.z };
    const length = Math.hypot(toStart.x, toStart.z);
    assert.ok((forward.x * toStart.x + forward.z * toStart.z) / length > 0.999);
});
