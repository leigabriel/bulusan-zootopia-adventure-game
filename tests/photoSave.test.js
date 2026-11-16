import test from 'node:test';
import assert from 'node:assert/strict';
import { dataUrlToBase64, photoFileName, savePhotoToDevice } from '../src/game/utils/photoSave.js';

const URL_PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('file name is stamped, numbered and png', () => {
    assert.match(photoFileName(new Date('2026-01-02T03:04:05.678Z')), /^bulusan-zoo-adventure-2026-01-02T03-04-05-678-\d{3}\.png$/);
});

test('two photos in the same instant get different names', () => {
    const moment = new Date('2026-01-02T03:04:05.000Z');
    assert.notEqual(photoFileName(moment), photoFileName(moment));
});

test('browser always downloads, even on touch devices that can share', async () => {
    const clicks = [];
    let shared = false;
    const win = {
        navigator: { maxTouchPoints: 5, canShare: () => true, share: async () => { shared = true; } },
        URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
        setTimeout: () => {},
        document: { body: { appendChild: () => {} }, createElement: () => ({ click() { clicks.push(this.download); }, remove() {} }) },
    };
    const res = await savePhotoToDevice(URL_PNG, win);
    assert.equal(res.method, 'download');
    assert.equal(shared, false);
    assert.equal(clicks.length, 1);
});

test('extracts base64 payload', () => {
    assert.equal(dataUrlToBase64(URL_PNG), 'iVBORw0KGgo=');
    assert.equal(dataUrlToBase64('nope'), '');
});

test('uses android bridge when present', async () => {
    let args;
    const win = { AndroidPhotoSaver: { savePng: (n, b) => { args = [n, b]; return true; } } };
    const res = await savePhotoToDevice(URL_PNG, win);
    assert.equal(res.ok, true);
    assert.equal(res.method, 'android');
    assert.equal(args[1], 'iVBORw0KGgo=');
});

test('android bridge refusal reports permission hint', async () => {
    const res = await savePhotoToDevice(URL_PNG, { AndroidPhotoSaver: { savePng: () => false } });
    assert.equal(res.ok, false);
    assert.match(res.message, /permission/i);
});

test('browser path downloads through a blob link', async () => {
    const clicks = [];
    const win = {
        navigator: { maxTouchPoints: 0 },
        URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
        setTimeout: () => {},
        document: {
            body: { appendChild: () => {} },
            createElement: () => ({ click() { clicks.push(this.download); }, remove() {} }),
        },
    };
    const res = await savePhotoToDevice(URL_PNG, win);
    assert.equal(res.method, 'download');
    assert.equal(clicks.length, 1);
    assert.match(clicks[0], /\.png$/);
});

test('empty photo is rejected', async () => {
    assert.equal((await savePhotoToDevice('', {})).ok, false);
});
