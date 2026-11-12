import { createRng } from './meadowScatter.js';

// Single source for where the sun is, so the light, the visible sun, the god
// rays and the water glint all agree.
export const SUN_POSITION = Object.freeze({ x: 100, y: 150, z: 80 });

const SUN_LENGTH = Math.hypot(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
export const SUN_DIRECTION = Object.freeze({
    x: SUN_POSITION.x / SUN_LENGTH,
    y: SUN_POSITION.y / SUN_LENGTH,
    z: SUN_POSITION.z / SUN_LENGTH,
});

// Clouds drift along +x and wrap around inside CLOUD_WRAP.
export const CLOUD_WRAP = 800;
export const CLOUD_LAYER = Object.freeze({ minY: 72, maxY: 108, halfDepth: 330 });

// Cloud counts and puffs per cloud for each graphics setting.
export const CLOUD_BUDGET = Object.freeze({
    low: { clouds: 8, puffs: 5 },
    medium: { clouds: 12, puffs: 7 },
    high: { clouds: 16, puffs: 8 },
});

// Each cloud is a cluster of overlapping puffs: tall in the middle, flat along
// the bottom, like a cumulus. Positions are relative to the cloud origin.
export function generateClouds({ clouds, puffs, seed = 20261112 }) {
    const rand = createRng(seed);
    const result = [];
    for (let c = 0; c < clouds; c += 1) {
        const width = 46 + rand() * 40;
        const origin = {
            x: (rand() - 0.5) * CLOUD_WRAP,
            y: CLOUD_LAYER.minY + rand() * (CLOUD_LAYER.maxY - CLOUD_LAYER.minY),
            z: (rand() * 2 - 1) * CLOUD_LAYER.halfDepth,
        };
        const items = [];
        for (let k = 0; k < puffs; k += 1) {
            const t = puffs === 1 ? 0.5 : k / (puffs - 1);
            const hump = Math.sin(Math.PI * t);
            const y = hump * (3 + rand() * 9) + rand() * 2;
            items.push({
                x: (t - 0.5) * width + (rand() - 0.5) * 6,
                y,
                z: (rand() - 0.5) * 18,
                size: 11 + hump * 12 + rand() * 6,
                shade: 0,
                phase: rand(),
            });
        }
        const maxY = Math.max(...items.map((p) => p.y), 1);
        items.forEach((p) => { p.shade = Math.min(1, p.y / maxY); });
        result.push({ origin, puffs: items });
    }
    return result;
}
