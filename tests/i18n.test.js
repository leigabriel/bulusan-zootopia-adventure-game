import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import TAGALOG from '../src/game/i18n/tagalog.js';
import { t, normalizeLanguage, detectLanguage, hasTranslation } from '../src/game/i18n/index.js';
import { STORY_TASKS, STORY_DIALOGUE } from '../src/game/data/storyTasks.js';
import { ANIMAL_METADATA } from '../src/game/data/animalMetadata.js';

test('t returns English when language is en', () => {
    assert.equal(t('Settings', null, 'en'), 'Settings');
});

test('t returns Tagalog when a translation exists', () => {
    assert.equal(t('Settings', null, 'tl'), 'Mga Setting');
});

test('t falls back to English for unknown lines', () => {
    assert.equal(t('No such line anywhere', null, 'tl'), 'No such line anywhere');
});

test('t fills placeholders in both languages', () => {
    assert.equal(t('Task {number} of {total}', { number: 2, total: 30 }, 'en'), 'Task 2 of 30');
    assert.equal(t('Task {number} of {total}', { number: 2, total: 30 }, 'tl'), 'Gawain 2 sa 30');
});

test('normalizeLanguage and detectLanguage', () => {
    assert.equal(normalizeLanguage('tl'), 'tl');
    assert.equal(normalizeLanguage('fr'), 'en');
    assert.equal(detectLanguage({ language: 'fil-PH' }), 'tl');
    assert.equal(detectLanguage({ language: 'tl' }), 'tl');
    assert.equal(detectLanguage({ language: 'en-US' }), 'en');
});

test('every placeholder in an English line is kept in its Tagalog line', () => {
    for (const [en, tl] of Object.entries(TAGALOG)) {
        const a = (en.match(/\{\w+\}/g) || []).sort().join();
        const b = (tl.match(/\{\w+\}/g) || []).sort().join();
        assert.equal(b, a, `placeholder mismatch: ${en}`);
    }
});

test('story task text has Tagalog', () => {
    for (const task of STORY_TASKS) {
        assert.ok(hasTranslation(task.title), `no Tagalog title: ${task.title}`);
        assert.ok(hasTranslation(task.instruction), `no Tagalog instruction: ${task.instruction}`);
    }
});

test('story dialogue has Tagalog', () => {
    const lines = JSON.stringify(STORY_DIALOGUE).match(/"([^"\\]|\\.)*"/g) || [];
    for (const raw of lines) {
        const text = JSON.parse(raw);
        if (/\s/.test(text) && /[A-Za-z]/.test(text) && text.length > 12) {
            assert.ok(hasTranslation(text), `no Tagalog dialogue: ${text}`);
        }
    }
});

test('animal book text has Tagalog', () => {
    for (const a of ANIMAL_METADATA) {
        for (const key of ['name', 'habitat', 'diet', 'fact', 'description']) {
            assert.ok(hasTranslation(a[key]), `no Tagalog ${key}: ${a[key]}`);
        }
    }
});

test('animal portraits exist for every animal', () => {
    for (const a of ANIMAL_METADATA) {
        assert.ok(a.picture, `no picture for ${a.name}`);
        const file = `public/images/animals/${a.picture}.webp`;
        assert.ok(fs.existsSync(file), `missing ${file}`);
    }
});
