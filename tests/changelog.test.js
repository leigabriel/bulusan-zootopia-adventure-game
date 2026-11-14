import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    parseSubject, groupSubjects, renderEntry, applyRelease, CURRENT_START, CURRENT_END, ENTRIES_MARKER,
} from '../scripts/changelog.mjs';
import { readVersion } from '../scripts/version.mjs';

test('commit subjects map to changelog sections', () => {
    assert.deepEqual(parseSubject('feat(bridge): add footbridge'), { section: 'Added', text: 'bridge: Add footbridge' });
    assert.deepEqual(parseSubject('fix: monkey no longer slides'), { section: 'Fixed', text: 'Monkey no longer slides' });
    assert.equal(parseSubject('remove(assets): delete old bird models').section, 'Removed');
    assert.equal(parseSubject('style(ui): move feed button').section, 'Changed');
});

test('housekeeping and merge commits are skipped', () => {
    assert.equal(parseSubject('chore: release 2.8 [skip ci]'), null);
    assert.equal(parseSubject('test(bridge): cover rails'), null);
    assert.equal(parseSubject('merge: game-test into master'), null);
    assert.equal(parseSubject('not a conventional subject'), null);
});

test('duplicate subjects are listed once', () => {
    const groups = groupSubjects(['feat: add x', 'feat: add x', 'fix: y']);
    assert.deepEqual(groups.get('Added'), ['Add x']);
    assert.deepEqual(groups.get('Fixed'), ['Y']);
});

test('an entry lists only sections that have changes', () => {
    const entry = renderEntry({ versionName: '2.9', versionCode: 20, date: '2026-11-16', subjects: ['feat: add x', 'fix: y'] });
    assert.match(entry, /^## 2\.9 \(2026-11-16\)/);
    assert.match(entry, /### Added\n- Add x/);
    assert.match(entry, /### Fixed\n- Y/);
    assert.doesNotMatch(entry, /### Removed/);
});

test('a release updates the current version and adds a section once', () => {
    const base = `# Changelog\n\n${CURRENT_START}\n**Current version: 2.8** (version code 19, released 2026-11-15)\n${CURRENT_END}\n\n${ENTRIES_MARKER}\n\n## Old\n`;
    const release = { versionName: '2.9', versionCode: 20, date: '2026-11-16', subjects: ['feat: add x'] };
    const next = applyRelease(base, release);
    assert.match(next, /\*\*Current version: 2\.9\*\* \(version code 20, released 2026-11-16\)/);
    assert.ok(next.indexOf('## 2.9') < next.indexOf('## Old'));
    assert.equal(applyRelease(next, release), next);
});

test('CHANGELOG.md shows the current version and has its markers', () => {
    const text = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    for (const marker of [CURRENT_START, CURRENT_END, ENTRIES_MARKER]) assert.ok(text.includes(marker));
    const shown = /\*\*Current version: (\d+\.\d+)\*\*/.exec(text)?.[1];
    assert.equal(shown, readVersion().versionName);
});
