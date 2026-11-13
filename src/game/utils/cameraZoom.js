// Third-person camera zoom. Pure helpers so limits, input handling and the
// collision pull-in can be tested without a scene.

// Multiplier on the default follow distance and height.
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.8;
export const ZOOM_DEFAULT = 1;
export const ZOOM_BUTTON_STEP = 0.2;

// The camera never ends up closer to the player's focus point than this, so it
// cannot sit inside the character.
export const MIN_CAMERA_OFFSET = 2.4;
export const CAMERA_CLEARANCE = 0.9;

const WHEEL_SENSITIVITY = 0.0012;
const COLLISION_SAMPLES = 10;

export function clampZoom(value) {
    if (!Number.isFinite(value)) return ZOOM_DEFAULT;
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function isAtZoomLimit(value, direction) {
    return direction > 0 ? value <= ZOOM_MIN + 1e-6 : value >= ZOOM_MAX - 1e-6;
}

// Wheel: scrolling up (negative deltaY) moves the camera closer. `deltaMode`
// 1 means lines rather than pixels.
export function zoomFromWheel(value, deltaY, deltaMode = 0) {
    const pixels = deltaMode === 1 ? deltaY * 16 : deltaY;
    return clampZoom(value * Math.exp(pixels * WHEEL_SENSITIVITY));
}

// Pinch: fingers moving apart (distance grows) moves the camera closer.
export function zoomFromPinch(value, previousDistance, distance) {
    if (!(previousDistance > 0) || !(distance > 0)) return clampZoom(value);
    return clampZoom(value * (previousDistance / distance));
}

// Buttons: direction +1 zooms in (closer), -1 zooms out.
export function zoomFromButton(value, direction) {
    return clampZoom(value - direction * ZOOM_BUTTON_STEP);
}

// Frame-rate independent ease toward the target; no jumps, never overshoots.
export function easeZoom(current, target, dt, rate = 9) {
    const blend = 1 - Math.exp(-rate * Math.max(0, dt));
    const next = current + (target - current) * blend;
    return Math.abs(target - next) < 0.0005 ? target : next;
}

// How much of the desired camera offset (0..1) is free of terrain and
// obstacles. Walks the line from `focus` to `desired`; the first sample that is
// below the ground or inside an obstacle ends it.
export function freeCameraFraction(focus, desired, terrainHeight, obstacles = []) {
    const dx = desired.x - focus.x;
    const dy = desired.y - focus.y;
    const dz = desired.z - focus.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return 1;
    const minFraction = Math.min(1, MIN_CAMERA_OFFSET / length);

    for (let i = 1; i <= COLLISION_SAMPLES; i += 1) {
        const t = i / COLLISION_SAMPLES;
        const x = focus.x + dx * t;
        const y = focus.y + dy * t;
        const z = focus.z + dz * t;
        let blocked = y < terrainHeight(x, z) + CAMERA_CLEARANCE;
        if (!blocked) {
            for (let o = 0; o < obstacles.length; o += 1) {
                const obstacle = obstacles[o];
                const reach = obstacle.radius + 0.4;
                const fx = focus.x - obstacle.x;
                const fz = focus.z - obstacle.z;
                // The player already stands against this obstacle: ignore it.
                if (fx * fx + fz * fz < (reach + 0.8) * (reach + 0.8)) continue;
                const ox = x - obstacle.x;
                const oz = z - obstacle.z;
                if (ox * ox + oz * oz < reach * reach) {
                    blocked = true;
                    break;
                }
            }
        }
        if (blocked) {
            return Math.max(minFraction, (i - 1) / COLLISION_SAMPLES);
        }
    }
    return 1;
}

// Snap in quickly when something is in the way, drift back out slowly.
export function easeCollisionFraction(current, target, dt) {
    const rate = target < current ? 22 : 2.5;
    return current + (target - current) * (1 - Math.exp(-rate * Math.max(0, dt)));
}
