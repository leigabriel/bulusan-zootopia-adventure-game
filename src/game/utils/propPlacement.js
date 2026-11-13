// Pure placement helpers for the hand-placed and scattered world props, kept
// free of three.js scene objects so they can be tested.

// Circles (in the prop's own units, relative to its centre) that approximate a
// prop's footprint, turned into world-space collision obstacles. The prop is
// rotated about Y like a three.js object: +rotation turns +z towards +x.
export function footprintCircles(prop, localCircles) {
    const cos = Math.cos(prop.rotation ?? 0);
    const sin = Math.sin(prop.rotation ?? 0);
    const scale = prop.scale ?? 1;
    return localCircles.map((circle) => ({
        x: prop.x + (circle.x * cos + circle.z * sin) * scale,
        z: prop.z + (-circle.x * sin + circle.z * cos) * scale,
        radius: circle.radius * scale,
    }));
}

// Picks up to `count` scatter spots. `isBlocked(x, z)` rejects bad ground and
// `minGap` keeps spots apart from each other and from `existing` points.
export function scatterPlacements({ count, rng, extent, isBlocked, minGap, existing = [], scale = [1, 1], attemptsPerItem = 40 }) {
    const picked = [];
    const gapSq = minGap * minGap;
    const farEnough = (x, z, list) => list.every((p) => (x - p.x) ** 2 + (z - p.z) ** 2 >= gapSq);
    for (let attempt = 0; attempt < count * attemptsPerItem && picked.length < count; attempt += 1) {
        const x = (rng() * 2 - 1) * extent;
        const z = (rng() * 2 - 1) * extent;
        if (isBlocked(x, z)) continue;
        if (!farEnough(x, z, existing) || !farEnough(x, z, picked)) continue;
        picked.push({
            x,
            z,
            scale: scale[0] + rng() * (scale[1] - scale[0]),
            rotation: rng() * Math.PI * 2,
        });
    }
    return picked;
}

// Local footprints, in model units.
export const FOOTPRINTS = {
    stable: [
        { x: 0, z: -3.4, radius: 3.6 },
        { x: 0, z: 0, radius: 3.7 },
        { x: 0, z: 3.4, radius: 3.6 },
    ],
    haystack: [{ x: 0, z: 0, radius: 1.0 }],
    fallenLog: [
        { x: -1.0, z: 0, radius: 0.55 },
        { x: 0, z: 0, radius: 0.55 },
        { x: 1.0, z: 0, radius: 0.55 },
    ],
    // Tree trunks are thin; only the trunk blocks the player.
    tree: [{ x: 0, z: 0, radius: 0.5 }],
    signBoard: [
        { x: -0.85, z: 0, radius: 0.22 },
        { x: 0.85, z: 0, radius: 0.22 },
    ],
};
