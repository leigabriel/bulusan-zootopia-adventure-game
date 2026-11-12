// Pure helpers for planting props (rocks, bushes) so they sit in the ground
// instead of hovering. Resting a prop's lowest point on the terrain height at
// its centre leaves the downhill side in the air on any slope; sampling the
// whole footprint and resting on the lowest point, then sinking a little, keeps
// the prop planted on every side.

// Lowest ground height under a circular footprint (centre plus a ring).
export function lowestGroundHeight(heightAt, x, z, radius, ringSamples = 8) {
    let lowest = heightAt(x, z);
    if (radius <= 0) return lowest;
    for (let i = 0; i < ringSamples; i += 1) {
        const angle = (i / ringSamples) * Math.PI * 2;
        const h = heightAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius);
        if (h < lowest) lowest = h;
    }
    const inner = radius * 0.5;
    for (let i = 0; i < ringSamples; i += 1) {
        const angle = ((i + 0.5) / ringSamples) * Math.PI * 2;
        const h = heightAt(x + Math.cos(angle) * inner, z + Math.sin(angle) * inner);
        if (h < lowest) lowest = h;
    }
    return lowest;
}

// Footprint radius for a bounding box: slightly inside the box so thin
// protrusions do not push the prop deeper than needed.
export function footprintRadius(size, shrink = 0.45) {
    return Math.min(size.x, size.z) * shrink;
}

// World y that the bottom of a prop should sit at.
export function plantedBottomY(heightAt, centreX, centreZ, size, sinkFraction = 0.15) {
    const lowest = lowestGroundHeight(heightAt, centreX, centreZ, footprintRadius(size));
    return lowest - size.y * sinkFraction;
}
