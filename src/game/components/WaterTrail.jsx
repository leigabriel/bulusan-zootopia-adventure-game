import * as THREE from 'three';
import { getWaterDepth } from './River.jsx';
import { WADE_START_DEPTH } from '../utils/riverMath.js';

// Water trail: while the player wades, expanding ripple rings spread across the
// surface behind them and a few droplets splash up from each step. All rings are
// one instanced draw call and all droplets another, so the effect costs almost
// nothing and has no per-frame allocations.

const RING_POOL = 22;
const DROPLET_POOL = 36;
const GRAVITY = 9;

const RING_VERTEX = `
    attribute vec4 aRing;
    attribute float aMax;
    varying vec2 vUv;
    varying float vLife;
    void main() {
        vUv = position.xy * 2.0;
        vLife = aRing.w;
        float radius = mix(0.25, aMax, 1.0 - pow(1.0 - aRing.w, 2.0));
        vec3 world = vec3(aRing.x + position.x * 2.0 * radius, aRing.y, aRing.z - position.y * 2.0 * radius);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
    }
`;

const RING_FRAGMENT = `
    varying vec2 vUv;
    varying float vLife;
    void main() {
        float r = length(vUv);
        if (r > 1.0) discard;
        float outer = smoothstep(0.6, 0.8, r) * (1.0 - smoothstep(0.88, 1.0, r));
        float inner = smoothstep(0.3, 0.44, r) * (1.0 - smoothstep(0.5, 0.62, r)) * 0.6;
        float fade = pow(1.0 - vLife, 1.3);
        float alpha = (outer + inner) * fade;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vec3(0.92, 0.98, 1.0), alpha);
        #include <colorspace_fragment>
    }
`;

export function createWaterTrail(scene) {
    const ringGeometry = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    ringGeometry.index = quad.index;
    ringGeometry.setAttribute('position', quad.getAttribute('position'));
    const ringData = new Float32Array(RING_POOL * 4);
    const ringMax = new Float32Array(RING_POOL);
    const ringAttribute = new THREE.InstancedBufferAttribute(ringData, 4);
    const maxAttribute = new THREE.InstancedBufferAttribute(ringMax, 1);
    ringAttribute.setUsage(THREE.DynamicDrawUsage);
    maxAttribute.setUsage(THREE.DynamicDrawUsage);
    ringGeometry.setAttribute('aRing', ringAttribute);
    ringGeometry.setAttribute('aMax', maxAttribute);
    ringGeometry.instanceCount = RING_POOL;
    const ringMaterial = new THREE.ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    const rings = new THREE.Mesh(ringGeometry, ringMaterial);
    rings.frustumCulled = false;
    rings.renderOrder = 3;
    scene.add(rings);

    // Ring life runs 0..1; a life of 1 or more means the slot is free.
    for (let i = 0; i < RING_POOL; i += 1) ringData[i * 4 + 3] = 1;
    const ringLife = new Float32Array(RING_POOL).fill(1);
    const ringDuration = new Float32Array(RING_POOL).fill(1);
    let nextRing = 0;

    const dropletGeometry = new THREE.SphereGeometry(1, 6, 4);
    const dropletMaterial = new THREE.MeshBasicMaterial({ color: 0xd8f3ff, transparent: true, opacity: 0.85, depthWrite: false });
    const droplets = new THREE.InstancedMesh(dropletGeometry, dropletMaterial, DROPLET_POOL);
    droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    droplets.frustumCulled = false;
    droplets.renderOrder = 4;
    scene.add(droplets);
    const drops = Array.from({ length: DROPLET_POOL }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, duration: 1, size: 0.1, floor: 0 }));
    const matrix = new THREE.Matrix4();
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < DROPLET_POOL; i += 1) droplets.setMatrixAt(i, zeroMatrix);
    let nextDrop = 0;

    function spawnRing(x, y, z, maxRadius, duration) {
        const i = nextRing;
        nextRing = (nextRing + 1) % RING_POOL;
        ringData[i * 4] = x;
        ringData[i * 4 + 1] = y;
        ringData[i * 4 + 2] = z;
        ringData[i * 4 + 3] = 0;
        ringMax[i] = maxRadius;
        ringLife[i] = 0;
        ringDuration[i] = duration;
    }

    function spawnDroplet(x, y, z, speed) {
        const d = drops[nextDrop];
        nextDrop = (nextDrop + 1) % DROPLET_POOL;
        const angle = Math.random() * Math.PI * 2;
        const push = (0.3 + Math.random() * 0.7) * speed * 0.12;
        d.x = x; d.y = y; d.z = z;
        d.vx = Math.cos(angle) * push;
        d.vz = Math.sin(angle) * push;
        d.vy = 2.4 + Math.random() * 2.2 + speed * 0.06;
        d.life = 0;
        d.duration = 0.45 + Math.random() * 0.25;
        d.size = 0.07 + Math.random() * 0.09;
        d.floor = y;
    }

    let stepTimer = 0;
    let idleTimer = 0;
    let wasIn = false;

    return {
        // Returns the water depth at the player so callers can reuse it.
        update(dt, river, position, moving, speed) {
            const depth = river ? getWaterDepth(river, position.x, position.z) : 0;
            const inWater = depth > WADE_START_DEPTH;
            if (inWater) {
                const surface = river.baseTerrainHeight(position.x, position.z) + depth + 0.03;
                if (!wasIn) {
                    // Entering the water makes one big splash.
                    spawnRing(position.x, surface, position.z, 2.8, 1.1);
                    for (let i = 0; i < 8; i += 1) spawnDroplet(position.x, surface, position.z, 16);
                }
                if (moving) {
                    stepTimer += dt;
                    const interval = speed > 12 ? 0.13 : 0.21;
                    if (stepTimer >= interval) {
                        stepTimer = 0;
                        const reach = THREE.MathUtils.clamp(1.4 + speed * 0.07, 1.4, 2.6);
                        spawnRing(position.x + (Math.random() - 0.5) * 0.4, surface, position.z + (Math.random() - 0.5) * 0.4, reach, 0.85);
                        for (let i = 0; i < 2; i += 1) spawnDroplet(position.x, surface, position.z, speed);
                    }
                    idleTimer = 0;
                } else {
                    idleTimer += dt;
                    if (idleTimer >= 1.1) {
                        idleTimer = 0;
                        spawnRing(position.x, surface, position.z, 1.2, 1.4);
                    }
                }
            } else {
                stepTimer = 0;
                idleTimer = 0;
            }
            wasIn = inWater;

            let ringsDirty = false;
            for (let i = 0; i < RING_POOL; i += 1) {
                if (ringLife[i] >= 1) continue;
                ringLife[i] += dt / ringDuration[i];
                ringData[i * 4 + 3] = Math.min(1, ringLife[i]);
                ringsDirty = true;
            }
            if (ringsDirty) ringAttribute.needsUpdate = true;
            maxAttribute.needsUpdate = ringsDirty || maxAttribute.needsUpdate;

            let dropsDirty = false;
            for (let i = 0; i < DROPLET_POOL; i += 1) {
                const d = drops[i];
                if (d.life >= 1) continue;
                d.life += dt / d.duration;
                if (d.life >= 1) {
                    droplets.setMatrixAt(i, zeroMatrix);
                } else {
                    d.vy -= GRAVITY * dt;
                    d.x += d.vx * dt;
                    d.y = Math.max(d.floor, d.y + d.vy * dt);
                    d.z += d.vz * dt;
                    const scale = d.size * (1 - d.life * 0.5);
                    matrix.makeScale(scale, scale, scale).setPosition(d.x, d.y, d.z);
                    droplets.setMatrixAt(i, matrix);
                }
                dropsDirty = true;
            }
            if (dropsDirty) droplets.instanceMatrix.needsUpdate = true;
            return depth;
        },
        dispose() {
            scene.remove(rings);
            scene.remove(droplets);
            ringGeometry.dispose();
            ringMaterial.dispose();
            dropletGeometry.dispose();
            dropletMaterial.dispose();
        },
    };
}
