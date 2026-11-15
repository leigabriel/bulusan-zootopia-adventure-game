import * as THREE from 'three';
import { clone as cloneWithSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLB } from '../utils/glbCache.js';
import { getAnimalBookEntry } from '../data/animalMetadata.js';
import { sampleSmoothPath } from '../utils/riverMath.js';
import { getWaterSurfaceHeight } from './River.jsx';
import { AMBIENT_SOUND_RADIUS, createAnimalSound, spatialSoundFactor } from './Animals.jsx';

// Koi swim up and down the river and frogs sit at the water's edge. Both are
// watch-only: they never block the player and are not part of the feeding tasks.

const PATH_STEPS = 240;
let pathTable = null;

// The river centre line sampled once as x, z and a unit tangent per step.
function getPathTable() {
    if (pathTable) return pathTable;
    const xs = new Float32Array(PATH_STEPS + 1);
    const zs = new Float32Array(PATH_STEPS + 1);
    for (let i = 0; i <= PATH_STEPS; i += 1) {
        const point = sampleSmoothPath(i / PATH_STEPS);
        xs[i] = point.x;
        zs[i] = point.y;
    }
    pathTable = { xs, zs };
    return pathTable;
}

// Position at path parameter t (0..1) pushed `lateral` units sideways.
function pathPoint(t, lateral, out) {
    const { xs, zs } = getPathTable();
    const scaled = THREE.MathUtils.clamp(t, 0, 1) * PATH_STEPS;
    const i = Math.min(PATH_STEPS - 1, Math.floor(scaled));
    const f = scaled - i;
    const x = xs[i] + (xs[i + 1] - xs[i]) * f;
    const z = zs[i] + (zs[i + 1] - zs[i]) * f;
    const tx = xs[i + 1] - xs[i];
    const tz = zs[i + 1] - zs[i];
    const length = Math.hypot(tx, tz) || 1;
    // The river flows towards +x, so (-tz, tx) is the +z side normal: positive
    // `lateral` moves towards +z, negative towards -z.
    out.x = x + (-tz / length) * lateral;
    out.z = z + (tx / length) * lateral;
    return out;
}

class RiverCreature {
    constructor({ model, animations, config, scene, river }) {
        this.group = model;
        this.config = config;
        this.river = river;
        this.noCollision = true;
        this.radius = config.collisionRadius ?? 0.5;
        this.mixer = null;
        this.sfxSetting = 1;
        this.soundGain = config.soundGain ?? 0.8;
        this.sound = config.soundFile ? createAnimalSound(config.soundFile, 0) : null;
        // Stagger the frogs so they do not croak in unison.
        this.nextCroakAt = 1 + Math.random() * 8;

        const box = new THREE.Box3().setFromObject(this.group);
        const size = box.getSize(new THREE.Vector3());
        this.group.scale.multiplyScalar(THREE.MathUtils.clamp(config.targetHeight / Math.max(size.y, 0.001), 0.01, 25));
        this.group.rotation.order = 'YXZ';

        if (animations?.length) {
            this.mixer = new THREE.AnimationMixer(this.group);
            const clip = animations.find((c) => c.name.toLowerCase().includes(config.animation ?? 'idle')) || animations[0];
            const action = this.mixer.clipAction(clip);
            action.time = Math.random() * clip.duration;
            action.play();
        }
        this.group.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });
        scene.add(this.group);
    }

    getInfo() {
        const metadata = getAnimalBookEntry(this.config.name) || {};
        return {
            name: this.config.name,
            species: metadata.scientific || this.config.species,
            emoji: metadata.emoji || this.config.emoji,
            description: metadata.description || this.config.description,
            dangerous: false,
            observeOnly: true,
        };
    }

    update(t, dt, listenerPosition = null, sfxSetting = null) {
        this.mixer?.update(dt);
        if (typeof sfxSetting === 'number') this.sfxSetting = sfxSetting;
        if (!this.sound || !listenerPosition) return;

        const dx = listenerPosition.x - this.group.position.x;
        const dz = listenerPosition.z - this.group.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        this.spatialFactor = spatialSoundFactor(dist);
        const targetVol = THREE.MathUtils.clamp((this.sfxSetting ?? 1) * this.soundGain * this.spatialFactor, 0, 1);

        // A croak that is already playing fades with distance and stops when out of range.
        if (!this.sound.paused) {
            this.sound.volume = THREE.MathUtils.clamp(this.sound.volume + (targetVol - this.sound.volume) * Math.min(1, dt * 7.5), 0, 1);
            if (targetVol <= 0.005 && this.sound.volume <= 0.01) this.stopSound();
            return;
        }
        if (dist >= AMBIENT_SOUND_RADIUS || t < this.nextCroakAt || targetVol <= 0.01) return;
        this.sound.volume = targetVol;
        this.sound.currentTime = 0;
        this.sound.play().catch(() => { });
        this.nextCroakAt = t + 6 + Math.random() * 10;
    }

    updateVolume(volume) {
        this.sfxSetting = THREE.MathUtils.clamp(volume, 0, 1);
        if (this.sound) this.sound.volume = this.sfxSetting * this.soundGain * (this.spatialFactor ?? 1);
    }

    stopSound(reset = true) {
        if (!this.sound) return;
        this.sound.pause();
        if (reset) this.sound.currentTime = 0;
    }

    dispose() {
        if (this.sound) {
            this.sound.pause();
            this.sound.removeAttribute('src');
            this.sound.load();
            this.sound = null;
        }
        this.mixer?.stopAllAction();
        this.mixer?.uncacheRoot(this.group);
        this.group.parent?.remove(this.group);
    }
}

const scratchA = { x: 0, z: 0 };
const scratchB = { x: 0, z: 0 };

class Koi extends RiverCreature {
    constructor(options, swim) {
        super(options);
        this.swim = swim;
        this.heading = 0;
        this.group.position.y = -100;
    }

    update(t, dt) {
        super.update(t, dt);
        const { centre, range, speed, phase, lateral, wobble } = this.swim;
        // Glide up and down the stretch of river; a slow sideways drift keeps the school loose.
        const s = centre + Math.sin(t * speed + phase) * range;
        const ahead = centre + Math.sin((t + 0.4) * speed + phase) * range;
        const sideNow = Math.sin(t * wobble + phase * 2) * lateral;
        const sideAhead = Math.sin((t + 0.4) * wobble + phase * 2) * lateral;
        pathPoint(s, sideNow, scratchA);
        pathPoint(ahead, sideAhead, scratchB);
        const targetHeading = Math.atan2(scratchB.x - scratchA.x, scratchB.z - scratchA.z);
        let delta = targetHeading - this.heading;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.heading += delta * Math.min(1, dt * 3);
        const surface = getWaterSurfaceHeight(this.river, scratchA.x, scratchA.z);
        // Back just breaks the surface: the water is fairly opaque.
        this.group.position.set(scratchA.x, surface - 0.42 + Math.sin(t * 2 + this.swim.phase) * 0.04, scratchA.z);
        this.group.rotation.y = this.heading;
    }
}

const KOI = { name: 'Koi Fish', species: 'Cyprinus rubrofuscus', emoji: '🐟', targetHeight: 1.1, collisionRadius: 0.8, animation: 'swim' };
const FROG = { name: 'Frog', species: 'Ranidae', emoji: '🐸', soundFile: 'frog.mp3', soundGain: 0.8, targetHeight: 0.5, collisionRadius: 0.6, animation: 'idle' };

// Koi stretches and frog spots along the river, by position along the path.
const KOI_SWIMS = [
    { centre: 0.46, range: 0.05, speed: 0.22, phase: 0, lateral: 1.6, wobble: 0.5 },
    { centre: 0.49, range: 0.045, speed: 0.19, phase: 2.1, lateral: 1.8, wobble: 0.43 },
    { centre: 0.52, range: 0.05, speed: 0.24, phase: 4.0, lateral: 1.5, wobble: 0.57 },
    { centre: 0.55, range: 0.04, speed: 0.2, phase: 1.2, lateral: 1.7, wobble: 0.47 },
    { centre: 0.43, range: 0.04, speed: 0.17, phase: 3.3, lateral: 1.6, wobble: 0.52 },
];
const FROG_SPOTS = [
    { t: 0.47, edge: 6.0, angle: 3.3 },
    { t: 0.5, edge: 6.2, angle: 2.8 },
    { t: 0.53, edge: 6.1, angle: 3.6 },
    { t: 0.56, edge: 6.0, angle: 3.0 },
];

export async function loadRiverAnimals(scene, river) {
    if (!river) return [];
    const [koiGltf, frogGltf] = await Promise.all([loadGLB('/models/animals/koi.glb'), loadGLB('/models/animals/frog.glb')]);
    const creatures = [];

    if (koiGltf) {
        KOI_SWIMS.forEach((swim) => {
            creatures.push(new Koi({
                model: cloneWithSkeleton(koiGltf.scene),
                animations: koiGltf.animations.map((clip) => clip.clone()),
                config: KOI,
                scene,
                river,
            }, swim));
        });
    }

    if (frogGltf) {
        FROG_SPOTS.forEach((spot) => {
            const frog = new RiverCreature({
                model: cloneWithSkeleton(frogGltf.scene),
                animations: frogGltf.animations.map((clip) => clip.clone()),
                config: FROG,
                scene,
                river,
            });
            // Sits in the shallows on the near (-z) bank, facing out across the water.
            pathPoint(spot.t, -spot.edge, scratchA);
            const surface = getWaterSurfaceHeight(river, scratchA.x, scratchA.z);
            frog.group.position.set(scratchA.x, surface - 0.06, scratchA.z);
            frog.group.rotation.y = spot.angle;
            creatures.push(frog);
        });
    }
    return creatures;
}
