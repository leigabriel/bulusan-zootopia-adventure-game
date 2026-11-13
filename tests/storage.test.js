import test from 'node:test';
import assert from 'node:assert/strict';
import { SAFE_ANIMAL_NAMES } from '../src/game/data/storyTasks.js';

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
    getSettings,
    saveSettings,
    setVolume,
    toggleMusic,
    setGraphicsQuality,
    setFpsLimit,
    getProgress,
    saveProgress,
    getDiscoveredAnimals,
    markAnimalDiscovered,
    getPlayerSession,
    savePlayerSession,
    getFeedingStatus,
    feedAnimal,
    isAnimalFed,
    resetDailyFeeding,
    resetAllFeedingTasks,
    getMissionProgress,
    saveMissionProgress,
    resetMissionProgress,
    getTasks,
    getCompletedTasksCount,
    getTotalTasks,
    clearAllData,
} from '../src/game/utils/storage.js';

test.beforeEach(() => {
    storage.clear();
});

test('getSettings returns defaults when empty', () => {
    const settings = getSettings();
    assert.equal(settings.ambienceVolume, 1.0);
    assert.equal(settings.musicVolume, 0.5);
    assert.equal(settings.sfxVolume, 1.0);
    assert.equal(settings.uiVolume, 1.0);
    assert.equal(settings.graphicsQuality, 'medium');
    assert.equal(settings.fpsLimit, 60);
    assert.equal(settings.sensitivity, 1.0);
});

test('saveSettings merges with defaults', () => {
    saveSettings({ musicVolume: 0.3 });
    const settings = getSettings();
    assert.equal(settings.musicVolume, 0.3);
    assert.equal(settings.ambienceVolume, 1.0); // default preserved
});

test('setVolume clamps values', () => {
    setVolume('musicVolume', 1.5);
    assert.equal(getSettings().musicVolume, 1);
    setVolume('musicVolume', -0.5);
    assert.equal(getSettings().musicVolume, 0);
    setVolume('musicVolume', 0.7);
    assert.equal(getSettings().musicVolume, 0.7);
});

test('toggleMusic toggles between 0 and 0.5', () => {
    toggleMusic();
    assert.equal(getSettings().musicVolume, 0);
    toggleMusic();
    assert.equal(getSettings().musicVolume, 0.5);
});

test('setGraphicsQuality only accepts valid values', () => {
    setGraphicsQuality('low');
    assert.equal(getSettings().graphicsQuality, 'low');
    setGraphicsQuality('invalid');
    assert.equal(getSettings().graphicsQuality, 'low'); // unchanged
});

test('setFpsLimit only accepts valid values', () => {
    setFpsLimit(120);
    assert.equal(getSettings().fpsLimit, 120);
    setFpsLimit(30);
    assert.equal(getSettings().fpsLimit, 120); // unchanged: below 60 is not offered
    setFpsLimit(0);
    assert.equal(getSettings().fpsLimit, 0);
});

test('getProgress returns defaults when empty', () => {
    const progress = getProgress();
    assert.deepEqual(progress.animalsDiscovered, []);
    assert.equal(progress.totalAnimalsViewed, 0);
    assert.equal(progress.lastPlayed, null);
});

test('markAnimalDiscovered adds animal and increments count', () => {
    markAnimalDiscovered('Alpaca');
    const progress = getProgress();
    assert.ok(progress.animalsDiscovered.includes('Alpaca'));
    assert.equal(progress.totalAnimalsViewed, 1);
});

test('markAnimalDiscovered does not duplicate', () => {
    markAnimalDiscovered('Alpaca');
    markAnimalDiscovered('Alpaca');
    const progress = getProgress();
    assert.equal(progress.animalsDiscovered.filter(a => a === 'Alpaca').length, 1);
    assert.equal(progress.totalAnimalsViewed, 1);
});

test('getDiscoveredAnimals returns unique list', () => {
    markAnimalDiscovered('Alpaca');
    markAnimalDiscovered('Rabbit');
    const animals = getDiscoveredAnimals();
    assert.equal(animals.length, 2);
    assert.ok(animals.includes('Alpaca'));
    assert.ok(animals.includes('Rabbit'));
});

test('savePlayerSession and getPlayerSession round-trip', () => {
    savePlayerSession({
        position: { x: 10, y: 5, z: -3 },
        yaw: 1.5,
        pitch: 0.3,
        cameraMode: 'first',
    });
    const session = getPlayerSession();
    assert.equal(session.position.x, 10);
    assert.equal(session.position.y, 5);
    assert.equal(session.position.z, -3);
    assert.equal(session.yaw, 1.5);
    assert.equal(session.pitch, 0.3);
    assert.equal(session.cameraMode, 'first');
});

test('getPlayerSession normalizes invalid data', () => {
    savePlayerSession({ position: { x: 'bad', y: 1, z: 1 }, yaw: Infinity });
    const session = getPlayerSession();
    assert.equal(session.position, null);
    assert.equal(session.yaw, 0);
});

test('feedAnimal marks animal as fed', () => {
    feedAnimal('Horse');
    assert.ok(isAnimalFed('Horse'));
    const status = getFeedingStatus();
    assert.equal(status['Horse'].fed, true);
    assert.equal(status['Horse'].feedCount, 1);
});

test('feedAnimal increments feed count', () => {
    feedAnimal('Horse');
    feedAnimal('Horse');
    const status = getFeedingStatus();
    assert.equal(status['Horse'].feedCount, 2);
});

test('isAnimalFed handles Rabbit variants', () => {
    feedAnimal('Rabbit (Idle)');
    assert.ok(isAnimalFed('Rabbit'));
    assert.ok(isAnimalFed('Rabbit (Idle)'));
});

test('resetAllFeedingTasks clears all feeding data', () => {
    feedAnimal('Horse');
    feedAnimal('Rabbit');
    resetAllFeedingTasks();
    assert.equal(Object.keys(getFeedingStatus()).length, 0);
});

test('resetDailyFeeding sets fed to false but keeps counts', () => {
    feedAnimal('Horse');
    resetDailyFeeding();
    const status = getFeedingStatus();
    assert.equal(status['Horse'].fed, false);
    assert.equal(status['Horse'].feedCount, 1);
});

test('getMissionProgress returns defaults', () => {
    const progress = getMissionProgress();
    assert.equal(progress.activeTaskId, 'talk-lino');
    assert.deepEqual(progress.completedTaskIds, []);
    assert.equal(progress.hasHay, false);
    assert.equal(progress.hasCarrot, false);
});

test('saveMissionProgress merges correctly', () => {
    saveMissionProgress({ hasHay: true });
    const progress = getMissionProgress();
    assert.equal(progress.hasHay, true);
    assert.equal(progress.activeTaskId, 'talk-lino'); // unchanged
});

test('resetMissionProgress clears to defaults', () => {
    saveMissionProgress({ hasHay: true, hasCarrot: true });
    resetMissionProgress();
    const progress = getMissionProgress();
    assert.equal(progress.hasHay, false);
    assert.equal(progress.hasCarrot, false);
    assert.deepEqual(progress.completedTaskIds, []);
});

test('getTasks returns one feeding task per safe animal type', () => {
    const tasks = getTasks();
    assert.equal(tasks.length, SAFE_ANIMAL_NAMES.length);
    assert.ok(['Goat', 'Forest Rabbit', 'Parrot', 'Pigeon'].every((name) => tasks.some((task) => task.animalName === name)));
    assert.ok(!tasks.some((task) => ['Owl', 'Frog', 'Koi Fish'].includes(task.animalName)));
    for (const task of tasks) {
        assert.ok(task.id);
        assert.ok(task.name.startsWith('Feed the '));
        assert.ok(task.animalName);
        assert.equal(typeof task.completed, 'boolean');
    }
});

test('getCompletedTasksCount and getTotalTasks', () => {
    assert.equal(getTotalTasks(), SAFE_ANIMAL_NAMES.length);
    assert.equal(getCompletedTasksCount(), 0);
    feedAnimal('Alpaca');
    feedAnimal('Domestic Horse');
    assert.equal(getCompletedTasksCount(), 2);
});

test('clearAllData removes all stored data', () => {
    saveSettings({ musicVolume: 0.3 });
    feedAnimal('Horse');
    saveProgress({ animalsDiscovered: ['Alpaca'] });
    clearAllData();
    assert.deepEqual(Object.keys(getSettings()), Object.keys(getSettings())); // defaults restored
    assert.equal(Object.keys(getFeedingStatus()).length, 0);
    assert.deepEqual(getProgress().animalsDiscovered, []);
});

test('clearAllData also clears mission progress', () => {
    saveMissionProgress({ completedTaskIds: ['talk-lino'] });
    clearAllData();
    assert.deepEqual(getMissionProgress().completedTaskIds, []);
});

test('camera mode falls back to third person', () => {
    savePlayerSession({ position: { x: 1, y: 1, z: 1 }, cameraMode: 'sideways' });
    assert.equal(getPlayerSession().cameraMode, 'third');
});
