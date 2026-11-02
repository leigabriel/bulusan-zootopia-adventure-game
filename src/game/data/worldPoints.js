// Shared world coordinates. Terrain scatter, mission logic and tests all read
// from here so a mission point can never end up in the river or under a tree.

export const STATUE_CENTER = { x: 0, z: 0 };

export const TIGER_ENCLOSURE = { x: 145, z: 120, halfSize: 24 };

export const MISSION_POINTS = {
    barn: { x: 145, z: -155 },
    hay: { x: 132, z: -142 },
    carrot: { x: -38, z: 55 },
    river: { x: -4, z: 73 },
    windmill: { x: -125, z: -115 },
    statue: STATUE_CENTER,
    // South of the enclosure fence. The north side of the enclosure touches the
    // river, so the viewing area has to be on dry land on the south side.
    'tiger-view': { x: 145, z: 153 },
};

export const STAFF_START_POSITIONS = {
    lino: { x: -20, z: 22 },
    lina: { x: 22, z: 18 },
};

export const PLAYER_START_OFFSET = { x: 14, z: 10 };

// Areas where random scenery (trees, bushes, rocks) must not spawn.
const KEEP_CLEAR_ZONES = [
    { ...MISSION_POINTS.hay, radius: 6 },
    { ...MISSION_POINTS.carrot, radius: 6 },
    { ...MISSION_POINTS.river, radius: 6 },
    { ...MISSION_POINTS['tiger-view'], radius: 10 },
    { ...STAFF_START_POSITIONS.lino, radius: 9 },
    { ...STAFF_START_POSITIONS.lina, radius: 9 },
    {
        x: STATUE_CENTER.x + PLAYER_START_OFFSET.x,
        z: STATUE_CENTER.z + PLAYER_START_OFFSET.z,
        radius: 6,
    },
];

export function isInKeepClearZone(x, z, pad = 0) {
    return KEEP_CLEAR_ZONES.some((zone) => {
        const radius = zone.radius + pad;
        return (x - zone.x) ** 2 + (z - zone.z) ** 2 < radius * radius;
    });
}

export function isInsideTigerEnclosure(x, z, pad = 0) {
    const limit = TIGER_ENCLOSURE.halfSize + pad;
    return Math.abs(x - TIGER_ENCLOSURE.x) < limit && Math.abs(z - TIGER_ENCLOSURE.z) < limit;
}
