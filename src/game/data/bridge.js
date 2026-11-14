import { getRiverMetrics, RIVER_CROSSING } from '../utils/riverMath.js';
import { sampleTerrainHeight } from '../utils/terrainField.js';

// Footbridge over the creek where the tiger path crosses it. Pure geometry (no
// scene objects) so the model placement, walking height and sound all agree.
//
// The model (creek-footbridge.glb) is 4 m long along +x, 1.92 m wide, with a
// gently arched deck. It is stretched to span the narrowed creek.
export const BRIDGE_SCALE = { x: 2.5, y: 1.3, z: 1.8 };
const MODEL_HALF_LENGTH = 2;
const MODEL_HALF_WIDTH = 0.96;
// Deck height along the model's length: an arch from 0.295 at the ends to 0.5.
const DECK_END = 0.295;
const DECK_RISE = 0.205;
// Keeps the player off the rails.
const RAIL_MARGIN = 0.3;
// A little extra reach so a player stepping onto the ends is picked up.
const END_REACH = 0.1;

export const BRIDGE_HALF_LENGTH = MODEL_HALF_LENGTH * BRIDGE_SCALE.x;
export const BRIDGE_HALF_WIDTH = MODEL_HALF_WIDTH * BRIDGE_SCALE.z;

let frame = null;

// Centre, direction along the bridge (across the creek) and base height.
export function getBridgeFrame() {
    if (frame) return frame;
    const metrics = getRiverMetrics(RIVER_CROSSING.x, RIVER_CROSSING.z);
    const cx = metrics.point.x;
    const cz = metrics.point.y;
    // Across the creek = perpendicular to the river's direction.
    const ax = -metrics.tangent.y;
    const az = metrics.tangent.x;
    const endA = sampleTerrainHeight(cx - ax * BRIDGE_HALF_LENGTH, cz - az * BRIDGE_HALF_LENGTH);
    const endB = sampleTerrainHeight(cx + ax * BRIDGE_HALF_LENGTH, cz + az * BRIDGE_HALF_LENGTH);
    // The deck ends rest on the banks, so the base sits where they meet.
    const baseY = (endA + endB) / 2 + 0.04 - DECK_END * BRIDGE_SCALE.y;
    frame = { x: cx, z: cz, ax, az, yaw: Math.atan2(-az, ax), baseY };
    return frame;
}

// Position of a world point relative to the bridge: `along` its length,
// `lateral` across its width.
export function getBridgeLocal(x, z) {
    const f = getBridgeFrame();
    const dx = x - f.x;
    const dz = z - f.z;
    return { along: dx * f.ax + dz * f.az, lateral: -dx * f.az + dz * f.ax };
}

export function getBridgeDeckHeight(x, z) {
    const { along, lateral } = getBridgeLocal(x, z);
    if (Math.abs(along) > BRIDGE_HALF_LENGTH + END_REACH || Math.abs(lateral) > BRIDGE_HALF_WIDTH) return null;
    const u = Math.min(1, Math.abs(along) / BRIDGE_HALF_LENGTH);
    return getBridgeFrame().baseY + (DECK_END + DECK_RISE * (1 - u * u)) * BRIDGE_SCALE.y;
}

export function isOnBridgeDeck(x, z) {
    return getBridgeDeckHeight(x, z) !== null;
}

// Pulls a point that is standing on the deck back inside the rails.
export function clampToBridgeRails(x, z) {
    const { along, lateral } = getBridgeLocal(x, z);
    const limit = BRIDGE_HALF_WIDTH - RAIL_MARGIN;
    if (Math.abs(along) > BRIDGE_HALF_LENGTH - 0.2 || Math.abs(lateral) <= limit) return null;
    const f = getBridgeFrame();
    const clamped = Math.sign(lateral) * limit;
    const shift = clamped - lateral;
    return { x: x - f.az * shift, z: z + f.ax * shift };
}
