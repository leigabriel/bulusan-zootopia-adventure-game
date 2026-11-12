import * as THREE from 'three';
import { sampleTerrainHeight } from '../utils/terrainField.js';
import {
    FLOWER_COLORS, createRng, generateFlowerPlacements, generateGrassPlacements,
} from '../utils/meadowScatter.js';

// Grass field and wildflowers. Both are drawn as instanced meshes split into
// chunks so the GPU skips every chunk that is off screen or too far away, and
// both share one wind function so the whole field sways together.

const GRASS_COUNTS = { low: 26000, medium: 52000, high: 80000 };
const FLOWER_COUNTS = { low: 4500, medium: 7500, high: 11000 };
const FADE_END = { low: 100, medium: 135, high: 165 };
const MOBILE_SHARE = 0.45;
const MOBILE_FADE_END = 105;
const MAX_PLANT_HEIGHT = 2.4;

const WIND_GLSL = `
    uniform float uTime;
    vec3 windOffset(vec3 worldPos, float bend) {
        float gust = sin(uTime * 0.55 + worldPos.x * 0.021 + worldPos.z * 0.017) * 0.5 + 0.5;
        float wave = sin(uTime * 1.7 + worldPos.x * 0.16 + worldPos.z * 0.11)
            + 0.35 * sin(uTime * 3.3 + worldPos.x * 0.45 - worldPos.z * 0.3);
        float amount = (0.10 + 0.18 * gust) * wave + 0.06 * gust;
        return vec3(amount * bend, 0.0, amount * bend * 0.55);
    }
`;

const FADE_GLSL = `
    uniform float uFadeStart;
    uniform float uFadeEnd;
    float distanceFade() {
        vec3 origin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        return 1.0 - smoothstep(uFadeStart, uFadeEnd, distance(origin, cameraPosition));
    }
`;

function createUniforms(fadeEnd, extra) {
    return THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
            uTime: { value: 0 },
            uFadeStart: { value: fadeEnd * 0.6 },
            uFadeEnd: { value: fadeEnd },
            ...extra,
        },
    ]);
}

function createGrassMaterial(fadeEnd) {
    return new THREE.ShaderMaterial({
        uniforms: createUniforms(fadeEnd, {
            uColorBase: { value: new THREE.Color(0x244f23) },
            uColorTip: { value: new THREE.Color(0x9bcf4e) },
        }),
        vertexShader: `
            ${WIND_GLSL}
            ${FADE_GLSL}
            uniform vec3 uColorBase;
            uniform vec3 uColorTip;
            varying vec3 vColor;
            #include <fog_pars_vertex>
            void main() {
                float fade = distanceFade();
                vec4 world = instanceMatrix * vec4(position * fade, 1.0);
                float h = uv.y;
                world.xyz += windOffset(world.xyz, h * h) * fade;
                vec4 mvPosition = viewMatrix * world;
                gl_Position = projectionMatrix * mvPosition;
                vec3 colour = mix(uColorBase, uColorTip, smoothstep(0.0, 1.0, h));
                #ifdef USE_INSTANCING_COLOR
                    colour *= instanceColor;
                #endif
                vColor = colour;
                #include <fog_vertex>
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            #include <fog_pars_fragment>
            void main() {
                gl_FragColor = vec4(vColor, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
                #include <fog_fragment>
            }
        `,
        side: THREE.DoubleSide,
        fog: true,
    });
}

function createFlowerMaterial(fadeEnd) {
    return new THREE.ShaderMaterial({
        uniforms: createUniforms(fadeEnd, {}),
        vertexShader: `
            ${WIND_GLSL}
            ${FADE_GLSL}
            attribute vec3 aColor;
            attribute float aTint;
            attribute float aBend;
            varying vec3 vColor;
            #include <fog_pars_vertex>
            void main() {
                float fade = distanceFade();
                vec4 world = instanceMatrix * vec4(position * fade, 1.0);
                world.xyz += windOffset(world.xyz, aBend) * 1.3 * fade;
                vec4 mvPosition = viewMatrix * world;
                gl_Position = projectionMatrix * mvPosition;
                vec3 colour = aColor;
                #ifdef USE_INSTANCING_COLOR
                    colour = mix(aColor, aColor * instanceColor, aTint);
                #endif
                vColor = colour;
                #include <fog_vertex>
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            #include <fog_pars_fragment>
            void main() {
                gl_FragColor = vec4(vColor, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
                #include <fog_fragment>
            }
        `,
        side: THREE.DoubleSide,
        fog: true,
    });
}

// A clump of eight tapered blades fanning out from the root: 8 triangles, so a
// whole field stays cheap. uv.y runs 0 (root) to 1 (tip) and drives colour/wind.
function createGrassClumpGeometry() {
    const rand = createRng(7);
    const positions = [];
    const uvs = [];
    const blades = 8;
    for (let i = 0; i < blades; i += 1) {
        const around = (i / blades) * Math.PI * 2 + rand() * 0.8;
        const radius = 0.05 + rand() * 0.13;
        const baseX = Math.cos(around) * radius;
        const baseZ = Math.sin(around) * radius;
        const facing = rand() * Math.PI;
        const halfWidth = 0.032 + rand() * 0.016;
        const height = 0.45 + rand() * 0.5;
        const lean = 0.08 + rand() * 0.2;
        const sideX = Math.cos(facing) * halfWidth;
        const sideZ = Math.sin(facing) * halfWidth;
        positions.push(
            baseX - sideX, 0, baseZ - sideZ,
            baseX + sideX, 0, baseZ + sideZ,
            baseX + Math.cos(around) * lean, height, baseZ + Math.sin(around) * lean,
        );
        uvs.push(0, 0, 1, 0, 0.5, 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geometry;
}

// Stem plus a six-petal head with a yellow centre. aTint marks the petals that
// take the per-flower colour; aBend makes the head sway more than the stem base.
function createFlowerGeometry() {
    const positions = [];
    const colors = [];
    const tints = [];
    const bends = [];
    const stemHeight = 0.85;
    const add = (x, y, z, colour, tint) => {
        positions.push(x, y, z);
        colors.push(colour.r, colour.g, colour.b);
        tints.push(tint);
        const t = y / stemHeight;
        bends.push(t * t);
    };

    const stem = new THREE.Color(0x3f7d2f);
    const stemTip = new THREE.Color(0x4f9a38);
    for (const angle of [0, Math.PI / 2]) {
        const sx = Math.cos(angle) * 0.02;
        const sz = Math.sin(angle) * 0.02;
        add(-sx, 0, -sz, stem, 0);
        add(sx, 0, sz, stem, 0);
        add(sx * 0.5, stemHeight, sz * 0.5, stemTip, 0);
    }

    const petalCount = 6;
    const petalRadius = 0.17;
    const inner = new THREE.Color(0.82, 0.82, 0.82);
    const outer = new THREE.Color(1, 1, 1);
    for (let i = 0; i < petalCount; i += 1) {
        const a = (i / petalCount) * Math.PI * 2;
        const spread = 0.36;
        add(0, stemHeight + 0.05, 0, inner, 1);
        add(Math.cos(a - spread) * petalRadius, stemHeight + 0.015, Math.sin(a - spread) * petalRadius, outer, 1);
        add(Math.cos(a + spread) * petalRadius, stemHeight + 0.015, Math.sin(a + spread) * petalRadius, outer, 1);
    }

    const centre = new THREE.Color(0xf5c518);
    for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        const b = ((i + 1) / 5) * Math.PI * 2;
        add(0, stemHeight + 0.075, 0, centre, 0);
        add(Math.cos(a) * 0.06, stemHeight + 0.06, Math.sin(a) * 0.06, centre, 0);
        add(Math.cos(b) * 0.06, stemHeight + 0.06, Math.sin(b) * 0.06, centre, 0);
    }

    // Nod the head forward so petals face the viewer instead of lying flat.
    const nod = new THREE.Matrix4().makeRotationX(0.5);
    const pivot = new THREE.Vector3(0, stemHeight, 0);
    const vertex = new THREE.Vector3();
    for (let i = 9; i < positions.length / 3; i += 1) {
        vertex.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).sub(pivot).applyMatrix4(nod).add(pivot);
        positions[i * 3] = vertex.x;
        positions[i * 3 + 1] = vertex.y;
        positions[i * 3 + 2] = vertex.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('aTint', new THREE.Float32BufferAttribute(tints, 1));
    geometry.setAttribute('aBend', new THREE.Float32BufferAttribute(bends, 1));
    return geometry;
}

function buildChunkMeshes(scene, chunks, geometry, material, stride, applyItem) {
    const meshes = [];
    const dummy = new THREE.Object3D();
    const colour = new THREE.Color();
    const box = new THREE.Box3();
    const point = new THREE.Vector3();

    for (const chunk of chunks) {
        const instances = chunk.items.length / stride;
        const mesh = new THREE.InstancedMesh(geometry, material, instances);
        box.makeEmpty();
        for (let i = 0; i < instances; i += 1) {
            const o = i * stride;
            const x = chunk.items[o];
            const z = chunk.items[o + 1];
            const y = sampleTerrainHeight(x, z);
            dummy.position.set(x, y, z);
            dummy.rotation.set(0, chunk.items[o + 2], 0);
            applyItem(dummy, colour, chunk.items, o);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            mesh.setColorAt(i, colour);
            point.set(x, y, z);
            box.expandByPoint(point);
        }
        box.max.y += MAX_PLANT_HEIGHT;
        // Instance bounds are set by hand so the renderer can cull whole chunks.
        mesh.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
        mesh.boundingSphere.radius += 1;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = true;
        mesh.matrixAutoUpdate = false;
        scene.add(mesh);
        meshes.push(mesh);
    }
    return meshes;
}

export function createMeadow(scene, { quality = 'medium', mobile = false } = {}) {
    const level = GRASS_COUNTS[quality] ? quality : 'medium';
    const share = mobile ? MOBILE_SHARE : 1;
    const fadeEnd = mobile ? MOBILE_FADE_END : FADE_END[level];

    const grassMaterial = createGrassMaterial(fadeEnd);
    const flowerMaterial = createFlowerMaterial(fadeEnd);
    const grassGeometry = createGrassClumpGeometry();
    const flowerGeometry = createFlowerGeometry();

    const grass = generateGrassPlacements({ count: Math.round(GRASS_COUNTS[level] * share), seed: 1 });
    const flowers = generateFlowerPlacements({ count: Math.round(FLOWER_COUNTS[level] * share), seed: 2 });

    const grassMeshes = buildChunkMeshes(scene, grass.chunks, grassGeometry, grassMaterial, 7, (dummy, colour, items, o) => {
        const scale = items[o + 3];
        dummy.scale.set(scale, scale, scale);
        colour.setRGB(items[o + 4], items[o + 5], items[o + 6], THREE.LinearSRGBColorSpace);
    });

    const palette = FLOWER_COLORS.map((hex) => new THREE.Color(hex));
    const flowerMeshes = buildChunkMeshes(scene, flowers.chunks, flowerGeometry, flowerMaterial, 5, (dummy, colour, items, o) => {
        const scale = items[o + 3];
        dummy.scale.set(scale, scale, scale);
        colour.copy(palette[items[o + 4]]);
    });

    return {
        grassMeshes,
        flowerMeshes,
        materials: [grassMaterial, flowerMaterial],
        geometries: [grassGeometry, flowerGeometry],
        fadeEnd,
        flowerSpots: flowers.spots,
        grassCount: grass.total,
        flowerCount: flowers.total,
    };
}

const cullSphere = new THREE.Sphere();

export function updateMeadow(meadow, time, cameraPosition) {
    if (!meadow) return;
    for (const material of meadow.materials) material.uniforms.uTime.value = time;
    // Chunks beyond the fade distance are invisible anyway, so skip them.
    const limit = meadow.fadeEnd;
    for (const list of [meadow.grassMeshes, meadow.flowerMeshes]) {
        for (const mesh of list) {
            cullSphere.copy(mesh.boundingSphere);
            mesh.visible = cullSphere.center.distanceTo(cameraPosition) - cullSphere.radius < limit;
        }
    }
}

export function disposeMeadow(scene, meadow) {
    if (!meadow) return;
    for (const mesh of [...meadow.grassMeshes, ...meadow.flowerMeshes]) {
        scene.remove(mesh);
        mesh.dispose();
    }
    meadow.geometries.forEach((geometry) => geometry.dispose());
    meadow.materials.forEach((material) => material.dispose());
}
