import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_BUDGET, CLOUD_LAYER, CLOUD_WRAP, SUN_DIRECTION, generateClouds } from '../src/game/utils/skyConfig.js';

test('sun direction is a unit vector pointing up', () => {
    const length = Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z);
    assert.ok(Math.abs(length - 1) < 1e-9);
    assert.ok(SUN_DIRECTION.y > 0);
});

test('cloud layout is deterministic and matches the budget', () => {
    for (const [name, budget] of Object.entries(CLOUD_BUDGET)) {
        const a = generateClouds({ clouds: budget.clouds, puffs: budget.puffs });
        const b = generateClouds({ clouds: budget.clouds, puffs: budget.puffs });
        assert.deepEqual(a, b, name);
        assert.equal(a.length, budget.clouds);
        assert.ok(a.every((cloud) => cloud.puffs.length === budget.puffs));
    }
});

test('clouds stay inside the sky layer and puffs have valid shading', () => {
    const clouds = generateClouds({ clouds: 16, puffs: 8 });
    for (const { origin, puffs } of clouds) {
        assert.ok(origin.y >= CLOUD_LAYER.minY && origin.y <= CLOUD_LAYER.maxY);
        assert.ok(Math.abs(origin.x) <= CLOUD_WRAP / 2);
        assert.ok(Math.abs(origin.z) <= CLOUD_LAYER.halfDepth);
        for (const p of puffs) {
            assert.ok(p.shade >= 0 && p.shade <= 1);
            assert.ok(p.size > 0);
        }
    }
});
