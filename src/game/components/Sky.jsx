import * as THREE from 'three';
import {
    CLOUD_BUDGET, CLOUD_WRAP, SUN_DIRECTION, generateClouds,
} from '../utils/skyConfig.js';

// Sky: volumetric-looking clouds, a visible sun and god rays.
//
// Every cloud puff is a camera-facing quad in ONE instanced draw call. The
// fragment shader treats each quad as a ball of vapor: a sphere normal gives
// soft lighting from the sun, the ball's thickness plus animated noise erodes
// the edge into a fluffy outline, and cloud edges glow when the sun is behind
// them. That reads as volume without ray marching, so it stays cheap at 60 fps.

const SUN_DISTANCE = 520;
const SUN_SIZE = 170;
const CLOUD_SPEED = 1.4;

const CLOUD_VERTEX = `
    uniform float uTime;
    uniform float uWrap;
    uniform float uSpeed;
    attribute vec3 aOrigin;
    attribute vec4 aPuff;
    attribute vec2 aInfo;
    varying vec2 vUv;
    varying float vShade;
    varying float vPhase;
    void main() {
        vec3 centre = aOrigin;
        centre.x = mod(centre.x + uTime * uSpeed + uWrap * 0.5, uWrap) - uWrap * 0.5;
        centre += aPuff.xyz;
        vec4 view = modelViewMatrix * vec4(centre, 1.0);
        view.xy += position.xy * aPuff.w * 2.0;
        gl_Position = projectionMatrix * view;
        vUv = position.xy * 2.0;
        vShade = aInfo.x;
        vPhase = aInfo.y;
    }
`;

const CLOUD_FRAGMENT = `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uDetail;
    uniform vec3 uSunView;
    uniform vec3 uLit;
    uniform vec3 uShadow;
    varying vec2 vUv;
    varying float vShade;
    varying float vPhase;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    void main() {
        float r2 = dot(vUv, vUv);
        if (r2 >= 1.0) discard;
        float nz = sqrt(1.0 - r2);

        vec2 seed = vUv + vPhase * 17.0;
        float billow = noise(seed * 2.2 + vec2(uTime * 0.015, 0.0));
        float wisp = noise(seed * 5.5 - vec2(0.0, uTime * 0.02));
        // Thickness of the vapor ball, eroded by noise into a ragged edge.
        float density = nz * 1.2 + (billow - 0.5) * 0.95 + (wisp - 0.5) * 0.35 * uDetail - 0.3;
        float alpha = smoothstep(0.0, 0.55, density) * uOpacity;
        if (alpha < 0.01) discard;

        vec3 normal = normalize(vec3(vUv + (vec2(billow, wisp) - 0.5) * 0.35, nz));
        float lit = dot(normal, uSunView) * 0.5 + 0.5;
        float light = clamp(lit * 0.8 + vShade * 0.3, 0.0, 1.0);
        vec3 colour = mix(uShadow, uLit, light);

        // Silver lining: edges glow when the sun is behind the cloud.
        float behind = clamp(-uSunView.z, 0.0, 1.0);
        float lining = pow(1.0 - nz, 2.5) * behind;
        colour += vec3(1.0, 0.94, 0.8) * lining * 0.7;

        gl_FragColor = vec4(colour, alpha);
        #include <colorspace_fragment>
    }
`;

const SUN_FRAGMENT = `
    varying vec2 vUv;
    void main() {
        float r = length(vUv);
        float core = 1.0 - smoothstep(0.13, 0.17, r);
        float halo = pow(max(1.0 - r, 0.0), 3.0) * 0.9;
        float glow = pow(max(1.0 - r, 0.0), 1.4) * 0.22;
        vec3 colour = vec3(1.0, 0.97, 0.82) * core + vec3(1.0, 0.86, 0.5) * (halo + glow);
        float alpha = clamp(core + halo + glow, 0.0, 1.0);
        gl_FragColor = vec4(colour, alpha);
        #include <colorspace_fragment>
    }
`;

const RAYS_VERTEX = `
    varying vec2 vScreen;
    void main() {
        vScreen = position.xy;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const RAYS_FRAGMENT = `
    uniform vec2 uSun;
    uniform float uAspect;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uRays;
    varying vec2 vScreen;

    float hash(float n) { return fract(sin(n) * 43758.5453); }
    float noise1(float x) {
        float i = floor(x);
        float f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(hash(i), hash(i + 1.0), f);
    }

    void main() {
        vec2 d = vScreen - uSun;
        d.x *= uAspect;
        float dist = length(d);
        float angle = atan(d.y, d.x);
        // Beams fan out from the sun; two slowly drifting layers stop them looking static.
        float beams = noise1(angle * uRays + uTime * 0.05) * 0.6 + noise1(angle * uRays * 2.3 - uTime * 0.035) * 0.4;
        beams = smoothstep(0.25, 0.95, beams);
        float falloff = exp(-dist * 1.7);
        float strength = (0.18 + beams * 0.82) * falloff * uIntensity;
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.72) * strength, strength);
    }
`;

function buildCloudGeometry(layout) {
    const total = layout.reduce((sum, cloud) => sum + cloud.puffs.length, 0);
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    const origins = new Float32Array(total * 3);
    const puffs = new Float32Array(total * 4);
    const info = new Float32Array(total * 2);
    let i = 0;
    for (const { origin, puffs: items } of layout) {
        for (const p of items) {
            origins.set([origin.x, origin.y, origin.z], i * 3);
            puffs.set([p.x, p.y, p.z, p.size], i * 4);
            info.set([p.shade, p.phase], i * 2);
            i += 1;
        }
    }
    geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origins, 3));
    geometry.setAttribute('aPuff', new THREE.InstancedBufferAttribute(puffs, 4));
    geometry.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 2));
    geometry.instanceCount = total;
    return geometry;
}

export function createSky(scene, { quality = 'medium', mobile = false } = {}) {
    const budget = CLOUD_BUDGET[quality] || CLOUD_BUDGET.medium;
    const layout = generateClouds({
        clouds: mobile ? Math.min(budget.clouds, 8) : budget.clouds,
        puffs: mobile ? Math.min(budget.puffs, 6) : budget.puffs,
    });

    const cloudMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uWrap: { value: CLOUD_WRAP },
            uSpeed: { value: CLOUD_SPEED },
            uOpacity: { value: 0.92 },
            uDetail: { value: quality === 'low' || mobile ? 0 : 1 },
            uSunView: { value: new THREE.Vector3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z) },
            uLit: { value: new THREE.Color(0xffffff) },
            uShadow: { value: new THREE.Color(0x9db3cf) },
        },
        vertexShader: CLOUD_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        fog: false,
    });
    const cloudGeometry = buildCloudGeometry(layout);
    const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    clouds.frustumCulled = false;
    clouds.renderOrder = 1;
    clouds.name = 'Clouds';
    scene.add(clouds);

    const sunMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = position.xy * 2.0;
                vec4 view = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                view.xy += position.xy * ${SUN_SIZE.toFixed(1)};
                gl_Position = projectionMatrix * view;
            }`,
        fragmentShader: SUN_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
    });
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunMaterial);
    sun.frustumCulled = false;
    sun.renderOrder = 0;
    sun.name = 'Sun';
    scene.add(sun);

    let rays = null;
    if (quality !== 'low') {
        const raysMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uSun: { value: new THREE.Vector2() },
                uAspect: { value: 1 },
                uTime: { value: 0 },
                uIntensity: { value: 0 },
                uRays: { value: quality === 'high' && !mobile ? 14 : 9 },
            },
            vertexShader: RAYS_VERTEX,
            fragmentShader: RAYS_FRAGMENT,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            fog: false,
            toneMapped: false,
        });
        rays = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), raysMaterial);
        rays.frustumCulled = false;
        rays.renderOrder = 20;
        rays.visible = false;
        rays.name = 'GodRays';
        scene.add(rays);
    }

    return {
        clouds, sun, rays, quality,
        materials: [cloudMaterial, sunMaterial, rays?.material].filter(Boolean),
        geometries: [cloudGeometry, sun.geometry, rays?.geometry].filter(Boolean),
        scratch: { sunWorld: new THREE.Vector3(), sunNdc: new THREE.Vector3(), forward: new THREE.Vector3() },
    };
}

export function updateSky(sky, time, camera) {
    if (!sky) return;
    const { clouds, sun, rays, scratch } = sky;
    // Use this frame's camera, not the one from the last render, so the sun and rays do not lag.
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const cloudUniforms = clouds.material.uniforms;
    cloudUniforms.uTime.value = time;
    cloudUniforms.uSunView.value
        .set(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z)
        .transformDirection(camera.matrixWorldInverse);

    // The sun sits at infinity: it follows the camera so it never gets closer.
    sun.position.set(
        camera.position.x + SUN_DIRECTION.x * SUN_DISTANCE,
        camera.position.y + SUN_DIRECTION.y * SUN_DISTANCE,
        camera.position.z + SUN_DIRECTION.z * SUN_DISTANCE
    );

    if (!rays) return;
    // Project the sun to the screen; rays only exist while it is in front of the camera.
    scratch.sunWorld.copy(sun.position);
    scratch.sunNdc.copy(scratch.sunWorld).project(camera);
    camera.getWorldDirection(scratch.forward);
    const facing = scratch.forward.x * SUN_DIRECTION.x + scratch.forward.y * SUN_DIRECTION.y + scratch.forward.z * SUN_DIRECTION.z;
    const offscreen = Math.max(Math.abs(scratch.sunNdc.x), Math.abs(scratch.sunNdc.y));
    const intensity = facing > 0
        ? THREE.MathUtils.clamp(facing * 1.4, 0, 1) * THREE.MathUtils.clamp(1.9 - offscreen, 0, 1) * 0.5
        : 0;
    rays.visible = intensity > 0.01;
    if (!rays.visible) return;
    const uniforms = rays.material.uniforms;
    uniforms.uSun.value.set(scratch.sunNdc.x, scratch.sunNdc.y);
    uniforms.uAspect.value = camera.aspect;
    uniforms.uTime.value = time;
    uniforms.uIntensity.value = intensity;
}

export function disposeSky(scene, sky) {
    if (!sky) return;
    [sky.clouds, sky.sun, sky.rays].forEach((mesh) => mesh && scene.remove(mesh));
    sky.materials.forEach((material) => material.dispose());
    sky.geometries.forEach((geometry) => geometry.dispose());
}
