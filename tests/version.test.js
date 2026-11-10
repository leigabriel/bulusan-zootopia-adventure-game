import test from 'node:test';
import assert from 'node:assert/strict';
import { bumpVersion, bumpVersionName, readVersion } from '../scripts/version.mjs';

test('version name goes up by one tenth', () => {
    assert.equal(bumpVersionName('1.0'), '1.1');
    assert.equal(bumpVersionName('1.8'), '1.9');
    assert.equal(bumpVersionName('1.9'), '2.0');
    assert.equal(bumpVersionName('2.0'), '2.1');
});

test('version code always increases', () => {
    assert.deepEqual(bumpVersion({ versionName: '1.0', versionCode: 1 }), { versionName: '1.1', versionCode: 2 });
});

test('bad version names are rejected', () => {
    assert.throws(() => bumpVersionName('1'));
    assert.throws(() => bumpVersionName('v1.0'));
});

test('version.json is valid', () => {
    const version = readVersion();
    assert.match(version.versionName, /^\d+\.\d+$/);
    assert.ok(version.versionCode >= 1);
});
