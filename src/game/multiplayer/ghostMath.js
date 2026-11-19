// Small pure helpers so remote players move smoothly. No three.js here, so they
// can be tested in Node.

export const TELEPORT_DISTANCE = 8;

export function shortestArc(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// Frame-rate independent easing: same result at 30 or 144 fps.
export function easeFactor(dt, speed = 10) {
    return 1 - Math.exp(-speed * Math.max(0, dt));
}

// Moves `current` toward `target`. Far away (joined, lag spike, respawn) it
// jumps instead of sliding across the zoo.
export function stepGhost(current, target, dt) {
    const dx = target.x - current.x;
    const dz = target.z - current.z;
    if (Math.hypot(dx, dz) > TELEPORT_DISTANCE) {
        return { x: target.x, y: target.y, z: target.z, yaw: target.yaw, moving: false };
    }
    const k = easeFactor(dt);
    const moving = Math.hypot(dx, dz) > 0.05;
    return {
        x: current.x + dx * k,
        y: current.y + (target.y - current.y) * k,
        z: current.z + dz * k,
        yaw: current.yaw + shortestArc(current.yaw, target.yaw) * k,
        moving,
    };
}
