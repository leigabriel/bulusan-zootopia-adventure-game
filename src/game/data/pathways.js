// Visitor walkways. Pure geometry (no scene objects) so scenery scatter, grass
// and tests all agree on where the paths run. Every route starts at the statue
// plaza and ends at a place the story sends the player to.

export const PATH_WIDTH = 3.6;
export const PLAZA = { x: 0, z: 0, radius: 15 };

// Control points as [x, z]. They are smoothed into curves by sampleRoute. The
// route to the tiger crosses the river; the ground mesh simply leaves a gap
// where the water is, so visitors wade across and pick the path up again.
export const PATH_ROUTES = [
    {
        id: 'barn',
        points: [[11, -9], [30, -15], [52, -40], [72, -76], [88, -104], [110, -114], [128, -128], [138, -146], [144, -153]],
    },
    {
        id: 'stable',
        points: [[88, -104], [95, -111], [100, -117]],
    },
    {
        id: 'garden',
        points: [[-10, 9], [-20, 20], [-28, 38], [-37, 52]],
    },
    {
        id: 'river',
        points: [[-28, 38], [-16, 54], [-6, 66], [-4, 71]],
    },
    {
        id: 'windmill',
        points: [[-11, -9], [-30, -22], [-47, -29], [-70, -47], [-90, -63], [-105, -86], [-117, -104], [-124, -112]],
    },
    {
        id: 'tiger',
        points: [[12, 9], [36, 22], [68, 34], [98, 52], [106, 70], [108, 92], [104, 120], [110, 146], [128, 156], [144, 153]],
    },
];

// Catmull-Rom through the control points, resampled roughly every `step` units.
export function sampleRoute(points, step = 1.6) {
    const pts = points.map(([x, z]) => ({ x, z }));
    const out = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const length = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const count = Math.max(2, Math.ceil(length / step));
        for (let s = 0; s < count; s += 1) {
            const t = s / count;
            const t2 = t * t;
            const t3 = t2 * t;
            out.push({
                x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
            });
        }
    }
    const last = pts[pts.length - 1];
    out.push({ x: last.x, z: last.z });
    return out;
}

let routeSamples = null;
export function getRouteSamples() {
    if (!routeSamples) routeSamples = PATH_ROUTES.map((route) => ({ id: route.id, samples: sampleRoute(route.points) }));
    return routeSamples;
}

// Segments are bucketed into a coarse grid so per-blade grass and tree checks
// stay cheap.
const CELL = 16;
const REACH = 8;
let grid = null;

function cellKey(cx, cz) {
    return `${cx},${cz}`;
}

function buildGrid() {
    grid = new Map();
    for (const { samples } of getRouteSamples()) {
        for (let i = 0; i < samples.length - 1; i += 1) {
            const a = samples[i];
            const b = samples[i + 1];
            const segment = [a.x, a.z, b.x, b.z];
            const minX = Math.floor((Math.min(a.x, b.x) - REACH) / CELL);
            const maxX = Math.floor((Math.max(a.x, b.x) + REACH) / CELL);
            const minZ = Math.floor((Math.min(a.z, b.z) - REACH) / CELL);
            const maxZ = Math.floor((Math.max(a.z, b.z) + REACH) / CELL);
            for (let cx = minX; cx <= maxX; cx += 1) {
                for (let cz = minZ; cz <= maxZ; cz += 1) {
                    const key = cellKey(cx, cz);
                    if (!grid.has(key)) grid.set(key, []);
                    grid.get(key).push(segment);
                }
            }
        }
    }
}

// Distance from a point to the nearest path centre line or plaza edge. Values
// above REACH are only a lower bound.
export function distanceToPaths(x, z) {
    if (!grid) buildGrid();
    let best = Math.max(0, Math.hypot(x - PLAZA.x, z - PLAZA.z) - PLAZA.radius);
    const segments = grid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!segments) return Math.min(best, REACH + 1);
    for (let i = 0; i < segments.length; i += 1) {
        const [ax, az, bx, bz] = segments[i];
        const dx = bx - ax;
        const dz = bz - az;
        const lengthSq = dx * dx + dz * dz;
        const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSq)) : 0;
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t)) - PATH_WIDTH / 2;
        if (d < best) best = d;
    }
    return Math.min(best, REACH + 1);
}

// True when a point is on a path or within `pad` of its edge.
export function isNearPath(x, z, pad = 0) {
    return distanceToPaths(x, z) < pad;
}
