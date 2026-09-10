import test from 'node:test';
import assert from 'node:assert/strict';
import { completeActiveStoryTask, DEFAULT_STORY_PROGRESS, normalizeStoryProgress, STORY_TASKS } from '../src/game/data/storyTasks.js';

test('story contains exactly 30 stable sequential tasks', () => {
    assert.equal(STORY_TASKS.length, 30);
    assert.equal(new Set(STORY_TASKS.map(({ id }) => id)).size, 30);
    assert.deepEqual(STORY_TASKS.map(({ number }) => number), Array.from({ length: 30 }, (_, index) => index + 1));
});

test('locked and duplicate tasks cannot complete', () => {
    const locked = completeActiveStoryTask(DEFAULT_STORY_PROGRESS, 'reach-barn');
    assert.equal(locked.completedTaskIds.length, 0);
    const first = completeActiveStoryTask(DEFAULT_STORY_PROGRESS, 'talk-lino');
    assert.equal(first.activeTaskId, 'reach-barn');
    assert.deepEqual(completeActiveStoryTask(first, 'talk-lino'), first);
});

test('old mission flags migrate to a valid completed prefix', () => {
    const migrated = normalizeStoryProgress({ talkedToRanger: true, fedHorse: true, fedRabbit: false });
    assert.equal(migrated.activeTaskId, 'return-lino-horse');
    assert.equal(migrated.completedTaskIds.length, 5);
    assert.equal('foundCarrot' in migrated, false);
});

test('malformed saves use safe defaults', () => {
    const normalized = normalizeStoryProgress({ completedTaskIds: 'bad', photoAnimals: [null, 'Alpaca', 'Alpaca'], observationMs: -20 });
    assert.equal(normalized.activeTaskId, 'talk-lino');
    assert.deepEqual(normalized.photoAnimals, ['Alpaca']);
    assert.equal(normalized.observationMs, 0);
});
