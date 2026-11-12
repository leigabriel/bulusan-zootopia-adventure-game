import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { isLandAccessible, getRiverMetrics } from './River.jsx';
import { getRiverShoreDistance, sampleSmoothPath } from '../utils/riverMath.js';
import { valueNoise } from '../utils/meadowScatter.js';
import { plantedBottomY } from '../utils/groundPlacement.js';
import { TERRAIN_SEGMENTS, TERRAIN_SIZE, getTerrainGrid, sampleTerrainHeight } from '../utils/terrainField.js';
import { MISSION_POINTS, TIGER_ENCLOSURE, isInKeepClearZone, isInsideTigerEnclosure } from '../data/worldPoints.js';

const CELL_SIZE = TERRAIN_SIZE / TERRAIN_SEGMENTS;

const TREE_MODELS = ['Tree1', 'Tree2', 'Tree3', 'Tree4'];
const BUSH_MODELS = ['Bush1', 'Bush2', 'Bush3'];
const ROCK_MODELS = ['Rock1', 'Rock2', 'Rock3'];
// The playable area ends before the perimeter forest begins. Keeping this in
// the terrain module lets movement, animals, and scenery use the same map edge.
export const PLAYABLE_BOUNDARY = 194;

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

export function releaseTerrainModelCache() {
    modelCache.forEach(disposeCachedObject);
    modelCache.clear();
}

// Height of the rendered ground at (x, z); see utils/terrainField.js.
export function getTerrainHeight(x, z) {
    return sampleTerrainHeight(x, z);
}

export function alignObjectToTerrain(object, terrainY, bounds = new THREE.Box3(), clearance = 0.02) {
    if (!object) return 0;

    object.updateMatrixWorld(true);
    bounds.setFromObject(object);
    const delta = terrainY + clearance - bounds.min.y;
    object.position.y += delta;
    object.updateMatrixWorld(true);
    return delta;
}

// Plants a prop so its whole footprint touches the ground: rests the lowest
// point on the lowest terrain under it, then sinks it a little. Resting on the
// height at the centre alone leaves the downhill side floating.
const plantBounds = new THREE.Box3();
const plantSize = new THREE.Vector3();
export function plantObjectOnTerrain(object, sinkFraction = 0.15) {
    if (!object) return 0;
    object.updateMatrixWorld(true);
    plantBounds.setFromObject(object);
    plantBounds.getSize(plantSize);
    const centreX = (plantBounds.min.x + plantBounds.max.x) * 0.5;
    const centreZ = (plantBounds.min.z + plantBounds.max.z) * 0.5;
    const targetY = plantedBottomY(getTerrainHeight, centreX, centreZ, plantSize, sinkFraction);
    const delta = targetY - plantBounds.min.y;
    object.position.y += delta;
    object.updateMatrixWorld(true);
    return delta;
}

export function createTerrain(scene) {
    const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    const posAttr = terrainGeo.attributes.position;
    const terrainGrid = getTerrainGrid();

    const colors = [];

    // Ground palette. The grass field covers most of it, so the base is a deep
    // green that reads as soil-and-roots in the gaps between clumps.
    const deepGreen = new THREE.Color(0x3f6b34);
    const baseGreen = new THREE.Color(0x4f7f3b);
    const lightGreen = new THREE.Color(0x77a24a);
    const dryGrass = new THREE.Color(0x8d9a52);
    const dirt = new THREE.Color(0x8a6b45);
    const stoneGround = new THREE.Color(0x857d6c);
    const wetMud = new THREE.Color(0x54452f);
    const sand = new THREE.Color(0xcbb583);
    const scratch = new THREE.Color();

    const smooth = (edge0, edge1, v) => {
        const t = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    };

    for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        // PlaneGeometry is rotated to XZ world space, so local +Y maps to world -Z.
        // Vertex i is grid point i, so the mesh and getTerrainHeight agree exactly.
        const height = terrainGrid[i];
        posAttr.setZ(i, height);
        const worldZ = -y;

        // Deterministic noise (no per-vertex randomness) so the ground does not
        // shimmer or change between loads.
        const broad = valueNoise(x * 0.02 + 5.1, worldZ * 0.02 - 2.3);
        const mid = valueNoise(x * 0.07, worldZ * 0.07, 7);
        const fine = valueNoise(x * 0.31, worldZ * 0.31, 13);

        scratch.copy(baseGreen);
        scratch.lerp(deepGreen, smooth(0.45, 0.8, broad) * 0.8);
        scratch.lerp(lightGreen, smooth(0.5, 0.85, mid) * 0.65);
        scratch.lerp(dryGrass, smooth(0.7, 0.95, broad * 0.6 + mid * 0.4) * 0.5);
        scratch.multiplyScalar(0.94 + fine * 0.12);

        // Steeper ground shows bare dirt and stone instead of grass.
        const slope = Math.hypot(
            sampleTerrainHeight(x + CELL_SIZE, worldZ) - sampleTerrainHeight(x - CELL_SIZE, worldZ),
            sampleTerrainHeight(x, worldZ + CELL_SIZE) - sampleTerrainHeight(x, worldZ - CELL_SIZE)
        ) / (CELL_SIZE * 2);
        const steep = smooth(0.28, 0.75, slope);
        if (steep > 0) {
            scratch.lerp(dirt, steep * 0.75);
            scratch.lerp(stoneGround, smooth(0.6, 1.1, slope) * 0.6);
        }

        // Riverbed mud, wet sand along the shore, then grass.
        const shore = getRiverShoreDistance(x, worldZ, 8);
        if (shore < 6) {
            const sandMix = 1 - smooth(1.4, 4.2, shore + fine * 0.8);
            scratch.lerp(sand, sandMix * 0.95);
            scratch.lerp(wetMud, 1 - smooth(-0.6, 0.7, shore));
        }

        colors.push(scratch.r, scratch.g, scratch.b);
    }

    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const ground = new THREE.Mesh(
        terrainGeo,
        new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: false
        })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    return ground;
}

async function loadOBJModel(name, basePath, modelType = 'default') {
    const key = basePath + name;
    if (modelCache.has(key)) {
        return modelCache.get(key).clone();
    }

    return new Promise((resolve) => {
        const mtlLoader = new MTLLoader();
        mtlLoader.setPath(basePath);
        mtlLoader.load(`${name}.mtl`, (materials) => {
            materials.preload();

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath(basePath);
            objLoader.load(`${name}.obj`, (object) => {
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = false;
                        child.receiveShadow = false;

                        if (child.material) {
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            const fixedMats = mats.map(mat => {
                                const newColor = new THREE.Color();
                                let roughness = 0.8;
                                const matName = mat.name ? mat.name.toLowerCase() : '';

                                // --- GUARANTEED NATURAL HEX COLORS ---
                                if (modelType === 'rock') {
                                    newColor.setHex(0x75726c); // Natural, medium-grey stone (no longer white!)
                                    roughness = 0.95;
                                }
                                else if (modelType === 'grass') {
                                    newColor.setHex(0x559c38); // Lush, vibrant grass green
                                    roughness = 0.9;
                                }
                                else if (modelType === 'tree' || modelType === 'bush') {
                                    // If the material is specifically for the trunk/wood
                                    if (matName.includes('tree') || matName.includes('bark') || matName.includes('trunk')) {
                                        newColor.setHex(0x66452f); // Warm natural wood/bark brown
                                    } else {
                                        newColor.setHex(0x4a8f2f); // Beautiful, natural leaf green (no longer dark!)
                                    }
                                    roughness = 0.85;
                                }

                                // If the object happens to use image textures instead of solid colors, 
                                // set the base color to white so the texture is perfectly visible.
                                if (mat.map) {
                                    newColor.setHex(0xffffff);
                                }

                                const newMat = new THREE.MeshStandardMaterial({
                                    color: newColor,
                                    map: mat.map,
                                    transparent: mat.transparent,
                                    opacity: mat.opacity,
                                    alphaTest: mat.alphaTest || 0.3,
                                    side: THREE.DoubleSide,
                                    roughness: roughness,
                                    metalness: 0.0
                                });

                                 if (newMat.map) {
                                     newMat.map.colorSpace = THREE.SRGBColorSpace;
                                 }

                                 // The replacement material reuses the maps, so
                                 // release only the obsolete material wrapper.
                                 mat.dispose();

                                 return newMat;
                            });
                            child.material = Array.isArray(child.material) ? fixedMats : fixedMats[0];
                        }
                    }
                });

                modelCache.set(key, object);
                resolve(object.clone());
            }, undefined, () => resolve(null));
        }, undefined, () => resolve(null));
    });
}

export function loadTrees(scene, quality = 'medium') {
    const trees = [];
    const promises = TREE_MODELS.map(name => loadOBJModel(name, '/models/natures/', 'tree'));

    const loadPromise = Promise.all(promises).then(models => {
        const validModels = models.filter(m => m !== null);
        if (validModels.length === 0) return trees;

        const budgets = { mobile: 55, low: 110, medium: 220, high: 340 };
        const budget = budgets[quality] || budgets.medium;

        // Random sampling avoids the artificial perimeter rows. The outermost
        // terrain band is intentionally less likely to receive a tree so the
        // fence remains readable from every direction.
        const clearings = [
            { x: 0, z: 0, radius: 78 },
            { x: 105, z: -80, radius: 34 },
            { x: 120, z: 90, radius: 42 },
            { x: -42, z: 58, radius: 28 },
            { x: -26, z: 70, radius: 28 },
            { x: -20, z: 22, radius: 22 },
            { x: -125, z: -115, radius: 28 },
            { x: 145, z: -155, radius: 38 },
            { x: -145, z: -155, radius: 38 },
        ];
        const selected = [];
        let attempts = 0;
        while (selected.length < budget && attempts < budget * 35) {
            attempts += 1;
            const x = THREE.MathUtils.randFloat(-235, 235);
            const z = THREE.MathUtils.randFloat(-235, 235);
            const edgeDistance = 235 - Math.max(Math.abs(x), Math.abs(z));
            if (edgeDistance < 28 && Math.random() < 0.72) continue;
            if (!isLandAccessible(x, z, 3.5)) continue;
            if (isInsideTigerEnclosure(x, z, 6) || isInKeepClearZone(x, z, 4)) continue;
            if (clearings.some((clearing) => (x - clearing.x) ** 2 + (z - clearing.z) ** 2 < clearing.radius ** 2)) continue;
            if (selected.some((tree) => (x - tree.x) ** 2 + (z - tree.z) ** 2 < 8 ** 2)) continue;
            selected.push({
                x,
                z,
                outer: Math.abs(x) > PLAYABLE_BOUNDARY || Math.abs(z) > PLAYABLE_BOUNDARY,
                scale: 1.6 + Math.random() * 2.3,
                rotation: Math.random() * Math.PI * 2
            });
        }
        const grouped = validModels.map(() => []);
        selected.forEach((placement) => grouped[Math.floor(Math.random() * grouped.length)].push(placement));

        validModels.forEach((baseModel, modelIndex) => {
            const modelBounds = new THREE.Box3().setFromObject(baseModel);
            const baseMinY = modelBounds.min.y;
            const modelPlacements = grouped[modelIndex];
            baseModel.updateMatrixWorld(true);

            baseModel.traverse((sourceMesh) => {
                if (!sourceMesh.isMesh || modelPlacements.length === 0) return;
                const batch = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material, modelPlacements.length);
                batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
                batch.castShadow = false;
                batch.receiveShadow = false;
                const childMatrix = sourceMesh.matrixWorld.clone();
                const rootMatrix = new THREE.Matrix4();
                const rotation = new THREE.Matrix4();
                const scaleMatrix = new THREE.Matrix4();
                modelPlacements.forEach((placement, index) => {
                    const terrainY = getTerrainHeight(placement.x, placement.z);
                    rootMatrix.makeTranslation(placement.x, terrainY - baseMinY * placement.scale, placement.z);
                    rotation.makeRotationY(placement.rotation);
                    scaleMatrix.makeScale(placement.scale, placement.scale, placement.scale);
                    batch.setMatrixAt(index, rootMatrix.clone().multiply(rotation).multiply(scaleMatrix).multiply(childMatrix));
                });
                batch.instanceMatrix.needsUpdate = true;
                batch.computeBoundingSphere();
                scene.add(batch);
            });
            modelPlacements.forEach((placement) => {
                trees.push({ x: placement.x, z: placement.z, outer: placement.outer, radius: placement.scale * 0.8 });
            });
        });
        return trees;
    });

    return { trees, loadPromise };
}

function createSquareFence(scene, centerX, centerZ, halfSize, quality = 'medium') {
    const fence = new THREE.Group();
    const boundary = halfSize;
    const postSpacing = quality === 'low' ? 16 : 12;
    const postCountPerSide = Math.ceil((boundary * 2) / postSpacing) + 1;
    const postGeometry = new THREE.BoxGeometry(0.9, 5.5, 0.9);
    const railGeometry = new THREE.BoxGeometry(1, 0.42, 0.42);
    const material = new THREE.MeshStandardMaterial({ color: 0x8b5a32, roughness: 0.9 });
    const posts = new THREE.InstancedMesh(postGeometry, material, postCountPerSide * 4);
    const rails = new THREE.InstancedMesh(railGeometry, material, (postCountPerSide - 1) * 4 * 2);
    const postMatrix = new THREE.Matrix4();
    const railMatrix = new THREE.Matrix4();
    const rotation = new THREE.Matrix4();
    const scale = new THREE.Matrix4();
    let postIndex = 0;
    let railIndex = 0;

    for (let side = 0; side < 4; side += 1) {
        const horizontal = side > 1;
        const fixed = side % 2 === 0 ? -boundary : boundary;
        for (let i = 0; i < postCountPerSide; i += 1) {
            const along = -boundary + (i / (postCountPerSide - 1)) * boundary * 2;
            const x = horizontal ? centerX + along : centerX + fixed;
            const z = horizontal ? centerZ + fixed : centerZ + along;
            postMatrix.makeTranslation(x, getTerrainHeight(x, z) + 2.75, z);
            posts.setMatrixAt(postIndex++, postMatrix);

            if (i === postCountPerSide - 1) continue;
            const nextAlong = -boundary + ((i + 1) / (postCountPerSide - 1)) * boundary * 2;
            const nextX = horizontal ? centerX + nextAlong : centerX + fixed;
            const nextZ = horizontal ? centerZ + fixed : centerZ + nextAlong;
            const midX = (x + nextX) * 0.5;
            const midZ = (z + nextZ) * 0.5;
            const length = Math.abs(nextAlong - along);
            for (const height of [1.7, 3.4]) {
                railMatrix.makeTranslation(midX, (getTerrainHeight(x, z) + getTerrainHeight(nextX, nextZ)) * 0.5 + height, midZ);
                rotation.makeRotationY(horizontal ? 0 : Math.PI / 2);
                scale.makeScale(length, 1, 1);
                rails.setMatrixAt(railIndex++, railMatrix.clone().multiply(rotation).multiply(scale));
            }
        }
    }

    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
    posts.computeBoundingSphere();
    rails.computeBoundingSphere();
    posts.castShadow = quality !== 'low';
    rails.castShadow = quality !== 'low';
    fence.add(posts, rails);
    scene.add(fence);
    return fence;
}

export function createFence(scene, quality = 'medium') {
    return createSquareFence(scene, 0, 0, PLAYABLE_BOUNDARY, quality);
}

export function createTigerEnclosure(scene, quality = 'medium') {
    const fence = createSquareFence(scene, TIGER_ENCLOSURE.x, TIGER_ENCLOSURE.z, TIGER_ENCLOSURE.halfSize, quality);

    // Marks the safe viewing spot: a worn dirt circle and a signpost facing the
    // enclosure. The ground there is level (see terrainField.js), so both sit flat.
    const view = MISSION_POINTS['tiger-view'];
    const groundY = getTerrainHeight(view.x, view.z);
    const area = new THREE.Group();
    const dirt = new THREE.Mesh(
        new THREE.CircleGeometry(5.5, 28),
        new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(view.x, groundY + 0.04, view.z);
    const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a32, roughness: 0.9 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 0.4), wood);
    post.position.set(view.x + 3.2, groundY + 1.6, view.z + 1.2);
    const board = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.3, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xf2e2b8, roughness: 0.85 })
    );
    board.position.set(view.x + 3.2, groundY + 3.0, view.z + 1.2);
    // Face the board towards the enclosure (north, -z) so visitors read it.
    board.rotation.y = Math.PI;
    area.add(dirt, post, board);
    scene.add(area);
    return { fence, area };
}

export function loadBushes(scene, count = 100) {
    const bushes = [];
    const promises = BUSH_MODELS.map(name => loadOBJModel(name, '/models/natures/', 'bush'));

    const loadPromise = Promise.all(promises).then(models => {
        const validModels = models.filter(m => m !== null);
        if (validModels.length === 0) return bushes;

        for (let i = 0; i < count; i++) {
            const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
            const bush = baseModel.clone();

            const scale = 1.0 + Math.random() * 1.5;
            bush.scale.setScalar(scale);

            const angle = Math.random() * Math.PI * 2;
            const radius = 30 + Math.random() * 160;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            if (!isLandAccessible(x, z, 2)) continue;
            if (isInsideTigerEnclosure(x, z, 4) || isInKeepClearZone(x, z, 2)) continue;
            const h = getTerrainHeight(x, z);

            bush.position.set(x, h, z);
            bush.rotation.y = Math.random() * Math.PI * 2;
            plantObjectOnTerrain(bush, 0.08);

            scene.add(bush);
            bushes.push(bush);
        }
        return bushes;
    });

    return { bushes, loadPromise };
}

export function loadRocks(scene, count = 40) {
    const rocks = [];
    const promises = ROCK_MODELS.map(name => loadOBJModel(name, '/models/natures/', 'rock'));

    const loadPromise = Promise.all(promises).then(models => {
        const validModels = models.filter(m => m !== null);
        if (validModels.length === 0) return rocks;

        const outcroppings = [
            { x: 60, z: 30, count: 5, radius: 10 },
            { x: -70, z: -40, count: 6, radius: 12 },
            { x: 30, z: -80, count: 4, radius: 8 },
        ];

        // Outcrops and river rocks scale with the requested budget so phones
        // (count 20) do not get the full desktop set.
        const budgetScale = Math.min(1, count / 40);

        outcroppings.forEach(patch => {
            const patchCount = Math.max(1, Math.round(patch.count * budgetScale));
            for (let i = 0; i < patchCount; i++) {
                const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
                const rock = baseModel.clone();
                const scale = 1.5 + Math.random() * 2.0;
                rock.scale.setScalar(scale);

                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * patch.radius;
                const x = patch.x + Math.cos(angle) * r;
                const z = patch.z + Math.sin(angle) * r;
                if (!isLandAccessible(x, z, 2)) continue;
                if (isInsideTigerEnclosure(x, z, 4) || isInKeepClearZone(x, z, 2)) continue;
                const h = getTerrainHeight(x, z);

                rock.position.set(x, h, z);
                rock.rotation.y = Math.random() * Math.PI * 2;
                rock.rotation.x = (Math.random() - 0.5) * 0.18;
                rock.rotation.z = (Math.random() - 0.5) * 0.18;
                plantObjectOnTerrain(rock, 0.18);

                scene.add(rock);
                rocks.push(rock);
            }
        });

        // --- RIVER BANK ROCKS ---
        // Follow the real river path (not a hand-copied approximation) and sit
        // on the shore line, half in the sand, so none float over the water.
        const riverSamples = Math.round(20 * budgetScale);
        for (let i = 0; i < riverSamples; i++) {
            const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
            const rock = baseModel.clone();

            const centre = sampleSmoothPath(0.02 + Math.random() * 0.96);
            const metrics = getRiverMetrics(centre.x, centre.y);
            const side = Math.random() > 0.5 ? 1 : -1;
            const push = metrics.width + 0.6 + Math.random() * 2.2;

            const x = metrics.point.x + metrics.tangent.y * push * side;
            const z = metrics.point.y - metrics.tangent.x * push * side;

            if (isInsideTigerEnclosure(x, z, 4) || isInKeepClearZone(x, z, 2)) continue;
            const scale = 0.9 + Math.random() * 1.5;
            rock.scale.setScalar(scale);
            rock.position.set(x, getTerrainHeight(x, z), z);
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.rotation.x = (Math.random() - 0.5) * 0.25;
            rock.rotation.z = (Math.random() - 0.5) * 0.25;
            plantObjectOnTerrain(rock, 0.28);

            scene.add(rock);
            rocks.push(rock);
        }

        const remaining = count - rocks.length;
        for (let i = 0; i < remaining; i++) {
            const baseModel = validModels[Math.floor(Math.random() * validModels.length)];
            const rock = baseModel.clone();
            const scale = 1.0 + Math.random() * 1.5;
            rock.scale.setScalar(scale);

            const angle = Math.random() * Math.PI * 2;
            const radius = 20 + Math.random() * 180;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            if (!isLandAccessible(x, z, 2)) continue;
            if (isInsideTigerEnclosure(x, z, 4) || isInKeepClearZone(x, z, 2)) continue;
            const h = getTerrainHeight(x, z);

            rock.position.set(x, h, z);
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.rotation.x = (Math.random() - 0.5) * 0.18;
            rock.rotation.z = (Math.random() - 0.5) * 0.18;
            plantObjectOnTerrain(rock, 0.18);

            scene.add(rock);
            rocks.push(rock);
        }
        return rocks;
    });

    return { rocks, loadPromise };
}

export function createClouds(scene, count = 18) {
    const clouds = [];
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        fog: false
    });

    const puffGeometry = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        const numPuffs = 4 + Math.floor(Math.random() * 4);

        for (let j = 0; j < numPuffs; j++) {
            const size = 4 + Math.random() * 5;
            const mesh = new THREE.Mesh(puffGeometry, mat);
            mesh.position.set(
                j * 6 + Math.random() * 2,
                Math.random() * 3,
                Math.random() * 5
            );
            mesh.scale.set(
                size * (1.2 + Math.random() * 0.8),
                size * (0.55 + Math.random() * 0.2),
                size * (0.8 + Math.random() * 0.45)
            );
            group.add(mesh);
        }

        group.position.set(
            (Math.random() - 0.5) * 600,
            60 + Math.random() * 35,
            (Math.random() - 0.5) * 600
        );
        scene.add(group);
        clouds.push(group);
    }

    return clouds;
}

