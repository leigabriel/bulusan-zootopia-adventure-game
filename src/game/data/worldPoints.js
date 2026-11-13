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

// Hand-placed props. The stable and haystacks sit by the barn farm, the parrot
// run in the open meadow west of the statue, and the safety board beside the
// path from the start point, turned to face it.
export const WORLD_PROPS = {
    stable: { x: 100, z: -138, rotation: 0.12, scale: 1.7 },
    parrotRun: { x: -55, z: -42, rotation: 0, scale: 3.2 },
    signBoard: { x: 30, z: -8, scale: 3 },
    haystacks: [
        { x: 160, z: -138, rotation: 0.4, scale: 1.8 },
        { x: 126, z: -168, rotation: 2.1, scale: 1.8 },
        { x: 114, z: -121, rotation: 1.1, scale: 1.6 },
    ],
};

// Birds that live under the parrot run, as offsets from its centre (world units).
export const PARROT_RUN_RESIDENTS = {
    parrot: [{ x: -2.2, z: 1.0, angle: 0.7 }],
    pigeon: [{ x: 2.6, z: -1.6, angle: -0.8 }, { x: 1.4, z: 2.4, angle: 2.5 }],
    owl: [{ x: 0.2, z: -2.6, angle: 0.3 }],
};

export function getSignBoardRotation(start = { x: STATUE_CENTER.x + PLAYER_START_OFFSET.x, z: STATUE_CENTER.z + PLAYER_START_OFFSET.z }) {
    const { x, z } = WORLD_PROPS.signBoard;
    return Math.atan2(start.x - x, start.z - z);
}

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
    { ...WORLD_PROPS.stable, radius: 14 },
    { ...WORLD_PROPS.parrotRun, radius: 10 },
    { ...WORLD_PROPS.signBoard, radius: 7 },
    ...WORLD_PROPS.haystacks.map((hay) => ({ x: hay.x, z: hay.z, radius: 4 })),
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
