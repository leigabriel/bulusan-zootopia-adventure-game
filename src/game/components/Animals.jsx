import * as THREE from 'three';
import { clone as cloneWithSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { alignObjectToTerrain, getTerrainHeight, PLAYABLE_BOUNDARY } from './Terrain.jsx';
import { isLandAccessible } from './River.jsx';
import { PARROT_RUN_RESIDENTS, TIGER_ENCLOSURE, WORLD_PROPS } from '../data/worldPoints.js';
import { resolveAssetUrl } from '../utils/localAssets.js';
import { createGLTFLoader } from '../utils/gltfLoader.js';
import { getAnimalBookEntry } from '../data/animalMetadata.js';
import { createContactShadow } from '../utils/contactShadow.js';

// Fixed spots under the parrot run for one resident species.
function parrotRunSpots(key) {
    const run = WORLD_PROPS.parrotRun;
    return PARROT_RUN_RESIDENTS[key].map((spot) => ({ x: run.x + spot.x, z: run.z + spot.z, angle: spot.angle }));
}

const ANIMAL_CONFIGS = [
    {
        file: 'Deer.gltf',
        soundFile: 'deer.mp3',
        soundGain: 0.85,
        scale: 1.3,
        speed: 0.05,
        runSpeed: 0.11,
        count: 1,
        name: 'White-tailed Deer',
        species: 'Odocoileus virginianus',
        emoji: '🦌',
        description: 'A graceful herbivore known for the white underside of its tail, often raised as an alarm signal.'
    },
    {
        file: 'Horse.gltf',
        soundFile: 'horse.mp3',
        soundGain: 0.80,
        scale: 1.3,
        speed: 0.08,
        runSpeed: 0.16,
        count: 1,
        name: 'Domestic Horse',
        species: 'Equus caballus',
        emoji: '🐴',
        description: 'A majestic animal that has been a companion to humans for thousands of years.'
    },
    {
        file: 'ostrich/scene.gltf',
        soundFile: 'ostrich.mp3',
        soundGain: 0.80,
        targetHeight: 2.4,
        scale: 3,
        speed: 0,
        runSpeed: 0,
        count: 1,
        movementStyle: 'static',
        idleAnimation: 'play',
        spawnArea: { x: 105, z: -80, radius: 18 },
        name: 'Ostrich',
        species: 'Struthio camelus',
        emoji: '🦤',
        description: 'The world’s largest living bird, known for its long legs and remarkable speed.'
    },
    {
        file: 'Donkey.gltf',
        soundFile: 'donkey.mp3',
        soundGain: 0.75,
        scale: 1.5,
        speed: 0.05,
        runSpeed: 0.09,
        count: 1,
        name: 'Donkey',
        species: 'Equus asinus',
        emoji: '🫏',
        description: 'A sure-footed and hardy animal, often used as a working companion.'
    },
    {
        file: 'Cow.gltf',
        soundFile: 'cow.mp3',
        soundGain: 0.80,
        scale: 1.1,
        speed: 0.04,
        runSpeed: 0.07,
        count: 1,
        name: 'Domestic Cow',
        species: 'Bos taurus',
        emoji: '🐄',
        description: 'A gentle herbivore raised for milk and companionship in farms worldwide.'
    },
    {
        file: 'Alpaca.gltf',
        soundFile: 'alpaca.mp3',
        soundGain: 0.85,
        scale: 1.1,
        speed: 0.05,
        runSpeed: 0.09,
        count: 1,
        name: 'Alpaca',
        species: 'Vicugna pacos',
        emoji: '🦙',
        description: 'A fluffy South American camelid, prized for its soft and luxurious fleece.'
    },
    {
        file: 'Stag.gltf',
        soundFile: 'redd.mp3',
        soundGain: 0.80,
        scale: 1.3,
        speed: 0.06,
        runSpeed: 0.13,
        collisionRadius: 2.0,
        count: 1,
        name: 'Red Deer Stag',
        species: 'Cervus elaphus',
        emoji: '🦌',
        description: 'A magnificent male deer with impressive antlers, symbol of wild forests.'
    },
    {
        file: 'Bull.gltf',
        soundFile: 'bull.wav',
        soundGain: 0.75,
        scale: 1.4,
        speed: 0.045,
        runSpeed: 0.085,
        collisionRadius: 1.8,
        count: 1,
        name: 'Bull',
        species: 'Bos taurus',
        emoji: '🐃',
        description: 'A powerful and muscular male bovine, respected for its strength and presence.'
    },
    {
        file: 'monkey/scene.gltf',
        soundFile: 'monkey.mp3',
        soundGain: 0.80,
        targetHeight: 1.5,
        scale: 1.3,
        speed: 0.04,
        runSpeed: 0.08,
        collisionRadius: 1.15,
        count: 1,
        movementStyle: 'static',
        spawnArea: { x: -100, z: -70, radius: 24 },
        name: 'Forest Monkey',
        species: 'Macaca fascicularis',
        emoji: '🐒',
        description: 'A monkey resting in the forest area.'
    },
    {
        file: 'rabbit/scene.gltf',
        scale: 0.05,
        speed: 0.03,
        runSpeed: 0.05,
        collisionRadius: 0.65,
        count: 5,
        movementStyle: 'walkOnly',
        walkAnimation: 'Walk',
        spawnArea: { x: -30, z: 65, radius: 6 },
        name: 'Rabbit',
        species: 'Oryctolagus cuniculus',
        emoji: '🐇',
        description: 'A small, speedy friend with a twitching nose and soft fur.'
    },
    {
        file: 'tiger/scene.gltf',
        scale: 4.25,
        soundFile: 'tiger.mp3',
        soundGain: 0.85,
        speed: 0.038,
        runSpeed: 0.082,
        count: 1,
        collisionRadius: 2.2,
        movementStyle: 'static',
        idleAnimation: 'Idle_Lie Prone',
        spawnArea: { x: 145, z: 120, radius: 10 },
        dangerous: true,
        name: 'Bengal Tiger',
        species: 'Panthera tigris tigris',
        emoji: '🐅',
        description: 'A majestic big cat in a natural standing idle pose.'
    },
    // Visitors can watch and photograph these, but they are not feeding tasks.
    {
        file: 'parrot.glb',
        soundFile: 'bird-chirping.mp3',
        soundGain: 0.45,
        targetHeight: 1.6,
        scale: 1,
        speed: 0,
        runSpeed: 0,
        collisionRadius: 0.8,
        count: 1,
        movementStyle: 'static',
        idleAnimation: 'Idle',
        spawnPositions: parrotRunSpots('parrot'),
        observeOnly: true,
        name: 'Parrot',
        species: 'Psittacidae',
        emoji: '🦜',
        description: 'A colourful, clever bird that can copy sounds and even words.'
    },
    {
        file: 'pigeon.glb',
        soundFile: 'bird-chirping.mp3',
        soundGain: 0.4,
        targetHeight: 0.9,
        scale: 1,
        speed: 0,
        runSpeed: 0,
        collisionRadius: 0.5,
        count: 2,
        movementStyle: 'static',
        idleAnimation: 'Idle',
        spawnPositions: parrotRunSpots('pigeon'),
        observeOnly: true,
        name: 'Pigeon',
        species: 'Columba livia',
        emoji: '🐦',
        description: 'A gentle city bird with a great sense of direction.'
    },
    {
        file: 'owl.glb',
        targetHeight: 1.2,
        scale: 1,
        speed: 0,
        runSpeed: 0,
        collisionRadius: 0.6,
        count: 1,
        movementStyle: 'static',
        idleAnimation: 'Idle',
        spawnPositions: parrotRunSpots('owl'),
        observeOnly: true,
        name: 'Owl',
        species: 'Strigidae',
        emoji: '🦉',
        description: 'A silent night hunter with big eyes and sharp hearing.'
    },
    {
        file: 'goat.glb',
        targetHeight: 2.0,
        scale: 1,
        speed: 0.05,
        runSpeed: 0.1,
        collisionRadius: 1.3,
        count: 2,
        spawnArea: { x: 100, z: -116, radius: 10 },
        observeOnly: true,
        name: 'Goat',
        species: 'Capra hircus',
        emoji: '🐐',
        description: 'A sure-footed climber that loves to nibble on leaves and grass.'
    },
    {
        file: 'forest-rabbit.glb',
        targetHeight: 1.0,
        scale: 1,
        speed: 0.03,
        runSpeed: 0.05,
        collisionRadius: 0.6,
        count: 3,
        movementStyle: 'walkOnly',
        walkAnimation: 'Walk',
        spawnArea: { x: 70, z: -52, radius: 8 },
        observeOnly: true,
        name: 'Forest Rabbit',
        species: 'Sylvilagus floridanus',
        emoji: '🐰',
        description: 'A shy rabbit that hops along the forest edge looking for tender plants.'
    }
];

const AMBIENT_SOUND_RADIUS = 55;
const AMBIENT_SOUND_RADIUS_SQ = AMBIENT_SOUND_RADIUS * AMBIENT_SOUND_RADIUS;
const AMBIENT_SOUND_MIN_INTERVAL = 5;
const AMBIENT_SOUND_MAX_INTERVAL = 11;

function createAnimalSound(soundFile, initialVolume = 0.75) {
    if (!soundFile || typeof Audio === 'undefined') return null;
    const normalized = String(soundFile).replace(/^\/+/, '');
    const fallbackPath = `/audio/${normalized}`;
    const audio = new Audio(fallbackPath);
    audio.preload = 'auto';
    audio.volume = initialVolume;
    audio.setAttribute('playsinline', 'true');

    resolveAssetUrl(fallbackPath)
        .then((assetUrl) => {
            if (assetUrl) {
                audio.src = assetUrl;
            }
        })
        .catch(() => { });

    return audio;
}

function isBlockedByObstacle(x, z, radius, obstacles) {
    if (!obstacles || obstacles.length === 0) return false;
    for (const obs of obstacles) {
        const dx = x - obs.x;
        const dz = z - obs.z;
        const minDist = radius + obs.radius;
        if (dx * dx + dz * dz < minDist * minDist) {
            return true;
        }
    }
    return false;
}

// The tiger stays inside its fenced enclosure and every other animal stays out.
function violatesEnclosure(config, x, z, radius) {
    const inside = Math.abs(x - TIGER_ENCLOSURE.x) < TIGER_ENCLOSURE.halfSize - radius - 1
        && Math.abs(z - TIGER_ENCLOSURE.z) < TIGER_ENCLOSURE.halfSize - radius - 1;
    if (config.name === 'Bengal Tiger') return !inside;
    return Math.abs(x - TIGER_ENCLOSURE.x) < TIGER_ENCLOSURE.halfSize + radius + 1
        && Math.abs(z - TIGER_ENCLOSURE.z) < TIGER_ENCLOSURE.halfSize + radius + 1;
}

function findSpawnPosition(spawnIndex, totalAnimals, bounds, radius, obstacles, spawnArea = null, config = {}) {
    const hasSpawnArea = spawnArea
        && Number.isFinite(spawnArea.x)
        && Number.isFinite(spawnArea.z);
    const maxAttempts = hasSpawnArea ? 60 : 40;

    for (let i = 0; i < maxAttempts; i++) {
        let x;
        let z;

        if (hasSpawnArea) {
            const areaRadius = Math.max(radius + 1.5, Number.isFinite(spawnArea.radius) ? spawnArea.radius : 12);
            const angle = Math.random() * Math.PI * 2;
            const radial = Math.sqrt(Math.random()) * areaRadius;
            x = spawnArea.x + Math.cos(angle) * radial;
            z = spawnArea.z + Math.sin(angle) * radial;
        } else {
            const ring = 30 + (spawnIndex * 14) + Math.random() * 18;
            const angle = (spawnIndex / totalAnimals) * Math.PI * 2 + Math.random() * Math.PI * 0.8;
            x = Math.cos(angle) * ring;
            z = Math.sin(angle) * ring;
        }

        if (Math.abs(x) > bounds - radius || Math.abs(z) > bounds - radius) continue;
        if (!isBlockedByObstacle(x, z, radius, obstacles) && isLandAccessible(x, z, radius) && !violatesEnclosure(config, x, z, radius)) {
            return { x, z };
        }
    }

    if (hasSpawnArea) {
        const fallbackRadius = Math.max(radius + 1, (Number.isFinite(spawnArea.radius) ? spawnArea.radius : 12) * 0.4);
        const fallbackAngle = Math.random() * Math.PI * 2;
        const fallback = {
            x: THREE.MathUtils.clamp(spawnArea.x + Math.cos(fallbackAngle) * fallbackRadius, -(bounds - radius), bounds - radius),
            z: THREE.MathUtils.clamp(spawnArea.z + Math.sin(fallbackAngle) * fallbackRadius, -(bounds - radius), bounds - radius),
        };
        return isLandAccessible(fallback.x, fallback.z, radius) ? fallback : { x: 0, z: -35 };
    }

    // Safe fallback if all sampled points are blocked.
    const fallback = {
        x: Math.cos(Math.random() * Math.PI * 2) * 50,
        z: Math.sin(Math.random() * Math.PI * 2) * 50,
    };
    return isLandAccessible(fallback.x, fallback.z, radius) ? fallback : { x: 0, z: -35 };
}

function getTerrainNormalAt(target, x, z, sample = 1.6) {
    const hL = getTerrainHeight(x - sample, z);
    const hR = getTerrainHeight(x + sample, z);
    const hD = getTerrainHeight(x, z - sample);
    const hU = getTerrainHeight(x, z + sample);
    return target.set(hL - hR, 2 * sample, hD - hU).normalize();
}

function getRandomSpecialInterval(config) {
    const min = config.specialAnimationIntervalMin ?? config.specialAnimationInterval ?? 0;
    const max = config.specialAnimationIntervalMax ?? min;
    if (max <= min) return Math.max(0, min);
    return min + Math.random() * (max - min);
}

class GLTFAnimal {
    // Added 'obstacles' and 'initialVolume' to the constructor
    constructor(model, animations, config, scene, spawnIndex, obstacles, initialVolume = 0.75) {
        this.group = model;
        this.config = config;
        this.obstacles = obstacles; // Store obstacles for AI logic
        this.soundVolume = initialVolume;
        this.sfxSetting = initialVolume;
        this.baseSoundGain = config.soundGain ?? 0.85;
        this.currentSpatialFactor = 0;
        this.dynamicBox = new THREE.Box3();
        this.terrainNormal = new THREE.Vector3();
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.transitionTime = 0.4;

        if (typeof config.targetHeight === 'number' && config.targetHeight > 0) {
            // Some third-party assets come with wildly different unit scales.
            // Fit to a target world height so they appear at expected size.
            const fitBox = new THREE.Box3().setFromObject(this.group);
            const fitSize = new THREE.Vector3();
            fitBox.getSize(fitSize);
            const sourceHeight = Math.max(fitSize.y, 0.001);
            const rawFitScale = config.targetHeight / sourceHeight;
            // Guard against bad bounds from malformed/skinned assets.
            const fitScale = Number.isFinite(rawFitScale)
                ? THREE.MathUtils.clamp(rawFitScale, 0.01, 25)
                : 1;
            this.group.scale.multiplyScalar(fitScale);
        }

        // Apply the configured size after normalization. Otherwise targetHeight
        // cancels config.scale, making per-animal scale changes appear to do nothing.
        this.group.scale.multiplyScalar(config.scale);

        this.group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = config.file !== 'ostrich/scene.gltf';
                if (child.material) {
                    child.material.side = THREE.FrontSide;
                    if (config.file === 'ostrich/scene.gltf') {
                        child.material.color.set(0xffffff);
                        child.material.emissive = new THREE.Color(0x555555);
                        child.material.emissiveIntensity = 0.2;
                    }
                }
            }
        });

        if (animations && animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.group);
            animations.forEach(clip => {
                const action = this.mixer.clipAction(clip);
                action.setEffectiveTimeScale(1);
                action.setEffectiveWeight(1);
                action.enabled = true;
                this.actions[clip.name.toLowerCase()] = action;
            });

            const actionKeys = Object.keys(this.actions);
            if (actionKeys.length > 0) {
                const forcedIdleName = this.config.idleAnimation ? this.config.idleAnimation.toLowerCase() : '';
                const forcedIdleKey = forcedIdleName
                    ? actionKeys.find(k => k === forcedIdleName || k.includes(forcedIdleName))
                    : null;
                const safeIdleKeys = actionKeys.filter((k) => (k.includes('run') || k.includes('walk') || k.includes('idle') || k.includes('stand') || k.includes('breathing') || k.includes('eating') || k.includes('eat') || k.includes('rest') || k.includes('sit')) && !k.includes('lie') && !k.includes('prone') && !k.includes('attack') && !k.includes('death'));
                const safestAnyKey = actionKeys.find((k) => !k.includes('lie') && !k.includes('prone') && !k.includes('attack') && !k.includes('death'));
                const idleKey = forcedIdleKey || safeIdleKeys[0] || safestAnyKey;
                const firstAction = this.actions[idleKey];
                if (firstAction) {
                    firstAction.reset();
                    firstAction.play();
                    this.currentAction = firstAction;
                    this.mixer.update(0);
                }
            }
        }

        const spawnRadius = 30 + (spawnIndex * 14) + Math.random() * 18;
        const spawnAngle = (spawnIndex / ANIMAL_CONFIGS.length) * Math.PI * 2 + Math.random() * 0.5;

        this.pos = new THREE.Vector3(Math.cos(spawnAngle) * spawnRadius, 0, Math.sin(spawnAngle) * spawnRadius);
        this.angle = Math.random() * Math.PI * 2;
        this.targetAngle = this.angle;
        this.timer = 4 + Math.random() * 5;
        this.state = 'idle';
        this.turnSpeed = 0.04;
        this.bounds = PLAYABLE_BOUNDARY - 3;
        this.radius = config.collisionRadius ?? Math.max(1.1, config.scale * 0.65);
        this.movementStyle = config.movementStyle ?? 'default';
        this.currentSpeed = 0;
        this.targetSpeed = 0;
        this.sound = createAnimalSound(config.soundFile, this.soundVolume);
        this.nextAmbientSoundAt = Math.random() * 3;
        this.motionOffset = Math.random() * Math.PI * 2;
        this.shadow = createContactShadow(this.radius * 2.35, 0.23);
        this.slopePitch = 0;
        this.slopeRoll = 0;
        this.nextSpecialAnimationAt = performance.now() * 0.001 + getRandomSpecialInterval(config);
        this.specialAnimationActive = false;
        this.specialAnimationEndAt = 0;
        this.group.rotation.order = 'YXZ';

        if (this.movementStyle === 'walkOnly') {
            this.state = 'walk';
            this.timer = 4 + Math.random() * 6;
            this.targetAngle = this.angle + (Math.random() - 0.5) * 1.1;
            this.targetSpeed = this.config.speed;
            this.playAnimation(this.config.walkAnimation ? this.config.walkAnimation.toLowerCase() : 'walk');
        }

        const spawn = findSpawnPosition(spawnIndex, ANIMAL_CONFIGS.length, this.bounds, this.radius, this.obstacles, config.spawnArea, config);
        this.pos.x = spawn.x;
        this.pos.z = spawn.z;
        if (config.spawnPosition) {
            // Exact spot (for animals that live in a specific place, like the parrot run).
            this.pos.x = config.spawnPosition.x;
            this.pos.z = config.spawnPosition.z;
            if (Number.isFinite(config.spawnPosition.angle)) {
                this.angle = config.spawnPosition.angle;
                this.targetAngle = this.angle;
            }
        }

        const h = getTerrainHeight(this.pos.x, this.pos.z);
        this.group.position.set(this.pos.x, h, this.pos.z);
        this.group.rotation.y = this.angle;
        alignObjectToTerrain(this.group, h, this.dynamicBox, config.groundClearance ?? 0.01);
        // alignObjectToTerrain lifts/lowers the model so its lowest point touches
        // the ground. Remember that offset: update() used to reset y to the raw
        // terrain height every frame, which sank or floated models whose origin
        // is not at their feet.
        this.groundOffset = this.group.position.y - h;
        // Shared list of players, NPCs and other animals (set by the game).
        this.dynamicObstacles = null;

        this.shadow.position.set(this.pos.x, h + 0.055, this.pos.z);
        scene.add(this.group);
        scene.add(this.shadow);
    }

    // Highest ground under the body: the centre plus four points around the
    // collision radius, so legs do not clip into the uphill side of a slope.
    getGroundHeight() {
        const { x, z } = this.pos;
        const reach = this.radius * 0.6;
        const centre = getTerrainHeight(x, z);
        const around = (
            getTerrainHeight(x + reach, z) + getTerrainHeight(x - reach, z)
            + getTerrainHeight(x, z + reach) + getTerrainHeight(x, z - reach)
        ) / 4;
        return Math.max(centre, (centre + around) / 2);
    }

    getInfo() {
        const metadata = getAnimalBookEntry(this.config.name) || {};
        return {
            name: this.config.name,
            species: metadata.scientific || this.config.species,
            emoji: metadata.emoji || this.config.emoji,
            description: metadata.description || this.config.description,
            requiredItem: this.config.requiredItem,
            hasRequiredItem: this.config.hasRequiredItem,
            dangerous: this.config.dangerous === true,
            observeOnly: this.config.observeOnly === true,
        };
    }

    updateVolume(volume) {
        const nextVol = THREE.MathUtils.clamp(volume, 0, 1);
        this.sfxSetting = nextVol;
        if (this.sound) {
            this.sound.volume = nextVol * (this.currentSpatialFactor ?? 1) * (this.baseSoundGain ?? 0.85);
        }
    }

    async playSound(listenerPosition = null, sfxSetting = null) {
        if (!this.sound) return;
        const currentSfxSetting = typeof sfxSetting === 'number' ? sfxSetting : (this.sfxSetting ?? 1.0);

        let initialFactor = 0.5;
        if (listenerPosition && this.group) {
            const dx = listenerPosition.x - this.group.position.x;
            const dz = listenerPosition.z - this.group.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= 4.0) {
                initialFactor = 1.0;
            } else if (dist < AMBIENT_SOUND_RADIUS) {
                const norm = 1.0 - (dist - 4.0) / (AMBIENT_SOUND_RADIUS - 4.0);
                initialFactor = norm * norm;
            } else {
                return;
            }
        }

        const baseGain = this.baseSoundGain ?? 0.85;
        const targetVol = currentSfxSetting * baseGain * initialFactor;
        if (targetVol <= 0.01) return;

        try {
            this.sound.volume = Math.min(0.04, targetVol);
            this.sound.currentTime = 0;
            await this.sound.play();
        } catch {
            // Audio error fallback
        }
    }

    stopSound(reset = true) {
        if (!this.sound) return;
        this.sound.pause();
        if (reset) {
            this.sound.currentTime = 0;
        }
    }

    scheduleNextAmbientSound(nowSeconds) {
        const delay = AMBIENT_SOUND_MIN_INTERVAL + Math.random() * (AMBIENT_SOUND_MAX_INTERVAL - AMBIENT_SOUND_MIN_INTERVAL);
        this.nextAmbientSoundAt = nowSeconds + delay;
    }

    maybePlayAmbientSound(nowSeconds, listenerPosition, soundEnabled) {
        if (!soundEnabled || !listenerPosition || !this.group || !this.sound) return;

        const dx = listenerPosition.x - this.group.position.x;
        const dz = listenerPosition.z - this.group.position.z;
        if ((dx * dx) + (dz * dz) > AMBIENT_SOUND_RADIUS_SQ) return;

        if (nowSeconds < this.nextAmbientSoundAt) return;

        this.playSound(listenerPosition, this.sfxSetting ?? 1.0);
        this.scheduleNextAmbientSound(nowSeconds);
    }

    playAnimation(name, options = {}) {
        const actionKeys = Object.keys(this.actions);
        if (actionKeys.length === 0) return;

        let action = this.actions[name];
        if (!action) {
            const walkKeys = actionKeys.filter(k => k.includes('walk') || k.includes('trot') || k.includes('prowl') || k.includes('stalk'));
            const runKeys = actionKeys.filter(k => k.includes('run') || k.includes('gallop') || k.includes('sprint') || k.includes('leap'));
            const idleKeys = actionKeys.filter(k => (k.includes('run') || k.includes('walk') || k.includes('idle') || k.includes('stand') || k.includes('breathing') || k.includes('eating') || k.includes('eat') || k.includes('rest') || k.includes('sit')) && !k.includes('lie') && !k.includes('prone') && !k.includes('attack') && !k.includes('death'));

            if (name === 'idle' && this.config.idleAnimation) {
                const forcedIdleName = this.config.idleAnimation.toLowerCase();
                const forcedIdle = actionKeys.find(k => k === forcedIdleName || k.includes(forcedIdleName));
                if (forcedIdle) {
                    action = this.actions[forcedIdle];
                }
            }

            if (!action && name === 'walk' && walkKeys.length > 0) action = this.actions[walkKeys[0]];
            else if (!action && name === 'run' && runKeys.length > 0) action = this.actions[runKeys[0]];
            else if (!action && name === 'run' && walkKeys.length > 0) action = this.actions[walkKeys[0]];
            else if (!action && name === 'idle' && idleKeys.length > 0) action = this.actions[idleKeys[0]];
            else action = null;
        }

        if (action && action !== this.currentAction) {
            if (this.currentAction) this.currentAction.fadeOut(this.transitionTime);
            action.enabled = true;
            const timeScale = Number.isFinite(options.timeScale) ? options.timeScale : 1;
            action.setEffectiveTimeScale(timeScale);
            action.setEffectiveWeight(1);
            action.setLoop(options.loopOnce ? THREE.LoopOnce : THREE.LoopRepeat, options.loopOnce ? 1 : Infinity);
            action.clampWhenFinished = !!options.loopOnce;
            action.reset();
            action.fadeIn(this.transitionTime);
            action.play();
            this.currentAction = action;
        }
    }

    update(t, dt, listenerPosition = null, sfxSetting = null) {
        if (this.mixer) this.mixer.update(dt);

        if (typeof sfxSetting === 'number') {
            this.sfxSetting = sfxSetting;
        }
        const currentSfxSetting = this.sfxSetting ?? 1.0;
        const baseGain = this.baseSoundGain ?? 0.85;

        // Dynamic spatial sound volume fade-in and fade-out based on character proximity
        if (this.sound && listenerPosition && this.group) {
            const dx = listenerPosition.x - this.group.position.x;
            const dz = listenerPosition.z - this.group.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            let spatialFactor = 0;
            if (dist <= 4.0) {
                spatialFactor = 1.0;
            } else if (dist < AMBIENT_SOUND_RADIUS) {
                const norm = 1.0 - (dist - 4.0) / (AMBIENT_SOUND_RADIUS - 4.0);
                spatialFactor = norm * norm;
            }

            this.currentSpatialFactor = spatialFactor;
            const targetVol = currentSfxSetting * baseGain * spatialFactor;

            if (!this.sound.paused) {
                const curVol = this.sound.volume;
                const newVol = curVol + (targetVol - curVol) * Math.min(1, dt * 7.5);
                this.sound.volume = THREE.MathUtils.clamp(newVol, 0, 1);

                if (targetVol <= 0.005 && this.sound.volume <= 0.01) {
                    this.sound.pause();
                    this.sound.currentTime = 0;
                }
            }
        }

        if (this.movementStyle !== 'static') {
            this.timer -= dt;
            if (this.timer < 0) this.switchBehavior();
        } else {
            this.state = 'idle';
            this.targetSpeed = 0;
            this.currentSpeed = 0;

            const specialName = this.config.specialAnimation;
            const specialInterval = getRandomSpecialInterval(this.config);
            if (specialName && specialInterval > 0) {
                if (this.specialAnimationActive && t >= this.specialAnimationEndAt) {
                    this.specialAnimationActive = false;
                    this.playAnimation('idle');
                }

                if (!this.specialAnimationActive && t >= this.nextSpecialAnimationAt) {
                    const specialChance = THREE.MathUtils.clamp(this.config.specialAnimationChance ?? 1, 0, 1);
                    if (Math.random() > specialChance) {
                        this.nextSpecialAnimationAt = t + specialInterval;
                        this.playAnimation('idle');
                        return;
                    }

                    const wantedName = specialName.toLowerCase();
                    const specialActionKey = Object.keys(this.actions).find((k) => k === wantedName || k.includes(wantedName));
                    const specialAction = specialActionKey ? this.actions[specialActionKey] : null;
                    const specialTimeScale = this.config.specialAnimationTimeScale ?? 0.8;

                    if (specialAction) {
                        this.playAnimation(specialActionKey, { loopOnce: true, timeScale: specialTimeScale });
                        const duration = Math.max(0.01, specialAction.getClip().duration / specialTimeScale);
                        this.specialAnimationEndAt = t + duration;
                        this.specialAnimationActive = true;
                        this.nextSpecialAnimationAt = this.specialAnimationEndAt + specialInterval;
                    } else {
                        this.nextSpecialAnimationAt = t + specialInterval;
                    }
                }
            }
        }

        const frameScale = Math.min(dt * 60, 3);
        if (this.movementStyle !== 'static') {
            const angleDiff = ((this.targetAngle - this.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            // turnSpeed is tuned per 60 fps frame; scale so 30/144 fps match.
            this.angle += angleDiff * Math.min(1, this.turnSpeed * frameScale);
        }

        if (this.movementStyle !== 'static') {
            const speedLerp = 1 - Math.exp(-3 * dt);
            this.currentSpeed += (this.targetSpeed - this.currentSpeed) * speedLerp;
        }

        if (this.movementStyle !== 'static' && (this.state === 'walk' || this.state === 'run')) {
            let nextX = this.pos.x + Math.sin(this.angle) * this.currentSpeed * frameScale;
            let nextZ = this.pos.z + Math.cos(this.angle) * this.currentSpeed * frameScale;
            let hitObstacle = false;

            // --- NEW: ANIMAL COLLISION DETECTION ---
            if (this.obstacles && this.obstacles.length > 0) {
                for (const obs of this.obstacles) {
                    const dx = nextX - obs.x;
                    const dz = nextZ - obs.z;
                    if (dx * dx + dz * dz < Math.pow(this.radius + obs.radius, 2)) {
                        hitObstacle = true;
                        break;
                    }
                }
            }

            // Other animals and NPCs: block only steps that move closer, so two
            // animals that end up overlapping can still walk apart.
            if (!hitObstacle && this.dynamicObstacles) {
                for (const obs of this.dynamicObstacles) {
                    if (obs.owner === this) continue;
                    const limit = this.radius + obs.radius;
                    const nextDx = nextX - obs.x;
                    const nextDz = nextZ - obs.z;
                    const nextSq = nextDx * nextDx + nextDz * nextDz;
                    if (nextSq >= limit * limit) continue;
                    const curDx = this.pos.x - obs.x;
                    const curDz = this.pos.z - obs.z;
                    if (nextSq < curDx * curDx + curDz * curDz) {
                        hitObstacle = true;
                        break;
                    }
                }
            }

            // If they hit an object or hit the world boundary, turn around.
            if (hitObstacle || violatesEnclosure(this.config, nextX, nextZ, this.radius) || !isLandAccessible(nextX, nextZ, this.radius) || Math.abs(nextX) > this.bounds || Math.abs(nextZ) > this.bounds) {
                this.targetAngle += Math.PI * 0.8 + Math.random() * Math.PI * 0.4;
                this.currentSpeed *= 0.8;
            } else {
                this.pos.x = nextX;
                this.pos.z = nextZ;
            }
        }

        const h = this.getGroundHeight();
        this.group.position.set(this.pos.x, h + this.groundOffset, this.pos.z);
        const terrainNormal = getTerrainNormalAt(this.terrainNormal, this.pos.x, this.pos.z);
        const targetPitch = THREE.MathUtils.clamp(Math.atan2(-terrainNormal.z, terrainNormal.y), -0.28, 0.28);
        const targetRoll = THREE.MathUtils.clamp(Math.atan2(terrainNormal.x, terrainNormal.y), -0.28, 0.28);
        const slopeLerp = Math.min(1, dt * 6);
        this.slopePitch += (targetPitch - this.slopePitch) * slopeLerp;
        this.slopeRoll += (targetRoll - this.slopeRoll) * slopeLerp;
        this.group.rotation.set(this.slopePitch, this.angle, this.slopeRoll, 'YXZ');

        if (this.movementStyle === 'bigCat') {
            const motionT = t + this.motionOffset;
            if (this.state === 'idle') {
                // Slow breathing and tiny body sway for natural resting posture.
                this.group.position.y += Math.sin(motionT * 1.6) * 0.045;
                this.group.rotation.z += Math.sin(motionT * 0.7) * 0.018;
            } else if (this.state === 'walk') {
                // Subtle shoulder bob while prowling.
                this.group.position.y += Math.sin(motionT * 5.2) * 0.06;
                this.group.rotation.z += Math.sin(motionT * 2.6) * 0.012;
            } else {
                this.group.position.y += Math.sin(motionT * 7.6) * 0.085;
                this.group.rotation.z += 0;
            }
        } else if (this.movementStyle === 'static') {
            const motionT = t + this.motionOffset;
            this.group.position.y += Math.sin(motionT * 1.15) * 0.02;
            this.group.rotation.y += Math.sin(motionT * 0.55) * 0.012;
        } else {
            this.group.rotation.z = this.slopeRoll;
        }

        // Re-align after animation and slope rotation so animated pivots cannot sink.
        const groundClearance = this.config.groundClearance ?? 0.01;
        const groundingDelta = alignObjectToTerrain(this.group, h, this.dynamicBox, groundClearance);

        if (this.shadow) {
            const airHeight = Math.max(0, groundingDelta);
            this.shadow.position.set(this.pos.x, h + 0.055, this.pos.z);
            this.shadow.material.opacity = THREE.MathUtils.clamp(0.23 - airHeight * 0.1, 0.09, 0.23);
        }
    }

    switchBehavior() {
        if (this.movementStyle === 'static') {
            this.state = 'idle';
            this.timer = 999;
            this.targetSpeed = 0;
            this.playAnimation('idle');
            return;
        }

        if (this.movementStyle === 'walkOnly') {
            this.state = 'walk';
            this.timer = 4 + Math.random() * 6;
            this.targetAngle = this.angle + (Math.random() - 0.5) * 1.3;
            this.targetSpeed = this.config.speed * (0.92 + Math.random() * 0.16);
            this.playAnimation(this.config.walkAnimation ? this.config.walkAnimation.toLowerCase() : 'walk');
            return;
        }

        if (this.movementStyle === 'bigCat') {
            const rand = Math.random();
            if (rand < 0.56) {
                this.state = 'idle';
                this.timer = 6 + Math.random() * 8;
                this.targetSpeed = 0;
                this.targetAngle = this.angle + (Math.random() - 0.5) * 0.8;
                this.playAnimation('idle');
            } else if (rand < 0.92) {
                this.state = 'walk';
                this.timer = 7 + Math.random() * 10;
                this.targetAngle = this.angle + (Math.random() - 0.5) * 1.6;
                this.targetSpeed = this.config.speed * (0.9 + Math.random() * 0.25);
                this.playAnimation('walk');
            } else {
                this.state = 'run';
                this.timer = 2.3 + Math.random() * 2.2;
                this.targetAngle = this.angle + (Math.random() - 0.5) * 1.15;
                this.targetSpeed = this.config.runSpeed * (0.95 + Math.random() * 0.22);
                this.playAnimation('run');
            }
            return;
        }

        const rand = Math.random();
        if (rand < 0.45) {
            this.state = 'idle';
            this.timer = 5 + Math.random() * 7;
            this.targetSpeed = 0;
            this.playAnimation('idle');
        } else if (rand < 0.85) {
            this.state = 'walk';
            this.timer = 6 + Math.random() * 9;
            this.targetAngle = this.angle + (Math.random() - 0.5) * 2.2;
            this.targetSpeed = this.config.speed;
            this.playAnimation('walk');
        } else {
            this.state = 'run';
            this.timer = 3 + Math.random() * 4;
            this.targetAngle = this.angle + (Math.random() - 0.5) * 1.5;
            this.targetSpeed = this.config.runSpeed;
            this.playAnimation('run');
        }
    }

    dispose() {
        this.stopSound(true);
        if (this.sound) {
            this.sound.pause();
            this.sound.removeAttribute('src');
            this.sound.load();
        }
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.group);
        }
        if (this.shadow) {
            this.shadow.parent?.remove(this.shadow);
            this.shadow.geometry?.dispose();
            this.shadow.material?.dispose?.();
            this.shadow = null;
        }
        // Cloned GLTF animals share cached geometry/materials. The cache owns
        // those GPU resources and releases them as a group when the scene ends.
        this.group.parent?.remove(this.group);
    }
}

class AmbientBird {
    constructor(model, animations, scene, birdIndex) {
        this.group = model;
        this.mixer = animations.length > 0 ? new THREE.AnimationMixer(model) : null;

        const skyPositions = [
            { radius: 65, altitude: 42, cx: -35, cz: 25 },
            { radius: 95, altitude: 58, cx: 40, cz: -30 },
            { radius: 120, altitude: 72, cx: -10, cz: -45 },
        ];
        const sky = skyPositions[birdIndex % skyPositions.length];
        this.phase = birdIndex * (Math.PI * 2 / 3) + Math.random() * 0.4;
        this.orbitRadius = sky.radius;
        this.orbitSpeed = 0.04 + (birdIndex * 0.008);
        this.altitude = sky.altitude;
        this.centerX = sky.cx;
        this.centerZ = sky.cz;

        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const sourceHeight = Math.max(size.y, 0.001);
        model.scale.multiplyScalar(THREE.MathUtils.clamp(2.2 / sourceHeight, 0.01, 10));
        model.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = false;
            child.receiveShadow = false;
        });

        if (this.mixer) {
            const flightClip = animations.find((clip) => /fly|flap|wing|flight/i.test(clip.name)) || animations[0];
            this.mixer.clipAction(flightClip).play();
        }

        this.group.rotation.order = 'YXZ';
        scene.add(this.group);
        this.update(0, 0);
    }

    update(time, dt) {
        const angle = this.phase + time * this.orbitSpeed;
        const nextAngle = angle + 0.01;
        const x = this.centerX + Math.cos(angle) * this.orbitRadius;
        const z = this.centerZ + Math.sin(angle) * this.orbitRadius;
        const nextX = this.centerX + Math.cos(nextAngle) * this.orbitRadius;
        const nextZ = this.centerZ + Math.sin(nextAngle) * this.orbitRadius;
        const y = this.altitude + Math.sin(time * 0.9 + this.phase) * 2.2;
        this.group.position.set(x, y, z);
        this.group.rotation.y = Math.atan2(nextX - x, nextZ - z);
        this.group.rotation.z = Math.sin(time * 0.9 + this.phase) * 0.08;
        this.group.rotation.x = Math.cos(time * 0.9 + this.phase) * 0.035;
        this.mixer?.update(dt);
    }

    dispose() {
        this.mixer?.stopAllAction();
        this.mixer?.uncacheRoot(this.group);
        this.group.parent?.remove(this.group);
    }
}

const modelCache = new Map();

function disposeCachedObject(root) {
    root?.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry?.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            material?.map?.dispose();
            material?.normalMap?.dispose();
            material?.roughnessMap?.dispose();
            material?.metalnessMap?.dispose();
            material?.dispose();
        });
    });
}

export function releaseAnimalModelCache() {
    modelCache.forEach((gltf) => disposeCachedObject(gltf.scene));
    modelCache.clear();
}

// Pass obstacles and initialVolume parameter here
export async function loadGLTFAnimals(scene, obstacles, initialVolume) {
    const animals = [];

    const loadModel = (file) => {
        if (modelCache.has(file)) return Promise.resolve(modelCache.get(file));
        return new Promise((resolve) => {
            const load = async () => {
                const loader = createGLTFLoader();
                const modelPath = `/models/animals/${file}`;
                const modelUrl = await resolveAssetUrl(modelPath);
                const resourcePath = modelPath.slice(0, modelPath.lastIndexOf('/') + 1);
                loader.setResourcePath(resourcePath);
                loader.load(
                    modelUrl,
                    (gltf) => { modelCache.set(file, gltf); resolve(gltf); },
                    undefined,
                    (error) => { console.warn(`Failed to load ${file}:`, error); resolve(null); }
                );
            };

            load().catch(() => resolve(null));
        });
    };

    let spawnIndex = 0;
    for (const config of ANIMAL_CONFIGS) {
        const gltf = await loadModel(config.file);
        if (!gltf) continue;

        for (let i = 0; i < config.count; i++) {
            const model = cloneWithSkeleton(gltf.scene);
            const clonedAnimations = gltf.animations.map(clip => clip.clone());
            // Hand the obstacles and volume to the animal instances
            const instanceConfig = config.spawnPositions ? { ...config, spawnPosition: config.spawnPositions[i] } : config;
            const animal = new GLTFAnimal(model, clonedAnimations, instanceConfig, scene, spawnIndex, obstacles, initialVolume);
            animals.push(animal);
            spawnIndex++;
        }
    }

    return animals;
}

export async function loadAmbientBirds(scene) {
    const birdFiles = ['birds/bird_1/scene.gltf', 'birds/bird_2/scene.gltf', 'birds/bird_1/scene.gltf'];
    const birds = [];
    const loadModel = (file) => {
        if (modelCache.has(file)) return Promise.resolve(modelCache.get(file));
        return new Promise((resolve) => {
            const load = async () => {
                const loader = createGLTFLoader();
                const modelPath = `/models/animals/${file}`;
                const modelUrl = await resolveAssetUrl(modelPath);
                loader.setResourcePath(modelPath.slice(0, modelPath.lastIndexOf('/') + 1));
                loader.load(modelUrl, (gltf) => {
                    modelCache.set(file, gltf);
                    resolve(gltf);
                }, undefined, () => resolve(null));
            };
            load().catch(() => resolve(null));
        });
    };

    const models = await Promise.all(birdFiles.map(loadModel));
    models.forEach((gltf, index) => {
        if (!gltf) return;
        birds.push(new AmbientBird(cloneWithSkeleton(gltf.scene), gltf.animations.map((clip) => clip.clone()), scene, index));
    });
    return birds;
}
