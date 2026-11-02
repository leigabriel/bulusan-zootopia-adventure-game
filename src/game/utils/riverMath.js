import * as THREE from 'three';

// Pure river geometry. The river stays east of the statue and habitats, then
// bends toward the south edge. Keeping the math here (and free of scene
// objects) makes terrain, art, gameplay and tests agree on one source.
export const RIVER_POINTS = [
    [-218, 112], [-178, 101], [-135, 108], [-92, 94], [-48, 101],
    [-4, 87], [42, 98], [88, 82], [132, 91], [176, 73], [218, 82],
].map(([x, z]) => new THREE.Vector2(x, z));

export const RIVER_WIDTH = 7.2;
export const BANK_BLEND = 3.8;
export const SHORE_WIDTH = 1.6;
export const CHANNEL_DEPTH = 2.2;
export const WATER_CLEARANCE = 0.04;

const WIDTH_VARIATION = 0.7;
const SAMPLE_STEPS = 240;

export function sampleSmoothPath(t) {
    const scaled = THREE.MathUtils.clamp(t, 0, 1) * (RIVER_POINTS.length - 1);
    const index = Math.min(RIVER_POINTS.length - 2, Math.floor(scaled));
    const local = scaled - index;
    const p0 = RIVER_POINTS[Math.max(0, index - 1)];
    const p1 = RIVER_POINTS[index];
    const p2 = RIVER_POINTS[index + 1];
    const p3 = RIVER_POINTS[Math.min(RIVER_POINTS.length - 1, index + 2)];
    const t2 = local * local;
    const t3 = t2 * local;
    return new THREE.Vector2(
        0.5 * ((2 * p1.x) + (-p0.x + p2.x) * local + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * ((2 * p1.y) + (-p0.y + p2.y) * local + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    );
}

let pathCache = null;

function getPathCache() {
    if (pathCache) return pathCache;
    const count = SAMPLE_STEPS + 1;
    const xs = new Float64Array(count);
    const zs = new Float64Array(count);
    const distance = new Float64Array(count);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let travelled = 0;
    for (let step = 0; step < count; step += 1) {
        const point = sampleSmoothPath(step / SAMPLE_STEPS);
        xs[step] = point.x;
        zs[step] = point.y;
        if (step > 0) travelled += Math.hypot(point.x - xs[step - 1], point.y - zs[step - 1]);
        distance[step] = travelled;
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minZ = Math.min(minZ, point.y);
        maxZ = Math.max(maxZ, point.y);
    }
    pathCache = { xs, zs, distance, count, minX, maxX, minZ, maxZ, length: travelled };
    return pathCache;
}

export function getRiverPathLength() {
    return getPathCache().length;
}

function widthAtDistance(distance) {
    return RIVER_WIDTH + Math.sin(distance * 0.035) * WIDTH_VARIATION;
}

// Width for a 0..1 position along the path (used by the ribbon meshes).
export function riverWidthAtT(t) {
    return widthAtDistance(t * getRiverPathLength());
}

// Points farther than `margin` outside the river's bounding box cannot be near
// the water, so most of the map skips the segment scan entirely.
function isOutsideRiverBounds(x, z, margin) {
    const cache = getPathCache();
    return x < cache.minX - margin || x > cache.maxX + margin
        || z < cache.minZ - margin || z > cache.maxZ + margin;
}

// Scratch result reused between calls so hot paths allocate nothing.
const scratch = { distanceSq: Infinity, distance: 0, px: 0, pz: 0, lx: 1, lz: 0 };

function findClosest(x, z) {
    const { xs, zs, distance, count } = getPathCache();
    let bestDistanceSq = Infinity;
    for (let i = 0; i < count - 1; i += 1) {
        const ax = xs[i];
        const az = zs[i];
        const lx = xs[i + 1] - ax;
        const lz = zs[i + 1] - az;
        const rawLengthSq = lx * lx + lz * lz;
        const lengthSq = rawLengthSq > 0.0001 ? rawLengthSq : 0.0001;
        let t = ((x - ax) * lx + (z - az) * lz) / lengthSq;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + lx * t;
        const pz = az + lz * t;
        const dx = px - x;
        const dz = pz - z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq;
            scratch.distanceSq = distanceSq;
            scratch.distance = distance[i] + Math.sqrt(lengthSq) * t;
            scratch.px = px;
            scratch.pz = pz;
            scratch.lx = lx;
            scratch.lz = lz;
        }
    }
    return scratch;
}

export function getRiverMetrics(x, z) {
    const nearest = findClosest(x, z);
    const length = Math.sqrt(nearest.lx * nearest.lx + nearest.lz * nearest.lz) || 1;
    return {
        distanceSq: nearest.distanceSq,
        distance: nearest.distance,
        point: new THREE.Vector2(nearest.px, nearest.pz),
        tangent: new THREE.Vector2(nearest.lx / length, nearest.lz / length),
        lateral: Math.sqrt(nearest.distanceSq),
        width: widthAtDistance(nearest.distance),
    };
}

export function getRiverTerrainOffset(x, z) {
    if (isOutsideRiverBounds(x, z, RIVER_WIDTH + WIDTH_VARIATION + BANK_BLEND)) return 0;

    const nearest = findClosest(x, z);
    const lateral = Math.sqrt(nearest.distanceSq);
    const width = widthAtDistance(nearest.distance);
    const edge = width + BANK_BLEND;
    if (lateral >= edge) return 0;

    const centerBlend = 1 - THREE.MathUtils.smoothstep(lateral, width, edge);

    // Natural variation in the riverbed depth.
    const bedNoise = (Math.sin(x * 0.4) * Math.cos(z * 0.4) * 0.2)
        + (Math.sin(x * 0.1) * 0.15);

    return (-CHANNEL_DEPTH + bedNoise) * centerBlend;
}

export function isRiverArea(x, z, padding = 0) {
    if (isOutsideRiverBounds(x, z, RIVER_WIDTH + WIDTH_VARIATION + Math.max(0, padding))) return false;
    const nearest = findClosest(x, z);
    return Math.sqrt(nearest.distanceSq) < widthAtDistance(nearest.distance) + padding;
}

export function isLandAccessible(x, z, radius = 0) {
    return !isRiverArea(x, z, radius);
}

export function findAccessiblePosition(x, z, radius = 0) {
    if (isLandAccessible(x, z, radius)) return { x, z };
    const metrics = getRiverMetrics(x, z);
    const push = metrics.width + radius + 1.5;
    return { x: metrics.point.x + metrics.tangent.y * push, z: metrics.point.y - metrics.tangent.x * push };
}
