import { isRiverArea } from './riverMath.js';
import { MISSION_POINTS } from '../data/worldPoints.js';

// Pure placement logic for the grass field, flowers and insects. Kept free of
// three.js so it is deterministic (seeded) and unit-testable.

export const MEADOW_BOUND = 196;
export const CHUNK_SIZE = 49; // 8 x 8 chunks across the playable area

export const FLOWER_COLORS = [
    0xf6f3ea, // white
    0xffd93b, // yellow
    0xff7eb6, // pink
    0xb07cf0, // purple
    0xff9a3c, // orange
    0x6aa9ff, // blue
    0xf0515f, // red
];

export function createRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hash2(ix, iz, seed = 0) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth 2D value noise in 0..1.
export function valueNoise(x, z, seed = 0) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz, seed);
    const b = hash2(ix + 1, iz, seed);
    const c = hash2(ix, iz + 1, seed);
    const d = hash2(ix + 1, iz + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
}

const VIEW = MISSION_POINTS['tiger-view'];

function onBareGround(x, z) {
    // The worn dirt circle at the tiger viewing point stays free of plants.
    return (x - VIEW.x) ** 2 + (z - VIEW.z) ** 2 < 5.8 * 5.8;
}

// 0..1 chance that a spot is covered with grass: a mostly full lawn with a few
// thin, worn patches and no grass in the river or on bare ground.
export function meadowDensity(x, z) {
    if (isRiverArea(x, z, 0.7) || onBareGround(x, z)) return 0;
    const broad = valueNoise(x * 0.045 + 11.3, z * 0.045 - 4.7);
    const fine = valueNoise(x * 0.13, z * 0.13, 3);
    const density = 0.72 + 0.9 * (broad - 0.5) + 0.3 * (fine - 0.5);
    if (density <= 0.2) return 0;
    return density > 1 ? 1 : density;
}

function chunkIndexFor(x, z) {
    const perAxis = Math.ceil((MEADOW_BOUND * 2) / CHUNK_SIZE);
    const cx = Math.min(perAxis - 1, Math.max(0, Math.floor((x + MEADOW_BOUND) / CHUNK_SIZE)));
    const cz = Math.min(perAxis - 1, Math.max(0, Math.floor((z + MEADOW_BOUND) / CHUNK_SIZE)));
    return { cx, cz, index: cz * perAxis + cx };
}

function pushToChunk(chunks, x, z, values) {
    const { cx, cz, index } = chunkIndexFor(x, z);
    let chunk = chunks.get(index);
    if (!chunk) {
        chunk = {
            index,
            minX: -MEADOW_BOUND + cx * CHUNK_SIZE,
            minZ: -MEADOW_BOUND + cz * CHUNK_SIZE,
            items: [],
        };
        chunks.set(index, chunk);
    }
    chunk.items.push(x, z, ...values);
}

// Grass clumps on a jittered grid so they cover the ground evenly instead of
// forming random bald spots. Item layout: x, z, rotationY, scale, r, g, b.
export function generateGrassPlacements({ count, seed = 1 }) {
    const rand = createRng(seed);
    const span = MEADOW_BOUND * 2;
    const cellsPerAxis = Math.max(1, Math.ceil(Math.sqrt(count / 0.8)));
    const cell = span / cellsPerAxis;
    const chunks = new Map();
    let total = 0;

    for (let iz = 0; iz < cellsPerAxis && total < count; iz += 1) {
        for (let ix = 0; ix < cellsPerAxis && total < count; ix += 1) {
            const x = -MEADOW_BOUND + (ix + rand()) * cell;
            const z = -MEADOW_BOUND + (iz + rand()) * cell;
            const density = meadowDensity(x, z);
            if (density <= 0 || rand() > density) continue;

            const dry = valueNoise(x * 0.02 + 40, z * 0.02 + 7, 5);
            const shade = 0.82 + rand() * 0.34;
            const yellow = Math.max(0, dry - 0.45) * 0.9;
            pushToChunk(chunks, x, z, [
                rand() * Math.PI * 2,
                0.6 + density * 0.3 + rand() * 0.25,
                shade * (1 + yellow * 0.55),
                shade * (1 + yellow * 0.1),
                shade * (1 - yellow * 0.45),
            ]);
            total += 1;
        }
    }
    return { chunks: [...chunks.values()], total };
}

function flowerPatch(x, z) {
    return valueNoise(x * 0.035 + 5, z * 0.035 + 9, 11);
}

// Flowers grow in drifts of one dominant colour with a few strays, plus rare
// lone flowers. Item layout: x, z, rotationY, scale, colourIndex.
export function generateFlowerPlacements({ count, seed = 2 }) {
    const rand = createRng(seed);
    const span = MEADOW_BOUND * 2;
    const cellsPerAxis = Math.max(1, Math.ceil(Math.sqrt(count / 0.22)));
    const cell = span / cellsPerAxis;
    const chunks = new Map();
    const spots = [];
    let total = 0;

    for (let iz = 0; iz < cellsPerAxis && total < count; iz += 1) {
        for (let ix = 0; ix < cellsPerAxis && total < count; ix += 1) {
            const x = -MEADOW_BOUND + (ix + rand()) * cell;
            const z = -MEADOW_BOUND + (iz + rand()) * cell;
            if (meadowDensity(x, z) < 0.3) continue;

            const patch = flowerPatch(x, z);
            const inDrift = patch > 0.55 && rand() < Math.min(1, (patch - 0.55) / 0.12);
            if (!inDrift && rand() > 0.03) continue;

            const driftColour = Math.floor(hash2(Math.floor(x / 18), Math.floor(z / 18), 21) * FLOWER_COLORS.length);
            const colour = rand() < 0.22 ? Math.floor(rand() * FLOWER_COLORS.length) : driftColour;
            pushToChunk(chunks, x, z, [rand() * Math.PI * 2, 0.9 + rand() * 0.6, colour]);
            if (inDrift && total % 30 === 0) spots.push({ x, z });
            total += 1;
        }
    }
    return { chunks: [...chunks.values()], total, spots };
}

// A spot for an insect to settle near: close to the player, on land, preferring
// flower drifts so butterflies and bees hang around the flowers.
export function pickInsectSpot(rand, centre, flowerSpots = [], minDistance = 8, maxDistance = 60) {
    for (let attempt = 0; attempt < 8 && flowerSpots.length > 0; attempt += 1) {
        const spot = flowerSpots[Math.floor(rand() * flowerSpots.length)];
        const distance = Math.hypot(spot.x - centre.x, spot.z - centre.z);
        if (distance >= minDistance && distance <= maxDistance) return { x: spot.x, z: spot.z };
    }
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = rand() * Math.PI * 2;
        const distance = minDistance + rand() * (maxDistance - minDistance);
        const x = centre.x + Math.cos(angle) * distance;
        const z = centre.z + Math.sin(angle) * distance;
        if (Math.abs(x) > MEADOW_BOUND || Math.abs(z) > MEADOW_BOUND) continue;
        if (isRiverArea(x, z, 1)) continue;
        return { x, z };
    }
    return { x: centre.x, z: centre.z };
}
