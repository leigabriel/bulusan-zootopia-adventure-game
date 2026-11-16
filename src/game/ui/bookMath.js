// Numbers behind the Animal Book: sizes, the page-turn angle, curl, shading and
// drag rules. Kept apart from the component so they can be tested on their own.

export const BOOK = {
    STAGE_W: 960,
    STAGE_H: 556,
    SPINE_X: 480,
    PAGE_W: 426,
    PAGE_H: 440,
    PAGE_TOP: 70,
    STRIPS: 8,
    // Ring and punched-hole centres, measured down from the top of a page.
    RING_YS: [62, 172, 282, 392],
    MAX_STACK: 12,
    MIN_STACK: 2,
    MAX_CURL_DEG: 4.5,
    MAX_SHADE: 0.34,
    DRAG_REACH: 0.85,
    FLICK_SPEED: 0.45,
    COMPLETE_AT: 0.35,
};

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function easeInOutCubic(p) {
    return p < 0.5 ? 4 * p * p * p : 1 - ((-2 * p + 2) ** 3) / 2;
}

export function easeOutCubic(p) {
    return 1 - (1 - p) ** 3;
}

// Angle is 0 when the leaf lies flat on the right and 180 when it lies on the left.
export function leafAngleForDrag(progress, direction) {
    const p = clamp(progress, 0, 1);
    return direction > 0 ? p * 180 : 180 - p * 180;
}

// How far through a turn a finger or mouse is. `travelled` is the horizontal
// movement in book pixels; dragging left turns forward, dragging right turns back.
export function turnProgressFromDrag(travelled, direction) {
    return clamp((-travelled * direction) / (BOOK.PAGE_W * BOOK.DRAG_REACH), 0, 1);
}

// A turn completes when it went far enough, or when the flick was fast enough
// in the turning direction. `velocity` is pixels per millisecond.
export function shouldCompleteTurn(progress, velocity) {
    if (velocity > BOOK.FLICK_SPEED) return true;
    if (velocity < -BOOK.FLICK_SPEED) return false;
    return progress >= BOOK.COMPLETE_AT;
}

// Extra angle between neighbouring strips. The free edge trails behind the
// spine edge, so the paper bends most in the middle of the turn.
export function curlStep(theta, direction) {
    const bend = BOOK.MAX_CURL_DEG * Math.sin((clamp(theta, 0, 180) * Math.PI) / 180);
    return -direction * bend;
}

// Darkness of a strip: flat paper is bright, paper standing on edge is darkest.
export function leafShade(angle) {
    return BOOK.MAX_SHADE * Math.abs(Math.sin((angle * Math.PI) / 180));
}

// Thickness in pixels of the paper stack beside each page. `position` runs from
// 0 (first spread) to total - 1 (last spread), and moves smoothly during a turn.
export function stackThickness(position, total, side) {
    const fraction = total > 1 ? clamp(position / (total - 1), 0, 1) : 0;
    const share = side === 'left' ? fraction : 1 - fraction;
    return BOOK.MIN_STACK + (BOOK.MAX_STACK - BOOK.MIN_STACK) * share;
}
