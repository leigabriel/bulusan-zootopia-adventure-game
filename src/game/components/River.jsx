import * as THREE from 'three';
import {
    RIVER_WIDTH,
    BANK_BLEND,
    SHORE_WIDTH,
    CHANNEL_DEPTH,
    WATER_CLEARANCE,
    getRiverMetrics,
    getRiverTerrainOffset,
    isRiverArea,
    isLandAccessible,
    findAccessiblePosition,
    sampleSmoothPath,
    riverWidthAtT,
    getRiverPathLength,
    sampleRiver,
} from '../utils/riverMath.js';
import { SUN_DIRECTION } from '../utils/skyConfig.js';

export { getRiverMetrics, getRiverTerrainOffset, isRiverArea, isLandAccessible, findAccessiblePosition };

// Water is a ribbon that follows the river path. Unlike a flat plane (the
// three.js `Water` example mirrors a planar surface), this river bends and
// descends, so it uses a ribbon with a per-vertex water depth. The shader then
// takes the same ingredients as the three.js water examples (animated normals,
// fresnel sky reflection, sun glint, fog) and adds depth tint and shore foam.
const QUALITY_CONFIG = {
    low: { samples: 60, rows: 6 },
    medium: { samples: 110, rows: 10 },
    high: { samples: 170, rows: 16 }
};

// The terrain levels the riverbed across the channel, so the surface only has
// to follow the centre line: a little above the bed, smoothed along the river.
const SURFACE_ABOVE_BED = 1.15;
const SIDE_EXTENT = BANK_BLEND;
const LEVEL_SMOOTHING_PASSES = 3;
const LEVEL_SMOOTHING_RADIUS = 5;


function computeSurfaceLevels(samples, baseTerrainHeight) {
    let levels = new Float64Array(samples + 1);
    for (let i = 0; i <= samples; i += 1) {
        const point = sampleSmoothPath(i / samples);
        levels[i] = baseTerrainHeight(point.x, point.y) + SURFACE_ABOVE_BED;
    }
    // A moving average removes the bed's ripple so the surface stays smooth.
    for (let pass = 0; pass < LEVEL_SMOOTHING_PASSES; pass += 1) {
        const smoothed = new Float64Array(samples + 1);
        for (let i = 0; i <= samples; i += 1) {
            let sum = 0;
            let count = 0;
            for (let k = -LEVEL_SMOOTHING_RADIUS; k <= LEVEL_SMOOTHING_RADIUS; k += 1) {
                const j = i + k;
                if (j < 0 || j > samples) continue;
                sum += levels[j];
                count += 1;
            }
            smoothed[i] = sum / count;
        }
        levels = smoothed;
    }
    return levels;
}

function makeWaterGeometry(samples, rows, baseTerrainHeight) {
    const levels = computeSurfaceLevels(samples, baseTerrainHeight);
    const pathLength = getRiverPathLength();
    const rowCount = rows + 1;
    const positions = new Float32Array((samples + 1) * rowCount * 3);
    const depths = new Float32Array((samples + 1) * rowCount);
    const flows = new Float32Array((samples + 1) * rowCount * 2);
    const tangents = new Float32Array((samples + 1) * rowCount * 2);
    const uvs = new Float32Array((samples + 1) * rowCount * 2);
    const indices = [];

    for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        const point = sampleSmoothPath(t);
        const next = t < 1 ? sampleSmoothPath(t + 0.002) : sampleSmoothPath(t - 0.002);
        const tangent = next.clone().sub(point).normalize();
        if (t >= 1) tangent.negate();
        const sideX = -tangent.y;
        const sideZ = tangent.x;
        const extent = riverWidthAtT(t) + SIDE_EXTENT;
        const level = levels[i];
        for (let row = 0; row < rowCount; row += 1) {
            const across = (row / rows) * 2 - 1;
            const lateral = across * extent;
            const x = point.x + sideX * lateral;
            const z = point.y + sideZ * lateral;
            const v = i * rowCount + row;
            positions[v * 3] = x;
            positions[v * 3 + 1] = level;
            positions[v * 3 + 2] = z;
            depths[v] = level - baseTerrainHeight(x, z);
            flows[v * 2] = t * pathLength;
            flows[v * 2 + 1] = lateral;
            tangents[v * 2] = tangent.x;
            tangents[v * 2 + 1] = tangent.y;
            uvs[v * 2] = t * 8;
            uvs[v * 2 + 1] = row / rows;
        }
    }
    for (let i = 0; i < samples; i += 1) {
        for (let row = 0; row < rows; row += 1) {
            const a = i * rowCount + row;
            const b = a + 1;
            const c = a + rowCount;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1));
    geometry.setAttribute('aFlow', new THREE.BufferAttribute(flows, 2));
    geometry.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    // Kept so gameplay can ask how deep the water is at any point.
    geometry.userData.levels = levels;
    geometry.userData.pathLength = pathLength;
    return geometry;
}

const WATER_VERTEX = `
    attribute float aDepth;
    attribute vec2 aFlow;
    attribute vec2 aTangent;
    varying float vDepth;
    varying vec2 vFlow;
    varying vec2 vTangent;
    varying vec3 vWorld;
    #include <fog_pars_vertex>
    void main() {
        vDepth = aDepth;
        vFlow = aFlow;
        vTangent = aTangent;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
    }
`;

const WATER_FRAGMENT = `
    uniform float uTime;
    uniform float uStrength;
    uniform vec3 uSunDir;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uSky;
    uniform vec3 uHorizon;
    uniform vec3 uFoam;
    varying float vDepth;
    varying vec2 vFlow;
    varying vec2 vTangent;
    varying vec3 vWorld;
    #include <fog_pars_fragment>

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    // Gradient of a sum of travelling sine waves, in (along, across) space.
    vec2 waveGradient(vec2 p, float t) {
        vec2 g = vec2(0.0);
        vec2 k;
        float f;
        float phase;
        k = normalize(vec2(1.0, 0.25)); f = 0.9;  phase = dot(k, p) * f - t * 1.5;  g += k * f * 0.50 * cos(phase);
        k = normalize(vec2(0.9, -0.55)); f = 1.7; phase = dot(k, p) * f - t * 1.9;  g += k * f * 0.30 * cos(phase);
        k = normalize(vec2(1.0, 0.8)); f = 2.9;   phase = dot(k, p) * f - t * 2.6;  g += k * f * 0.17 * cos(phase);
        k = normalize(vec2(0.7, -1.0)); f = 4.6;  phase = dot(k, p) * f - t * 3.1;  g += k * f * 0.10 * cos(phase);
        k = normalize(vec2(1.0, 0.1)); f = 7.3;   phase = dot(k, p) * f - t * 3.9;  g += k * f * 0.05 * cos(phase);
        return g;
    }

    void main() {
        float depth = vDepth;
        // Water only exists where it is above the ground.
        float coverage = smoothstep(0.0, 0.1, depth);
        if (coverage <= 0.002) discard;

        vec2 flowUv = vFlow;
        vec2 warp = vec2(noise(flowUv * 0.35 + uTime * 0.08), noise(flowUv * 0.35 - uTime * 0.06 + 9.0)) - 0.5;
        vec2 grad = waveGradient(flowUv + warp * 1.4, uTime) * uStrength;
        // Calmer right at the shore, livelier in the open channel.
        grad *= mix(0.45, 1.0, smoothstep(0.0, 0.6, depth));
        vec2 sideDir = vec2(-vTangent.y, vTangent.x);
        vec2 worldGrad = vTangent * grad.x + sideDir * grad.y;
        vec3 normal = normalize(vec3(-worldGrad.x, 1.0, -worldGrad.y));

        vec3 viewDir = normalize(cameraPosition - vWorld);
        float nDotV = clamp(dot(normal, viewDir), 0.0, 1.0);
        float fresnel = mix(0.07, 1.0, pow(1.0 - nDotV, 4.0));

        // Body colour: clear and bright in the shallows, deeper blue mid-channel.
        float deepMix = smoothstep(0.05, 1.1, depth);
        vec3 body = mix(uShallow, uDeep, deepMix);

        // Caustic light lines drifting over the bed in shallow water.
        float c1 = sin(flowUv.x * 2.1 + sin(flowUv.y * 2.7 + uTime * 0.9) * 1.6 - uTime * 0.7);
        float c2 = sin(flowUv.y * 2.4 + sin(flowUv.x * 1.9 - uTime * 0.8) * 1.5 + uTime * 0.5);
        float caustic = pow(clamp(0.5 + 0.5 * c1 * c2, 0.0, 1.0), 5.0) * (1.0 - smoothstep(0.1, 0.9, depth));
        body += caustic * 0.35;

        // Sky reflection (cheap stand-in for the mirror render of the three.js Water).
        vec3 reflected = reflect(-viewDir, normal);
        vec3 skyColour = mix(uHorizon, uSky, pow(clamp(reflected.y, 0.0, 1.0), 0.6));

        vec3 colour = mix(body, skyColour, fresnel * 0.8);

        // Sun glint.
        vec3 halfway = normalize(normalize(uSunDir) + viewDir);
        float specular = pow(max(dot(normal, halfway), 0.0), 220.0) * 1.8 + pow(max(dot(normal, halfway), 0.0), 40.0) * 0.12;
        colour += vec3(1.0, 0.96, 0.85) * specular * uStrength;

        // Foam: soft rim at the shoreline plus a few animated bands.
        float wobble = noise(flowUv * 1.6 + vec2(uTime * 0.25, 0.0));
        float rim = 1.0 - smoothstep(0.03, 0.2 + wobble * 0.14, depth);
        float bands = smoothstep(0.55, 0.95, sin(depth * 26.0 - uTime * 1.4 + wobble * 5.0))
            * (1.0 - smoothstep(0.08, 0.5, depth)) * smoothstep(0.1, 0.2, depth);
        float streak = smoothstep(0.78, 0.95, noise(flowUv * vec2(0.9, 2.4) - vec2(uTime * 0.7, 0.0))) * 0.25;
        float foam = clamp(rim * 0.9 + bands * 0.45 + streak * (1.0 - deepMix * 0.5), 0.0, 1.0);
        colour = mix(colour, uFoam, foam);

        float alpha = coverage * mix(0.62, 0.95, smoothstep(0.1, 1.0, depth));
        alpha = max(alpha, foam * coverage * 0.9);
        gl_FragColor = vec4(colour, alpha);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
    }
`;

function createWaterMaterial(quality) {
    if (quality === 'low') {
        return new THREE.MeshBasicMaterial({ color: 0x2aa8c4, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    }
    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                uTime: { value: 0 },
                uStrength: { value: quality === 'high' ? 1 : 0.8 },
                uSunDir: { value: new THREE.Vector3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z) },
                uShallow: { value: new THREE.Color(0x58d6c9) },
                uDeep: { value: new THREE.Color(0x0b5d8c) },
                uSky: { value: new THREE.Color(0x87ceeb) },
                uHorizon: { value: new THREE.Color(0xd4ecf4) },
                uFoam: { value: new THREE.Color(0xf4fbff) }
            }
        ]),
        vertexShader: WATER_VERTEX,
        fragmentShader: WATER_FRAGMENT,
        fog: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
}

export function createRiver(scene, baseTerrainHeight, quality = 'medium') {
    const config = QUALITY_CONFIG[quality] || QUALITY_CONFIG.medium;
    const root = new THREE.Group();
    root.name = 'CartoonRiver';
    const water = new THREE.Mesh(makeWaterGeometry(config.samples, config.rows, baseTerrainHeight), createWaterMaterial(quality));
    water.renderOrder = 2;
    water.frustumCulled = true;
    root.add(water);

    scene.add(root);
    return { root, water, quality, time: 0, baseTerrainHeight };
}

// Depth of the water at (x, z): surface height minus ground height, or 0 on
// land. Used for wading speed and the water trail.
export function getWaterDepth(river, x, z) {
    if (!river) return 0;
    const sample = sampleRiver(x, z, BANK_BLEND);
    if (!sample) return 0;
    const { levels, pathLength } = river.water.geometry.userData;
    const position = Math.min(1, Math.max(0, sample.along / pathLength)) * (levels.length - 1);
    const index = Math.min(levels.length - 2, Math.floor(position));
    const level = levels[index] + (levels[index + 1] - levels[index]) * (position - index);
    const depth = level - river.baseTerrainHeight(x, z);
    return depth > 0 ? depth : 0;
}

// Height of the water surface near (x, z); only meaningful where the depth is above 0.
export function getWaterSurfaceHeight(river, x, z) {
    return river.baseTerrainHeight(x, z) + getWaterDepth(river, x, z);
}

export function updateRiver(river, dt, active = true) {
    if (!river || !active || document.hidden) return;
    river.time += Math.min(dt, 0.1);
    if (river.water.material.uniforms?.uTime) river.water.material.uniforms.uTime.value = river.time;
}

export function updateRiverQuality(river, quality) {
    if (!river) return;
    const next = QUALITY_CONFIG[quality] || QUALITY_CONFIG.medium;
    const old = river.water.material;
    const oldWaterGeometry = river.water.geometry;

    river.water.geometry = makeWaterGeometry(next.samples, next.rows, river.baseTerrainHeight);
    oldWaterGeometry.dispose();
    if (quality === 'low' && old.isShaderMaterial) {
        river.water.material = createWaterMaterial('low');
        old.dispose();
    } else if (quality !== 'low' && !old.isShaderMaterial) {
        river.water.material = createWaterMaterial(quality);
        old.dispose();
    } else if (old.uniforms?.uStrength) old.uniforms.uStrength.value = quality === 'high' ? 1 : 0.8;
    river.quality = quality;
}

export function disposeRiver(river) {
    if (!river) return;
    river.root?.traverse((child) => {
        child.geometry?.dispose?.();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material?.dispose?.());
    });
    river.root?.parent?.remove(river.root);
}

export const RIVER_CONSTANTS = {
    width: RIVER_WIDTH,
    channelDepth: CHANNEL_DEPTH,
    bankBlend: BANK_BLEND,
    shoreWidth: SHORE_WIDTH,
    waterClearance: WATER_CLEARANCE
};
