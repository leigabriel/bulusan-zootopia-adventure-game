import * as THREE from 'three';
import { SUN_DIRECTION } from './skyConfig.js';

// Real-time sun shadows with four settings: off, low, medium and high.
//
// One directional light casts them. Its shadow camera is a box that follows the
// player, so the map stays sharp where the player is looking without needing a
// huge shadow texture for the whole world.

export const SHADOW_QUALITIES = ['off', 'low', 'medium', 'high'];

export function normalizeShadowQuality(value, fallback = 'medium') {
    return SHADOW_QUALITIES.includes(value) ? value : fallback;
}

// `half` is the half-width in world units of the area around the player that
// gets shadows; `size` is the shadow texture size.
export function getShadowConfig(quality, { mobile = false } = {}) {
    switch (normalizeShadowQuality(quality)) {
        case 'off':
            return { enabled: false, size: 0, half: 0, type: THREE.BasicShadowMap };
        case 'low':
            return { enabled: true, size: mobile ? 512 : 1024, half: 38, type: THREE.BasicShadowMap };
        case 'high':
            return { enabled: true, size: mobile ? 2048 : 4096, half: 70, type: THREE.PCFSoftShadowMap };
        default:
            return { enabled: true, size: mobile ? 1024 : 2048, half: 55, type: THREE.PCFShadowMap };
    }
}

const SUN_DISTANCE = 220;

// Large instanced batches (grass, flowers) would cost more to shadow than they
// add, so anything instanced above this count only receives nothing and casts nothing.
const MAX_SHADOWED_INSTANCES = 600;

function materialList(object) {
    return Array.isArray(object.material) ? object.material : [object.material];
}

// True for things that should not throw or catch a shadow: sky, clouds, water,
// glow sprites, custom shader effects and big instanced fields.
function skipsShadows(object) {
    if (object.userData?.noShadow) return true;
    if (object.isInstancedMesh && object.count > MAX_SHADOWED_INSTANCES) return true;
    return materialList(object).some((material) => (
        !material
        || material.isShaderMaterial
        || material.isRawShaderMaterial
        || material.transparent
        || material.blending === THREE.AdditiveBlending
    ));
}

// Every solid model (animals, people, buildings, props, trees, fences) casts and
// receives shadows. Run it again after loading or after the setting changes.
export function applyShadowFlags(root, enabled = true) {
    root.traverse((object) => {
        if (!object.isMesh) return;
        const skip = !enabled || skipsShadows(object);
        object.castShadow = !skip;
        object.receiveShadow = !skip;
    });
}

// Sets the sun's shadow texture and box. Safe to call again when the setting
// changes: the old texture is released so the new size takes effect.
export function configureSunShadow(renderer, sun, quality, options = {}) {
    const config = getShadowConfig(quality, options);
    const wasEnabled = renderer.shadowMap.enabled;
    const typeChanged = renderer.shadowMap.type !== config.type;
    renderer.shadowMap.enabled = config.enabled;
    renderer.shadowMap.type = config.type;
    sun.castShadow = config.enabled;
    if (config.enabled) {
        const { shadow } = sun;
        if (shadow.mapSize.x !== config.size) {
            shadow.mapSize.set(config.size, config.size);
            shadow.map?.dispose();
            shadow.map = null;
        }
        shadow.camera.left = -config.half;
        shadow.camera.right = config.half;
        shadow.camera.top = config.half;
        shadow.camera.bottom = -config.half;
        shadow.camera.near = 20;
        shadow.camera.far = SUN_DISTANCE * 2.2;
        shadow.camera.updateProjectionMatrix();
        shadow.bias = -0.0004;
        shadow.normalBias = 0.06;
    }
    sun.userData.shadowHalf = config.half;
    sun.userData.shadowSize = config.size;
    // Materials compile differently with and without shadows.
    return { config, needsRecompile: wasEnabled !== config.enabled || typeChanged };
}

export function recompileMaterials(scene) {
    scene.traverse((object) => {
        if (!object.isMesh) return;
        materialList(object).forEach((material) => { if (material) material.needsUpdate = true; });
    });
}

// Keeps the shadow box centred on the player, snapped to whole shadow texels so
// shadow edges do not shimmer while walking.
export function followSunShadow(sun, x, z) {
    const half = sun.userData.shadowHalf;
    const size = sun.userData.shadowSize;
    if (!half || !size) return;
    const texel = (half * 2) / size;
    const tx = Math.round(x / texel) * texel;
    const tz = Math.round(z / texel) * texel;
    sun.target.position.set(tx, 0, tz);
    sun.position.set(
        tx + SUN_DIRECTION.x * SUN_DISTANCE,
        SUN_DIRECTION.y * SUN_DISTANCE,
        tz + SUN_DIRECTION.z * SUN_DISTANCE,
    );
    sun.target.updateMatrixWorld();
}
