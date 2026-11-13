import * as THREE from 'three';
import { sampleTerrainHeight } from '../utils/terrainField.js';
import { isRiverArea } from '../utils/riverMath.js';
import { PATH_WIDTH, PLAZA, getRouteSamples } from '../data/pathways.js';

// Walkways drawn as one soft-edged mesh that hugs the terrain: packed earth in
// the middle, fading to the grass at the edges. The plaza round the statue is a
// lighter flagstone disc. Everything is a single draw call.

const LIFT = 0.07;
const LATERAL = [-1, -0.62, 0, 0.62, 1];
const ALPHA = [0, 0.82, 0.95, 0.82, 0];
const EARTH = new THREE.Color(0xcdae79);
const EARTH_EDGE = new THREE.Color(0xa98a58);
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
                    const base = Math.abs(offset) > 0.9 ? EARTH_EDGE : EARTH;
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
            geometry.dispose();
            material.dispose();
        },
    };
}
