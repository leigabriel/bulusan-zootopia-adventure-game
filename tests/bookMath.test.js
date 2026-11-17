import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BOOK, clamp, curlStep, easeInOutCubic, easeOutCubic, leafAngleForDrag,
    leafShade, shouldCompleteTurn, stackThickness, turnProgressFromDrag,
} from '../src/game/ui/bookMath.js';

test('two pages meet at the spine and fit on the stage', () => {
    assert.ok(BOOK.SPINE_X - BOOK.PAGE_W > 0);
    assert.ok(BOOK.SPINE_X + BOOK.PAGE_W < BOOK.STAGE_W);
    assert.ok(BOOK.PAGE_TOP + BOOK.PAGE_H < BOOK.STAGE_H);
    assert.equal(BOOK.SPINE_X * 2, BOOK.STAGE_W);
});

test('easing starts at 0, ends at 1 and never goes backwards', () => {
    for (const ease of [easeInOutCubic, easeOutCubic]) {
        assert.equal(ease(0), 0);
        assert.equal(ease(1), 1);
        let last = 0;
        for (let i = 1; i <= 20; i += 1) {
            const value = ease(i / 20);
            assert.ok(value >= last);
            last = value;
        }
    }
});

test('dragging left turns forward and dragging right turns back', () => {
    assert.equal(turnProgressFromDrag(-BOOK.PAGE_W, 1), 1);
    assert.equal(turnProgressFromDrag(BOOK.PAGE_W, -1), 1);
    assert.equal(turnProgressFromDrag(40, 1), 0);
    assert.equal(turnProgressFromDrag(-40, -1), 0);
    assert.ok(turnProgressFromDrag(-100, 1) > 0 && turnProgressFromDrag(-100, 1) < 1);
});

test('leaf angle runs 0 to 180 forward and 180 to 0 backward', () => {
    assert.equal(leafAngleForDrag(0, 1), 0);
    assert.equal(leafAngleForDrag(1, 1), 180);
    assert.equal(leafAngleForDrag(0, -1), 180);
    assert.equal(leafAngleForDrag(1, -1), 0);
    assert.equal(leafAngleForDrag(2, 1), 180);
});

test('a turn completes when far enough or flicked, and cancels on a back flick', () => {
    assert.equal(shouldCompleteTurn(0.5, 0), true);
    assert.equal(shouldCompleteTurn(0.1, 0), false);
    assert.equal(shouldCompleteTurn(0.1, BOOK.FLICK_SPEED + 0.1), true);
    assert.equal(shouldCompleteTurn(0.9, -(BOOK.FLICK_SPEED + 0.1)), false);
});

test('curl is zero when the leaf is flat and largest mid-turn, and flips with direction', () => {
    assert.ok(Math.abs(curlStep(0, 1)) < 1e-9);
    assert.ok(Math.abs(curlStep(180, 1)) < 1e-9);
    assert.ok(Math.abs(curlStep(90, 1)) > Math.abs(curlStep(30, 1)));
    assert.equal(curlStep(90, 1), -curlStep(90, -1));
    assert.ok(Math.abs(curlStep(90, 1)) <= BOOK.MAX_CURL_DEG + 1e-9);
});

test('shade is lightest when flat and darkest on edge', () => {
    assert.ok(leafShade(0) < 1e-9);
    assert.ok(Math.abs(leafShade(90) - BOOK.MAX_SHADE) < 1e-9);
    assert.ok(leafShade(180) < 1e-9);
});

test('paper stacks grow on the side the pages move to', () => {
    const total = 17;
    assert.equal(stackThickness(0, total, 'left'), BOOK.MIN_STACK);
    assert.equal(stackThickness(0, total, 'right'), BOOK.MAX_STACK);
    assert.equal(stackThickness(total - 1, total, 'left'), BOOK.MAX_STACK);
    assert.equal(stackThickness(total - 1, total, 'right'), BOOK.MIN_STACK);
    const mid = stackThickness(8, total, 'left') + stackThickness(8, total, 'right');
    assert.ok(Math.abs(mid - (BOOK.MIN_STACK + BOOK.MAX_STACK)) < 1e-9);
    assert.equal(clamp(5, 0, 3), 3);
});
