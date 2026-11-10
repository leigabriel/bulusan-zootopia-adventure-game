import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ESSENTIAL_ASSET_PATHS } from '../src/game/utils/localAssets.js';

const publicDir = path.resolve('public');

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
    ));
}

test('every precached asset exists in public/', () => {
    const missing = ESSENTIAL_ASSET_PATHS.filter((p) => !fs.existsSync(path.join(publicDir, p)));
    assert.deepEqual(missing, []);
});

test('every external file a gltf points to exists and is precached', () => {
    const precached = new Set(ESSENTIAL_ASSET_PATHS);
    const problems = [];
    for (const file of walk(path.join(publicDir, 'models')).filter((f) => f.endsWith('.gltf'))) {
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        const uris = [...(json.buffers || []), ...(json.images || [])].map((x) => x.uri).filter((u) => u && !u.startsWith('data:'));
        for (const uri of uris) {
            const full = path.resolve(path.dirname(file), uri);
            const web = `/${path.relative(publicDir, full).split(path.sep).join('/')}`;
            if (!fs.existsSync(full)) problems.push(`missing ${web}`);
            else if (precached.has(web.replace(/scene\.bin$/, 'scene.bin')) === false) problems.push(`not precached ${web}`);
        }
    }
    assert.deepEqual(problems, []);
});

test('public/ stays small enough for a mobile download', () => {
    const total = walk(publicDir).reduce((sum, f) => sum + fs.statSync(f).size, 0);
    assert.ok(total < 20 * 1024 * 1024, `public/ is ${(total / 1048576).toFixed(1)} MB`);
});
