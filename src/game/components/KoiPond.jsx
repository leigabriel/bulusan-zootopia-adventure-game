import * as THREE from 'three';

// The Japanese koi pond (japanese-koi-pond.glb). The model is 3.0 m x 2.1 m with
// a 0.39 m water surface and five koi that swim a baked loop. It is scaled like
// the other hand-placed structures (stable, haystacks) so it reads at the same
// size as the 1.5 m character. Tossing food makes the koi swim faster for a few
// seconds and drops pellets that ring the water.

export const KOI_WATER_LEVEL = 0.39; // model units, measured from the pond origin
export const KOI_FEED_RANGE = 3.2; // metres from the pond rim
const FEED_COOLDOWN = 1.6;
const EXCITED_SECONDS = 4.5;
const PELLETS_PER_FEED = 6;

// Elliptical footprint of the pond in model units (half width, half depth).
export const KOI_HALF_EXTENT = { x: 1.5, z: 1.06 };

export function createKoiPond(scene, gltf, prop, { castShadow = false } = {}) {
    const root = gltf.scene.clone(true);
    root.position.set(prop.x, prop.y ?? 0, prop.z);
    root.rotation.y = prop.rotation ?? 0;
    root.scale.setScalar(prop.scale ?? 1);
    root.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = castShadow;
        child.receiveShadow = true;
    });
    scene.add(root);

    const mixer = gltf.animations?.length ? new THREE.AnimationMixer(root) : null;
    const actions = (gltf.animations || []).map((clip) => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        return action;
    });

    const scale = prop.scale ?? 1;
    const waterY = (prop.y ?? 0) + KOI_WATER_LEVEL * scale;
    const cos = Math.cos(prop.rotation ?? 0);
    const sin = Math.sin(prop.rotation ?? 0);

    const pelletGeometry = new THREE.SphereGeometry(0.07 * scale, 8, 6);
    const pelletMaterial = new THREE.MeshStandardMaterial({ color: 0xd98a3d, roughness: 0.7 });
    const ringGeometry = new THREE.RingGeometry(0.08 * scale, 0.11 * scale, 24);
    const items = [];
    let excitedUntil = 0;
    let lastFeedAt = -Infinity;
    let clock = 0;

    // Distance from a world point to the pond's elliptical rim (<= 0 is inside).
    function rimDistance(x, z) {
        const dx = x - prop.x;
        const dz = z - prop.z;
        const lx = (dx * cos - dz * sin) / scale;
        const lz = (dx * sin + dz * cos) / scale;
        const nx = lx / KOI_HALF_EXTENT.x;
        const nz = lz / KOI_HALF_EXTENT.z;
        // Normalised radius is 1 on the rim; convert the excess to metres.
        return (Math.hypot(nx, nz) - 1) * Math.min(KOI_HALF_EXTENT.x, KOI_HALF_EXTENT.z) * scale;
    }

    return {
        object: root,
        center: { x: prop.x, z: prop.z },
        rimDistance,
        isNear(x, z) {
            return rimDistance(x, z) <= KOI_FEED_RANGE;
        },
        canFeed() {
            return clock - lastFeedAt >= FEED_COOLDOWN;
        },
        // Returns true when food was thrown.
        feed() {
            if (clock - lastFeedAt < FEED_COOLDOWN) return false;
            lastFeedAt = clock;
            excitedUntil = clock + EXCITED_SECONDS;
            for (let i = 0; i < PELLETS_PER_FEED; i += 1) {
                const angle = Math.random() * Math.PI * 2;
                const reach = Math.sqrt(Math.random()) * 0.6;
                const lx = Math.cos(angle) * KOI_HALF_EXTENT.x * reach * scale;
                const lz = Math.sin(angle) * KOI_HALF_EXTENT.z * reach * scale;
                const x = prop.x + lx * cos + lz * sin;
                const z = prop.z - lx * sin + lz * cos;
                const pellet = new THREE.Mesh(pelletGeometry, pelletMaterial);
                pellet.position.set(x, waterY + 1.4 * scale + Math.random() * 0.6, z);
                scene.add(pellet);
                items.push({ kind: 'pellet', mesh: pellet, x, z, delay: i * 0.08, born: clock });
            }
            return true;
        },
        update(dt) {
            clock += dt;
            if (mixer) {
                const target = clock < excitedUntil ? 2.6 : 1;
                const current = actions[0].timeScale;
                const next = current + (target - current) * Math.min(1, dt * 3);
                actions.forEach((action) => { action.timeScale = next; });
                mixer.update(dt);
            }
            for (let i = items.length - 1; i >= 0; i -= 1) {
                const item = items[i];
                const age = clock - item.born - item.delay;
                if (age < 0) continue;
                if (item.kind === 'pellet') {
                    const fall = item.mesh.position.y - waterY;
                    if (fall > 0.02) {
                        item.mesh.position.y = Math.max(waterY, item.mesh.position.y - 3.4 * dt);
                    } else {
                        // Landed: leave a ripple and let the pellet sink away.
                        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
                        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                        ring.rotation.x = -Math.PI / 2;
                        ring.position.set(item.x, waterY + 0.02, item.z);
                        scene.add(ring);
                        items.push({ kind: 'ring', mesh: ring, born: clock, delay: 0 });
                        item.kind = 'sinking';
                        item.sinkStart = clock;
                    }
                } else if (item.kind === 'sinking') {
                    const t = (clock - item.sinkStart) / 1.8;
                    item.mesh.position.y = waterY - t * 0.25 * scale;
                    item.mesh.scale.setScalar(Math.max(0.01, 1 - t));
                    if (t >= 1) {
                        scene.remove(item.mesh);
                        items.splice(i, 1);
                    }
                } else if (item.kind === 'ring') {
                    const t = age / 1.4;
                    item.mesh.scale.setScalar(1 + t * 5);
                    item.mesh.material.opacity = Math.max(0, 0.7 * (1 - t));
                    if (t >= 1) {
                        scene.remove(item.mesh);
                        item.mesh.material.dispose();
                        items.splice(i, 1);
                    }
                }
            }
        },
        dispose() {
            items.forEach((item) => {
                scene.remove(item.mesh);
                if (item.kind === 'ring') item.mesh.material.dispose();
            });
            items.length = 0;
            mixer?.stopAllAction();
            scene.remove(root);
            pelletGeometry.dispose();
            pelletMaterial.dispose();
            ringGeometry.dispose();
        },
    };
}
