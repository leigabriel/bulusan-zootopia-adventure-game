import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CHUNK_SIZE, FLOWER_COLORS, MEADOW_BOUND, createRng, generateFlowerPlacements,
    generateGrassPlacements, meadowDensity, pickInsectSpot,
} from '../src/game/utils/meadowScatter.js';
import { isRiverArea } from '../src/game/utils/riverMath.js';

function eachItem(chunks, stride, visit) {
    for (const chunk of chunks) {
        for (let i = 0; i < chunk.items.length; i += stride) visit(chunk, chunk.items.slice(i, i + stride));
    }
}

test('grass placement is deterministic for a seed', () => {
    const a = generateGrassPlacements({ count: 3000, seed: 4 });
    const b = generateGrassPlacements({ count: 3000, seed: 4 });
    const c = generateGrassPlacements({ count: 3000, seed: 5 });
    assert.equal(a.total, b.total);
    assert.deepEqual(a.chunks[0].items, b.chunks[0].items);
    assert.notDeepEqual(a.chunks[0].items, c.chunks[0].items);
});

test('grass fills most of the requested count and never grows in the river', () => {
    const { chunks, total } = generateGrassPlacements({ count: 6000, seed: 1 });
    assert.ok(total > 6000 * 0.55 && total <= 6000, `placed ${total}`);
    eachItem(chunks, 7, (chunk, [x, z]) => {
        assert.equal(isRiverArea(x, z), false, `grass in river at ${x},${z}`);
        assert.ok(Math.abs(x) <= MEADOW_BOUND && Math.abs(z) <= MEADOW_BOUND);
    });
});

test('every item sits inside its chunk', () => {
    const { chunks } = generateGrassPlacements({ count: 4000, seed: 2 });
    eachItem(chunks, 7, (chunk, [x, z]) => {
        assert.ok(x >= chunk.minX - 1e-6 && x <= chunk.minX + CHUNK_SIZE + 1e-6);
        assert.ok(z >= chunk.minZ - 1e-6 && z <= chunk.minZ + CHUNK_SIZE + 1e-6);
    });
});

test('density is zero in the river and on the tiger viewing circle', () => {
    assert.equal(meadowDensity(-4, 87), 0);
    assert.equal(meadowDensity(145, 153), 0);
});

test('flowers come in drifts with valid colours and avoid the river', () => {
    const { chunks, total, spots } = generateFlowerPlacements({ count: 3000, seed: 3 });
    assert.ok(total > 500, `placed ${total}`);
    assert.ok(spots.length > 5);
    eachItem(chunks, 5, (chunk, [x, z, , scale, colour]) => {
        assert.equal(isRiverArea(x, z), false);
        assert.ok(Number.isInteger(colour) && colour >= 0 && colour < FLOWER_COLORS.length);
        assert.ok(scale >= 0.9 && scale <= 1.5);
    });
});

test('insect spots stay near the player, on land and inside the map', () => {
    const rand = createRng(9);
    const centre = { x: 14, z: 10 };
    for (let i = 0; i < 200; i += 1) {
        const spot = pickInsectSpot(rand, centre, [{ x: 20, z: 30 }, { x: 500, z: 500 }]);
        assert.ok(Math.hypot(spot.x - centre.x, spot.z - centre.z) <= 61);
        assert.equal(isRiverArea(spot.x, spot.z), false);
    }
});
