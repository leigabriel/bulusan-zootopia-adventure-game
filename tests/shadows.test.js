import test from 'node:test';
import assert from 'node:assert/strict';
import { SHADOW_QUALITIES, normalizeShadowQuality, getShadowConfig } from '../src/game/utils/shadows.js';

test('normalizes unknown quality to medium', () => {
    assert.equal(normalizeShadowQuality('bogus'), 'medium');
    assert.equal(normalizeShadowQuality('off'), 'off');
});

test('all qualities have configs, higher means bigger map', () => {
    for (const q of SHADOW_QUALITIES) assert.ok(getShadowConfig(q));
    assert.ok(getShadowConfig('high').size > getShadowConfig('low').size);
});
