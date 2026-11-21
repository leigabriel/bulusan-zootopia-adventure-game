import * as THREE from 'three';

// On-screen quest waypoint, as in RPGs: a pin over the target when it is in
// view, and an arrow pinned to the screen edge pointing at it when it is not.

const EDGE_X = 0.86; // fraction of half-width the arrow may reach
const EDGE_TOP = 0.68; // keeps clear of the top HUD (menu, tasks, players)
const EDGE_BOTTOM = 0.74; // keeps clear of the bottom controls
const HIDE_NEAR = 5.5; // metres: the world marker is enough up close

// ndcX/ndcY are projected coordinates (-1..1, y up). `behind` is true when the
// target is behind the camera, which mirrors the direction. Returns the
// position in ndc, the arrow angle in radians (0 = right, counter-clockwise
// in screen space) and whether the target is in view.
export function placeWaypoint(ndcX, ndcY, behind) {
    let x = behind ? -ndcX : ndcX;
    let y = behind ? -ndcY : ndcY;
    const inView = !behind && Math.abs(x) <= EDGE_X && y <= EDGE_TOP && y >= -EDGE_BOTTOM;
    if (!inView) {
        if (Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4) y = -1; // straight behind: point down
        const limitY = y >= 0 ? EDGE_TOP : EDGE_BOTTOM;
        const scale = Math.min(EDGE_X / Math.max(Math.abs(x), 1e-6), limitY / Math.max(Math.abs(y), 1e-6));
        const angle = Math.atan2(y, x);
        x *= scale;
        y *= scale;
        return { x, y, angle, inView: false };
    }
    return { x, y, angle: 0, inView: true };
}

const point = new THREE.Vector3();

export function updateWaypointHud(el, target, camera, playerPosition, visible) {
    if (!el) return;
    if (!target || !visible || !camera) {
        if (el.style.display !== 'none') el.style.display = 'none';
        return;
    }
    const distance = Math.hypot(playerPosition.x - target.x, playerPosition.z - target.z);
    if (distance < HIDE_NEAR) {
        if (el.style.display !== 'none') el.style.display = 'none';
        return;
    }
    point.set(target.x, (target.y ?? 0) + 4.2, target.z);
    const toTarget = point.clone().sub(camera.position);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const behind = toTarget.dot(forward) <= 0;
    point.project(camera);
    const placed = placeWaypoint(point.x, point.y, behind);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const px = (placed.x * 0.5 + 0.5) * width;
    const py = (0.5 - placed.y * 0.5) * height;
    if (el.style.display !== 'block') el.style.display = 'block';
    el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
    const arrow = el.querySelector('[data-wp="arrow"]');
    const pin = el.querySelector('[data-wp="pin"]');
    const label = el.querySelector('[data-wp="label"]');
    if (arrow) {
        arrow.style.display = placed.inView ? 'none' : 'block';
        // The arrow art points right; screen y grows downward, so negate.
        arrow.style.transform = `translate(-50%, -50%) rotate(${(-placed.angle).toFixed(3)}rad)`;
    }
    if (pin) pin.style.display = placed.inView ? 'block' : 'none';
    if (label) label.textContent = `${Math.round(distance)} m`;
}
