import test from 'node:test';
import assert from 'node:assert/strict';

// Polyfill localStorage for Node.js test environment
const storage = new Map();
globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, String(value)); },
    removeItem: (key) => { storage.delete(key); },
    clear: () => { storage.clear(); },
};

// Polyfill window.dispatchEvent for playerProfile.js
globalThis.window = {
    dispatchEvent: () => {},
};

import {
    getPlayerProfile,
    isPlayerProfileComplete,
    savePlayerProfile,
    getPlayerModel,
    PLAYER_GENDERS,
    PLAYER_PROFILE_CHANGE_EVENT,
} from '../src/game/utils/playerProfile.js';

test.beforeEach(() => {
    storage.clear();
});

test('getPlayerProfile returns empty defaults when nothing stored', () => {
    const profile = getPlayerProfile();
    assert.equal(profile.name, '');
    assert.equal(profile.gender, '');
});

test('savePlayerProfile stores valid profile', () => {
    const result = savePlayerProfile({ name: 'TestPlayer', gender: 'boy' });
    assert.deepEqual(result, { name: 'TestPlayer', gender: 'boy' });
    const profile = getPlayerProfile();
    assert.equal(profile.name, 'TestPlayer');
    assert.equal(profile.gender, 'boy');
});

test('savePlayerProfile rejects invalid gender', () => {
    const result = savePlayerProfile({ name: 'Test', gender: 'invalid' });
    assert.equal(result, null);
});

test('savePlayerProfile rejects empty name', () => {
    const result = savePlayerProfile({ name: '', gender: 'boy' });
    assert.equal(result, null);
});

test('savePlayerProfile trims and limits name to 24 chars', () => {
    const result = savePlayerProfile({ name: '  Very Long Name That Exceeds Limit  ', gender: 'girl' });
    assert.ok(result.name.length <= 24);
    assert.equal(result.name, 'Very Long Name That Exce');
});

test('isPlayerProfileComplete checks both fields', () => {
    assert.equal(isPlayerProfileComplete({ name: '', gender: 'boy' }), false);
    assert.equal(isPlayerProfileComplete({ name: 'Test', gender: '' }), false);
    assert.equal(isPlayerProfileComplete({ name: 'Test', gender: 'boy' }), true);
});

test('isPlayerProfileComplete uses stored profile by default', () => {
    assert.equal(isPlayerProfileComplete(), false);
    savePlayerProfile({ name: 'Alice', gender: 'girl' });
    assert.equal(isPlayerProfileComplete(), true);
});

test('getPlayerModel returns correct model for gender', () => {
    const boy = getPlayerModel('boy');
    assert.equal(boy.id, 'boy');
    assert.ok(boy.file.endsWith('.gltf'));
    const girl = getPlayerModel('girl');
    assert.equal(girl.id, 'girl');
    assert.ok(girl.file.endsWith('.gltf'));
});

test('getPlayerModel returns null for unknown gender', () => {
    assert.equal(getPlayerModel('unknown'), null);
    assert.equal(getPlayerModel(''), null);
});

test('PLAYER_GENDERS has exactly 2 options', () => {
    assert.equal(PLAYER_GENDERS.length, 2);
    const ids = PLAYER_GENDERS.map(g => g.id);
    assert.ok(ids.includes('boy'));
    assert.ok(ids.includes('girl'));
});

test('legacy character key migration', () => {
    storage.set('minizoo_character_id', 'female-character');
    const profile = getPlayerProfile();
    assert.equal(profile.gender, 'girl');
});

test('savePlayerProfile removes legacy key', () => {
    storage.set('minizoo_character_id', 'male-character');
    savePlayerProfile({ name: 'Bob', gender: 'boy' });
    assert.equal(storage.get('minizoo_character_id'), undefined);
});
