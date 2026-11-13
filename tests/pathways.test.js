import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PATH_ROUTES, PATH_WIDTH, PLAZA, sampleRoute, getRouteSamples, distanceToPaths, isNearPath,
} from '../src/game/data/pathways.js';
import { MISSION_POINTS, STAFF_START_POSITIONS, WORLD_PROPS, TIGER_ENCLOSURE, isInKeepClearZone, isInsideTigerEnclosure } from '../src/game/data/worldPoints.js';
import { FOOTPRINTS, footprintCircles } from '../src/game/utils/propPlacement.js';
import { isRiverArea } from '../src/game/utils/riverMath.js';
import { meadowDensity } from '../src/game/utils/meadowScatter.js';

const route = (id) => PATH_ROUTES.find((item) => item.id === id);
const end = (id) => { const pts = route(id).points; return { x: pts[pts.length - 1][0], z: pts[pts.length - 1][1] }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('sampleRoute passes through its control points and stays evenly spaced', () => {
    const samples = sampleRoute([[0, 0], [10, 0], [20, 10]], 1.5);
    assert.deepEqual(samples[0], { x: 0, z: 0 });
    assert.ok(Math.abs(samples[samples.length - 1].x - 20) < 1e-9);
    for (let i = 1; i < samples.length; i += 1) assert.ok(dist(samples[i - 1], samples[i]) < 3);
});

test('every route ends at a place the story sends the player', () => {
    assert.ok(dist(end('barn'), MISSION_POINTS.barn) < 6);
    assert.ok(dist(end('garden'), MISSION_POINTS.carrot) < 6);
    assert.ok(dist(end('river'), MISSION_POINTS.river) < 6);
    assert.ok(dist(end('windmill'), MISSION_POINTS.windmill) < 6);
    assert.ok(dist(end('tiger'), MISSION_POINTS['tiger-view']) < 12);
    assert.ok(dist(end('stable'), WORLD_PROPS.stable) < 24);
});

test('only the tiger route crosses water, and it comes out dry on both ends', () => {
    for (const { id, samples } of getRouteSamples()) {
        const wet = samples.filter((p) => isRiverArea(p.x, p.z, 1.6));
        if (id === 'tiger') {
            assert.ok(wet.length > 0, 'tiger route should cross the river');
            assert.equal(isRiverArea(samples[0].x, samples[0].z, 1.6), false);
            const last = samples[samples.length - 1];
            assert.equal(isRiverArea(last.x, last.z, 1.6), false);
        } else {
            assert.equal(wet.length, 0, `${id} route enters the river`);
        }
    }
});

test('routes keep clear of props, the tiger enclosure and staff positions', () => {
    const circles = [
        ...footprintCircles(WORLD_PROPS.stable, FOOTPRINTS.stable),
        ...footprintCircles({ ...WORLD_PROPS.signBoard, rotation: 0 }, FOOTPRINTS.signBoard),
        ...WORLD_PROPS.haystacks.flatMap((hay) => footprintCircles(hay, FOOTPRINTS.haystack)),
    ];
    for (const { id, samples } of getRouteSamples()) {
        for (const p of samples) {
            for (const c of circles) {
                assert.ok(dist(p, c) > c.radius + PATH_WIDTH / 2 - 0.2, `${id} runs into a prop at ${p.x.toFixed(0)},${p.z.toFixed(0)}`);
            }
            assert.equal(isInsideTigerEnclosure(p.x, p.z, 1), false, `${id} enters the tiger enclosure`);
        }
    }
    assert.ok(TIGER_ENCLOSURE.halfSize > 0);
    for (const staff of Object.values(STAFF_START_POSITIONS)) assert.ok(PLAZA.radius > 0 && staff);
});

test('distanceToPaths and isNearPath agree with the path width', () => {
    const { samples } = getRouteSamples().find((item) => item.id === 'garden');
    const mid = samples[Math.floor(samples.length / 2)];
    assert.ok(distanceToPaths(mid.x, mid.z) < 0);
    assert.equal(isNearPath(mid.x, mid.z), true);
    assert.equal(isNearPath(900, 900, 5), false);
    assert.ok(distanceToPaths(PLAZA.x, PLAZA.z) <= 0);
});

test('scenery and grass leave the walkways clear', () => {
    const { samples } = getRouteSamples().find((item) => item.id === 'windmill');
    const mid = samples[Math.floor(samples.length / 2)];
    assert.equal(isInKeepClearZone(mid.x, mid.z, 4), true);
    assert.equal(meadowDensity(mid.x, mid.z), 0);
});
