import { getRiverTerrainOffset } from './riverMath.js';

// Pure terrain height field. The rendered mesh and every "stand on the ground"
// calculation (player, animals, NPCs, scenery) read the same sampled grid, so
// feet follow the visible triangles instead of a smoother analytic curve that
// the low-poly mesh never actually matches (the river banks were the worst case).
export const TERRAIN_SIZE = 500;
export const TERRAIN_SEGMENTS = 220;

const HALF = TERRAIN_SIZE / 2;
const CELL = TERRAIN_SIZE / TERRAIN_SEGMENTS;
const STRIDE = TERRAIN_SEGMENTS + 1;

export function computeTerrainHeight(x, z) {
    // Broad, overlapping waves keep the low-poly terrain smooth while adding
    // enough variation to distinguish hills, valleys, and flatter areas.
    const broadHills = Math.sin(x * 0.009 + Math.cos(z * 0.007)) * 5.2;
    const rollingHills = Math.sin(x * 0.019) * 2.4 + Math.cos(z * 0.017 + 0.8) * 2.2;
    const softDetail = Math.sin(x * 0.032 + z * 0.021) * 0.65;
    return broadHills + rollingHills + softDetail + getRiverTerrainOffset(x, z);
}

let grid = null;

// Heights at every mesh vertex. Row `iy` is world z = -HALF + iy * CELL, which
// is the vertex order of a PlaneGeometry rotated flat (local +Y maps to -Z).
export function getTerrainGrid() {
    if (grid) return grid;
    grid = new Float32Array(STRIDE * STRIDE);
    for (let iy = 0; iy < STRIDE; iy += 1) {
        const z = -HALF + iy * CELL;
        for (let ix = 0; ix < STRIDE; ix += 1) {
            grid[iy * STRIDE + ix] = computeTerrainHeight(-HALF + ix * CELL, z);
        }
    }
    return grid;
}

// Height of the rendered surface. Uses the same triangle split as three.js
// PlaneGeometry (diagonal from (x0,z1) to (x1,z0)); outside the mesh it falls
// back to the analytic field.
export function sampleTerrainHeight(x, z) {
    const u = (x + HALF) / CELL;
    const v = (z + HALF) / CELL;
    if (!(u >= 0 && v >= 0 && u <= TERRAIN_SEGMENTS && v <= TERRAIN_SEGMENTS)) {
        return computeTerrainHeight(x, z);
    }
    const heights = getTerrainGrid();
    const ix = u >= TERRAIN_SEGMENTS ? TERRAIN_SEGMENTS - 1 : Math.floor(u);
    const iy = v >= TERRAIN_SEGMENTS ? TERRAIN_SEGMENTS - 1 : Math.floor(v);
    const fx = u - ix;
    const fy = v - iy;
    const base = iy * STRIDE + ix;
    const hA = heights[base];
    const hB = heights[base + STRIDE];
    const hC = heights[base + STRIDE + 1];
    const hD = heights[base + 1];
    if (fx + fy <= 1) return hA + (hD - hA) * fx + (hB - hA) * fy;
    return hC + (hB - hC) * (1 - fx) + (hD - hC) * (1 - fy);
}
