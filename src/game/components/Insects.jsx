import * as THREE from 'three';
import { sampleTerrainHeight } from '../utils/terrainField.js';
import { MEADOW_BOUND, createRng, pickInsectSpot } from '../utils/meadowScatter.js';

// Butterflies drifting over the flowers and bees/flies buzzing around them.
// Wings are instanced meshes whose matrices are rebuilt each frame; with a few
// dozen insects that is trivial CPU work and only a handful of draw calls.

const BUTTERFLY_COLORS = [0xff8c1a, 0xffe14d, 0xf4f4f4, 0x4aa3ff, 0xff7ab8, 0xa56cff];
const FLY_COLORS = [0xe8b923, 0xe8b923, 0x2b2b2b];
const RESPAWN_DISTANCE = 80;
const MAX_DT = 0.05;

function createButterflyWingGeometry() {
    // Left wing in body space: +x is outwards, +z is forwards.
    const geometry = new THREE.BufferGeometry();
    const v = [
        [0, 0, 0.03], [0.17, 0, 0.15], [0.22, 0, -0.02], [0.11, 0, -0.15], [0, 0, -0.05],
    ];
    const shade = [0.55, 0.95, 1, 0.8, 0.6];
    const positions = [];
    const colors = [];
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3], [0, 3, 4]]) {
        for (const i of [a, b, c]) {
            positions.push(...v[i]);
            colors.push(shade[i], shade[i], shade[i]);
        }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
}

function createFlyWingGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, 0.02, 0.1, 0, 0.05, 0.12, 0, -0.04,
        0, 0, 0.02, 0.12, 0, -0.04, 0, 0, -0.05,
    ], 3));
    return geometry;
}

const tempMatrix = new THREE.Matrix4();
const bodyMatrix = new THREE.Matrix4();
const wingLocal = new THREE.Matrix4();
const mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempEuler = new THREE.Euler();
const ZERO = new THREE.Vector3();

function angleDifference(target, current) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
}

function clampToMap(value) {
    return Math.max(-MEADOW_BOUND, Math.min(MEADOW_BOUND, value));
}

function setBodyMatrix(target, x, y, z, yaw, pitch, bank, scale) {
    tempEuler.set(pitch, yaw, bank, 'YXZ');
    tempQuaternion.setFromEuler(tempEuler);
    tempPosition.set(x, y, z);
    tempScale.set(scale, scale, scale);
    target.compose(tempPosition, tempQuaternion, tempScale);
}

function setWingMatrices(wings, index, body, flap, size) {
    tempEuler.set(0, 0, flap);
    tempQuaternion.setFromEuler(tempEuler);
    tempScale.set(size, size, size);
    wingLocal.compose(ZERO, tempQuaternion, tempScale);
    tempMatrix.multiplyMatrices(body, wingLocal);
    wings.setMatrixAt(index, tempMatrix);
    // The right wing is the left one mirrored across the body.
    tempMatrix.multiplyMatrices(body, mirror).multiply(wingLocal);
    wings.setMatrixAt(index + 1, tempMatrix);
}

export function createInsects(scene, { quality = 'medium', mobile = false, flowerSpots = [], start = { x: 0, z: 0 } } = {}) {
    const rand = createRng(33);
    const butterflyCount = mobile ? 14 : quality === 'low' ? 16 : 30;
    const flyCount = mobile ? 10 : quality === 'low' ? 12 : 22;

    const butterflyWingGeometry = createButterflyWingGeometry();
    const butterflyWingMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const butterflyWings = new THREE.InstancedMesh(butterflyWingGeometry, butterflyWingMaterial, butterflyCount * 2);

    const bodyGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.16);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2018 });
    const butterflyBodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, butterflyCount);

    const flyBodyGeometry = new THREE.IcosahedronGeometry(0.5, 0);
    const flyBodyMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const flyBodies = new THREE.InstancedMesh(flyBodyGeometry, flyBodyMaterial, flyCount);
    const flyWingGeometry = createFlyWingGeometry();
    const flyWingMaterial = new THREE.MeshBasicMaterial({
        color: 0xe8f4ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
    });
    const flyWings = new THREE.InstancedMesh(flyWingGeometry, flyWingMaterial, flyCount * 2);

    const colour = new THREE.Color();
    const butterflies = [];
    for (let i = 0; i < butterflyCount; i += 1) {
        colour.setHex(BUTTERFLY_COLORS[Math.floor(rand() * BUTTERFLY_COLORS.length)]);
        butterflyWings.setColorAt(i * 2, colour);
        butterflyWings.setColorAt(i * 2 + 1, colour);
        butterflies.push({
            x: 0, y: 1, z: 0, heading: rand() * Math.PI * 2, speed: 1, homeX: 0, homeZ: 0,
            targetX: 0, targetZ: 0, retarget: 0, altitude: 1.2, phase: rand() * 10,
            size: 0.8 + rand() * 0.7, flapRate: 8 + rand() * 4, glide: 0, bank: 0, bob: rand() * 10,
        });
    }
    const flies = [];
    for (let i = 0; i < flyCount; i += 1) {
        colour.setHex(FLY_COLORS[Math.floor(rand() * FLY_COLORS.length)]);
        flyBodies.setColorAt(i, colour);
        flies.push({
            x: 0, y: 1, z: 0, homeX: 0, homeZ: 0, goalX: 0, goalZ: 0, heading: 0, retarget: 0,
            p1: rand() * 10, p2: rand() * 10, p3: rand() * 10,
            w1: 2 + rand() * 2.5, w2: 3 + rand() * 3, w3: 1.5 + rand() * 2,
            ax: 0.8 + rand() * 1.4, az: 0.8 + rand() * 1.4, size: 0.05 + rand() * 0.025, phase: rand() * 10,
        });
    }

    for (const mesh of [butterflyWings, butterflyBodies, flyBodies, flyWings]) {
        mesh.frustumCulled = false; // positions change every frame
        mesh.matrixAutoUpdate = false;
        scene.add(mesh);
    }

    const insects = {
        butterflies, flies, butterflyWings, butterflyBodies, flyBodies, flyWings,
        flowerSpots, rand, geometries: [butterflyWingGeometry, bodyGeometry, flyBodyGeometry, flyWingGeometry],
        materials: [butterflyWingMaterial, bodyMaterial, flyBodyMaterial, flyWingMaterial],
    };

    for (const b of butterflies) relocateButterfly(insects, b, start);
    for (const f of flies) relocateFly(insects, f, start);
    return insects;
}

function relocateButterfly(insects, b, centre) {
    const spot = pickInsectSpot(insects.rand, centre, insects.flowerSpots, 6, 55);
    b.homeX = spot.x;
    b.homeZ = spot.z;
    b.x = clampToMap(spot.x + (insects.rand() - 0.5) * 6);
    b.z = clampToMap(spot.z + (insects.rand() - 0.5) * 6);
    b.targetX = b.homeX;
    b.targetZ = b.homeZ;
    b.y = sampleTerrainHeight(b.x, b.z) + 1.2;
    b.retarget = 0;
}

function relocateFly(insects, f, centre) {
    const spot = pickInsectSpot(insects.rand, centre, insects.flowerSpots, 5, 45);
    f.homeX = spot.x;
    f.homeZ = spot.z;
    f.goalX = spot.x;
    f.goalZ = spot.z;
    f.x = spot.x;
    f.z = spot.z;
    f.y = sampleTerrainHeight(spot.x, spot.z) + 1;
    f.retarget = 0;
}

function updateButterfly(insects, b, time, dt, player) {
    if (Math.hypot(b.x - player.x, b.z - player.z) > RESPAWN_DISTANCE) relocateButterfly(insects, b, player);

    b.retarget -= dt;
    if (b.retarget <= 0) {
        const angle = insects.rand() * Math.PI * 2;
        const reach = 3 + insects.rand() * 11;
        b.targetX = clampToMap(b.homeX + Math.cos(angle) * reach);
        b.targetZ = clampToMap(b.homeZ + Math.sin(angle) * reach);
        b.retarget = 2 + insects.rand() * 3.5;
        b.altitude = 0.6 + insects.rand() * 1.8;
        b.glide = insects.rand() < 0.25 ? 0.5 + insects.rand() * 0.6 : 0;
        // Drift the home point so butterflies wander across the field over time.
        b.homeX += (b.x - b.homeX) * 0.3;
        b.homeZ += (b.z - b.homeZ) * 0.3;
    }

    const wanted = Math.atan2(b.targetX - b.x, b.targetZ - b.z);
    const turn = angleDifference(wanted, b.heading);
    const maxTurn = 2.2 * dt;
    const applied = Math.max(-maxTurn, Math.min(maxTurn, turn));
    b.heading += applied;
    b.bank += ((-applied / Math.max(dt, 1e-4)) * 0.18 - b.bank) * Math.min(1, dt * 4);

    b.speed = 0.9 + 0.5 * Math.sin(time * 0.9 + b.phase);
    b.x = clampToMap(b.x + Math.sin(b.heading) * b.speed * dt);
    b.z = clampToMap(b.z + Math.cos(b.heading) * b.speed * dt);

    b.glide = Math.max(0, b.glide - dt);
    const rate = b.glide > 0 ? 2.5 : b.flapRate;
    b.bob += dt * rate * Math.PI * 2;
    const targetY = sampleTerrainHeight(b.x, b.z) + b.altitude + 0.22 * Math.sin(time * 1.9 + b.phase);
    b.y += (targetY - b.y) * Math.min(1, dt * 2.2);
}

function updateFly(insects, f, time, dt, player) {
    if (Math.hypot(f.x - player.x, f.z - player.z) > RESPAWN_DISTANCE) relocateFly(insects, f, player);

    f.retarget -= dt;
    if (f.retarget <= 0) {
        f.retarget = 5 + insects.rand() * 7;
        const spot = pickInsectSpot(insects.rand, { x: f.homeX, z: f.homeZ }, insects.flowerSpots, 2, 14);
        f.goalX = spot.x;
        f.goalZ = spot.z;
    }
    f.homeX += (f.goalX - f.homeX) * Math.min(1, dt * 0.7);
    f.homeZ += (f.goalZ - f.homeZ) * Math.min(1, dt * 0.7);

    // Overlapping sine waves give the jittery, darting path of a buzzing insect.
    const nx = f.homeX + f.ax * Math.sin(time * f.w1 + f.p1) + 0.6 * Math.sin(time * f.w2 * 1.7 + f.p2);
    const nz = f.homeZ + f.az * Math.sin(time * f.w2 + f.p2) + 0.6 * Math.sin(time * f.w1 * 1.9 + f.p1);
    const dx = nx - f.x;
    const dz = nz - f.z;
    if (dx * dx + dz * dz > 1e-6) f.heading = Math.atan2(dx, dz);
    f.x = clampToMap(nx);
    f.z = clampToMap(nz);
    f.y = sampleTerrainHeight(f.x, f.z) + 0.8 + 0.35 * Math.sin(time * f.w3 + f.p3) + 0.15 * Math.sin(time * 9 + f.p1);
    f.phase += dt * 60;
}

export function updateInsects(insects, time, rawDt, player) {
    if (!insects || !player) return;
    const dt = Math.min(rawDt, MAX_DT);
    if (dt <= 0) return;

    insects.butterflies.forEach((b, i) => {
        updateButterfly(insects, b, time, dt, player);
        const flap = 0.5 + 0.85 * Math.sin(b.bob);
        setBodyMatrix(bodyMatrix, b.x, b.y, b.z, b.heading, 0.12, b.bank, b.size);
        insects.butterflyBodies.setMatrixAt(i, bodyMatrix);
        setWingMatrices(insects.butterflyWings, i * 2, bodyMatrix, flap, 1);
    });

    insects.flies.forEach((f, i) => {
        updateFly(insects, f, time, dt, player);
        setBodyMatrix(bodyMatrix, f.x, f.y, f.z, f.heading, 0, 0, 1);
        // Bodies are unit icospheres stretched into a small oval.
        tempScale.set(f.size, f.size, f.size * 1.7);
        tempEuler.set(0, f.heading, 0);
        tempQuaternion.setFromEuler(tempEuler);
        tempPosition.set(f.x, f.y, f.z);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        insects.flyBodies.setMatrixAt(i, tempMatrix);
        const flap = 0.35 + 0.55 * Math.sin(f.phase);
        setWingMatrices(insects.flyWings, i * 2, bodyMatrix, flap, 0.9);
    });

    for (const mesh of [insects.butterflyBodies, insects.butterflyWings, insects.flyBodies, insects.flyWings]) {
        mesh.instanceMatrix.needsUpdate = true;
    }
    if (insects.butterflyWings.instanceColor) insects.butterflyWings.instanceColor.needsUpdate = true;
}

export function disposeInsects(scene, insects) {
    if (!insects) return;
    for (const mesh of [insects.butterflyWings, insects.butterflyBodies, insects.flyBodies, insects.flyWings]) {
        scene.remove(mesh);
        mesh.dispose();
    }
    insects.geometries.forEach((geometry) => geometry.dispose());
    insects.materials.forEach((material) => material.dispose());
}
