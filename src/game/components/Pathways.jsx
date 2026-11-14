import * as THREE from 'three';
import { sampleTerrainHeight } from '../utils/terrainField.js';
import { isRiverArea } from '../utils/riverMath.js';
import { PATH_WIDTH, PLAZA, getRouteSamples } from '../data/pathways.js';

// Walkways drawn as one soft-edged mesh that hugs the terrain: packed earth in
// the middle, fading to the grass at the edges. The plaza round the statue is a
// lighter flagstone disc. Everything is a single draw call.

const LIFT = 0.07;
const LATERAL = [-1.08, -0.82, -0.5, -0.18, 0.18, 0.5, 0.82, 1.08];
const ALPHA = [0, 0.7, 0.92, 0.97, 0.97, 0.92, 0.7, 0];
const PEBBLE_SPACING = 2.4;
const EARTH = new THREE.Color(0xcdae79);
const EARTH_EDGE = new THREE.Color(0xa98a58);
const EARTH_WORN = new THREE.Color(0xb99a68);
const PEBBLE = new THREE.Color(0x9a8d78);
const STONE = new THREE.Color(0xd6c8a4);
const STONE_RIM = new THREE.Color(0xb5a27a);

// Small deterministic variation so the surface does not look printed.
function wobble(x, z) {
    return 0.94 + 0.1 * (0.5 + 0.5 * Math.sin(x * 0.37 + Math.cos(z * 0.29) * 2.1) * Math.cos(z * 0.41 - x * 0.13));
}

function groundY(x, z) {
    return sampleTerrainHeight(x, z) + LIFT;
}

// Splits a route into runs of dry samples so the path stops at the water.
function dryRuns(samples) {
    const runs = [];
    let run = [];
    for (const point of samples) {
        if (isRiverArea(point.x, point.z, 1.6)) {
            if (run.length > 1) runs.push(run);
            run = [];
        } else {
            run.push(point);
        }
    }
    if (run.length > 1) runs.push(run);
    return runs;
}

export function createPathways(scene) {
    const positions = [];
    const colors = [];
    const indices = [];
    const color = new THREE.Color();

    const pushVertex = (x, z, base, alpha) => {
        positions.push(x, groundY(x, z), z);
        color.copy(base).multiplyScalar(wobble(x, z));
        colors.push(color.r, color.g, color.b, alpha);
        return positions.length / 3 - 1;
    };

    // Ribbons.
    for (const { samples } of getRouteSamples()) {
        for (const run of dryRuns(samples)) {
            const first = positions.length / 3;
            const half = PATH_WIDTH / 2;
            for (let i = 0; i < run.length; i += 1) {
                const prev = run[Math.max(0, i - 1)];
                const next = run[Math.min(run.length - 1, i + 1)];
                const tx = next.x - prev.x;
                const tz = next.z - prev.z;
                const length = Math.hypot(tx, tz) || 1;
                const nx = -tz / length;
                const nz = tx / length;
                // Rounded ends: the outer samples narrow a little.
                const end = Math.min(i, run.length - 1 - i);
                const taper = end >= 3 ? 1 : 0.55 + 0.15 * end;
                LATERAL.forEach((offset, column) => {
                    const lateral = offset * half * taper;
                    const base = Math.abs(offset) > 0.9 ? EARTH_EDGE : Math.abs(offset) < 0.25 ? EARTH_WORN : EARTH;
                    pushVertex(run[i].x + nx * lateral, run[i].z + nz * lateral, base, ALPHA[column] * (end === 0 ? 0.6 : 1));
                });
            }
            const stride = LATERAL.length;
            for (let i = 0; i < run.length - 1; i += 1) {
                for (let c = 0; c < stride - 1; c += 1) {
                    const a = first + i * stride + c;
                    const b = a + 1;
                    const d = a + stride;
                    const e = d + 1;
                    // Wound so the surface faces up.
                    indices.push(a, b, d, b, e, d);
                }
            }
        }
    }

    // Plaza disc: concentric rings so it follows the ground.
    const rings = 5;
    const segments = 40;
    const centre = pushVertex(PLAZA.x, PLAZA.z, STONE, 0.96);
    const ringStart = [];
    for (let r = 1; r <= rings; r += 1) {
        const radius = (r / rings) * PLAZA.radius;
        const rim = r === rings;
        ringStart.push(positions.length / 3);
        for (let s = 0; s < segments; s += 1) {
            const angle = (s / segments) * Math.PI * 2;
            pushVertex(
                PLAZA.x + Math.cos(angle) * radius,
                PLAZA.z + Math.sin(angle) * radius,
                rim || r === rings - 1 ? STONE_RIM : STONE,
                rim ? 0 : r === rings - 1 ? 0.8 : 0.96,
            );
        }
    }
    for (let s = 0; s < segments; s += 1) {
        indices.push(centre, ringStart[0] + ((s + 1) % segments), ringStart[0] + s);
    }
    for (let r = 0; r < rings - 1; r += 1) {
        for (let s = 0; s < segments; s += 1) {
            const a = ringStart[r] + s;
            const b = ringStart[r] + ((s + 1) % segments);
            const c = ringStart[r + 1] + s;
            const d = ringStart[r + 1] + ((s + 1) % segments);
            indices.push(a, b, c, b, d, c);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Small stones along both edges, so the path reads as a laid walkway.
    const pebbleSpots = [];
    for (const { samples } of getRouteSamples()) {
        for (const run of dryRuns(samples)) {
            let carried = 0;
            for (let i = 1; i < run.length - 1; i += 1) {
                const prev = run[i - 1];
                const next = run[i + 1];
                carried += Math.hypot(run[i].x - prev.x, run[i].z - prev.z);
                if (carried < PEBBLE_SPACING) continue;
                carried = 0;
                const tx = next.x - prev.x;
                const tz = next.z - prev.z;
                const length = Math.hypot(tx, tz) || 1;
                const nx = -tz / length;
                const nz = tx / length;
                for (const side of [-1, 1]) {
                    const seed = Math.sin(run[i].x * 12.9898 + run[i].z * 78.233 + side * 3.1) * 43758.5453;
                    const r = seed - Math.floor(seed);
                    const lateral = side * (PATH_WIDTH / 2 + 0.05 + r * 0.45);
                    pebbleSpots.push({ x: run[i].x + nx * lateral, z: run[i].z + nz * lateral, size: 0.1 + r * 0.14, yaw: r * 6.28 });
                }
            }
        }
    }
    const pebbleGeometry = new THREE.DodecahedronGeometry(1, 0);
    const pebbleMaterial = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
    const pebbles = new THREE.InstancedMesh(pebbleGeometry, pebbleMaterial, Math.max(1, pebbleSpots.length));
    const dummy = new THREE.Object3D();
    pebbleSpots.forEach((spot, index) => {
        dummy.position.set(spot.x, sampleTerrainHeight(spot.x, spot.z) + 0.03, spot.z);
        dummy.rotation.set(0, spot.yaw, 0);
        dummy.scale.set(spot.size * 1.4, spot.size * 0.7, spot.size);
        dummy.updateMatrix();
        pebbles.setMatrixAt(index, dummy.matrix);
        pebbles.setColorAt(index, color.copy(PEBBLE).multiplyScalar(wobble(spot.x * 1.7, spot.z * 1.3) + (spot.size - 0.17)));
    });
    pebbles.count = pebbleSpots.length;
    pebbles.instanceMatrix.needsUpdate = true;
    if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
    pebbles.receiveShadow = true;
    pebbles.name = 'pathway-pebbles';
    scene.add(pebbles);

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    mesh.name = 'pathways';
    scene.add(mesh);

    return {
        mesh,
        dispose() {
            scene.remove(mesh);
            scene.remove(pebbles);
            pebbles.dispose();
            pebbleGeometry.dispose();
            pebbleMaterial.dispose();
            geometry.dispose();
            material.dispose();
        },
    };
}
