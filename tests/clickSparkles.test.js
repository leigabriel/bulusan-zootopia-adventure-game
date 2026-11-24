import test from 'node:test';
import assert from 'node:assert/strict';
import { isDefaultCursor } from '../src/game/utils/clickSparkles.js';

test('default cursor detected, others rejected', () => {
    assert.equal(isDefaultCursor('url("http://x/cursors/cursor-default.svg") 2 1, default'), true);
    assert.equal(isDefaultCursor('default'), true);
    assert.equal(isDefaultCursor('auto'), true);
    assert.equal(isDefaultCursor('url("http://x/cursors/cursor-pointer.svg") 16 2, pointer'), false);
    assert.equal(isDefaultCursor('url("http://x/cursors/cursor-grabbing.svg") 20 14, grab'), false);
    assert.equal(isDefaultCursor('text'), false);
    assert.equal(isDefaultCursor(''), false);
});
