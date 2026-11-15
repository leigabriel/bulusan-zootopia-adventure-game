import * as THREE from 'three';
import { loadGLB } from '../utils/glbCache.js';
import { createRng } from '../utils/meadowScatter.js';
import { FOOTPRINTS, footprintCircles, scatterPlacements } from '../utils/propPlacement.js';
import { isLandAccessible } from '../utils/riverMath.js';
import { WORLD_PROPS, getSignBoardRotation, isInKeepClearZone, isInsideTigerEnclosure } from '../data/worldPoints.js';
import { getTerrainHeight, plantObjectOnTerrain } from './Terrain.jsx';
import { BRIDGE_SCALE, getBridgeFrame } from '../data/bridge.js';

// New environment art and structures (GLB, meshopt-compressed, vertex coloured).
// Hand-placed props come from WORLD_PROPS; trees and logs are scattered with a
// fixed seed so the world looks the same on every launch.

const MODEL_PATHS = {
    oak: '/models/natures/oak.glb',
    shadeTree: '/models/natures/shade-tree.glb',
    cherryTree: '/models/natures/cherry-tree.glb',
    fallenLog: '/models/natures/fallen-log.glb',
    haystack: '/models/natures/haystack.glb',
    stable: '/models/structures/livery-stable.glb',
    parrotRun: '/models/structures/parrot-run.glb',
    signBoard: '/models/structures/trailhead-sign.glb',
    footbridge: '/models/structures/creek-footbridge.glb',
};

const BUDGETS = {
    mobile: { tree: 4, log: 4 },
    low: { tree: 6, log: 5 },
    medium: { tree: 10, log: 8 },
    high: { tree: 14, log: 10 },
};

const SCATTER_EXTENT = 178;
const PLAZA_RADIUS = 60;

function tuneMaterials(root) {
    root.traverse((child) => {
        if (!child.isMesh) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            if (!material) return;
            material.roughness = Math.max(material.roughness ?? 0.9, 0.88);
            material.metalness = 0;
            material.side = THREE.FrontSide;
        });
    });
}

// One InstancedMesh per mesh in the model, so any number of trees is a handful of draw calls.
function addInstanced(scene, gltf, placements, sink, meshes) {
    if (!gltf || placements.length === 0) return;
    gltf.scene.updateMatrixWorld(true);
    const rootMatrix = new THREE.Matrix4();
    const rotation = new THREE.Matrix4();
    const scaleMatrix = new THREE.Matrix4();
    gltf.scene.traverse((source) => {
        if (!source.isMesh) return;
        const batch = new THREE.InstancedMesh(source.geometry, source.material, placements.length);
        batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        placements.forEach((placement, index) => {
            const y = getTerrainHeight(placement.x, placement.z) - sink * placement.scale;
            rootMatrix.makeTranslation(placement.x, y, placement.z);
            rotation.makeRotationY(placement.rotation);
            scaleMatrix.makeScale(placement.scale, placement.scale, placement.scale);
            batch.setMatrixAt(index, rootMatrix.clone().multiply(rotation).multiply(scaleMatrix).multiply(source.matrixWorld));
        });
        batch.instanceMatrix.needsUpdate = true;
        batch.computeBoundingSphere();
        scene.add(batch);
        meshes.push(batch);
    });
}

function placeSingle(scene, gltf, prop, { castShadow = false, sink = 0.05 } = {}, meshes) {
    if (!gltf) return null;
    const object = gltf.scene.clone(true);
    object.position.set(prop.x, 0, prop.z);
    object.rotation.y = prop.rotation ?? 0;
    object.scale.setScalar(prop.scale ?? 1);
    object.traverse((child) => {
        if (child.isMesh) child.castShadow = castShadow;
    });
    plantObjectOnTerrain(object, sink);
    scene.add(object);
    meshes.push(object);
    return object;
}

export async function loadWorldProps(scene, quality = 'medium', { existingTrees = [] } = {}) {
    const budget = BUDGETS[quality] || BUDGETS.medium;
    const [oak, shadeTree, cherryTree, fallenLog, haystack, stable, parrotRun, signBoard, footbridge] = await Promise.all(
        Object.values(MODEL_PATHS).map(loadGLB),
    );
    [oak, shadeTree, cherryTree, fallenLog, haystack, stable, parrotRun, signBoard, footbridge].forEach((gltf) => gltf && tuneMaterials(gltf.scene));

    const meshes = [];
    const disposables = [];
    const obstacles = [];
    const castShadow = quality === 'high';

    // Hand-placed structures and props.
    const stableObject = placeSingle(scene, stable, WORLD_PROPS.stable, { castShadow, sink: 0.02 }, meshes);
    if (stableObject) obstacles.push(...footprintCircles(WORLD_PROPS.stable, FOOTPRINTS.stable));
    placeSingle(scene, parrotRun, WORLD_PROPS.parrotRun, { castShadow, sink: 0.02 }, meshes);
    WORLD_PROPS.haystacks.forEach((hay) => {
        if (placeSingle(scene, haystack, hay, { castShadow }, meshes)) obstacles.push(...footprintCircles(hay, FOOTPRINTS.haystack));
    });

    // Footbridge over the creek, stretched to span it and resting on both banks.
    if (footbridge) {
        const frame = getBridgeFrame();
        const bridge = footbridge.scene.clone(true);
        bridge.position.set(frame.x, frame.baseY, frame.z);
        bridge.rotation.y = frame.yaw;
        bridge.scale.set(BRIDGE_SCALE.x, BRIDGE_SCALE.y, BRIDGE_SCALE.z);
        bridge.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = castShadow;
                child.receiveShadow = true;
            }
        });
        scene.add(bridge);
        meshes.push(bridge);
    }

    // Trailhead sign by the plaza: a map board with a hanging arrow plaque.
    if (signBoard) {
        const prop = { ...WORLD_PROPS.signBoard, rotation: getSignBoardRotation() };
        placeSingle(scene, signBoard, prop, { castShadow, sink: 0.02 }, meshes);
        obstacles.push(...footprintCircles(prop, FOOTPRINTS.signBoard));
    }

    // Scattered trees and logs. They keep clear of the plaza, the river, the
    // tiger enclosure, mission points, hand-placed props and existing trees.
    const rng = createRng(2611);
    const fixedProps = [WORLD_PROPS.stable, WORLD_PROPS.parrotRun, WORLD_PROPS.signBoard, ...WORLD_PROPS.haystacks];
    const isBlocked = (x, z) => (
        Math.hypot(x, z) < PLAZA_RADIUS
        || !isLandAccessible(x, z, 4)
        || isInsideTigerEnclosure(x, z, 8)
        || isInKeepClearZone(x, z, 5)
        || fixedProps.some((prop) => (x - prop.x) ** 2 + (z - prop.z) ** 2 < 22 ** 2)
    );
    const taken = existingTrees.map((tree) => ({ x: tree.x, z: tree.z }));
    const treeModels = [
        { gltf: oak, scale: [1.5, 2.3] },
        { gltf: shadeTree, scale: [1.3, 2.0] },
        { gltf: cherryTree, scale: [1.6, 2.4] },
    ];
    treeModels.forEach(({ gltf, scale }) => {
        if (!gltf) return;
        const placements = scatterPlacements({ count: budget.tree, rng, extent: SCATTER_EXTENT, isBlocked, minGap: 12, existing: taken, scale });
        taken.push(...placements);
        addInstanced(scene, gltf, placements, 0.1, meshes);
        placements.forEach((placement) => {
            obstacles.push(...footprintCircles(placement, FOOTPRINTS.tree).map((circle) => ({ ...circle, radius: Math.max(0.9, circle.radius) })));
        });
    });
    if (fallenLog) {
        const placements = scatterPlacements({ count: budget.log, rng, extent: SCATTER_EXTENT, isBlocked, minGap: 9, existing: taken, scale: [1.5, 2.2] });
        addInstanced(scene, fallenLog, placements, 0.05, meshes);
        placements.forEach((placement) => obstacles.push(...footprintCircles(placement, FOOTPRINTS.fallenLog)));
    }

    return {
        obstacles,
        dispose() {
            meshes.forEach((mesh) => mesh.parent?.remove(mesh));
            // Geometry and materials belong to the shared GLB cache.
            disposables.forEach((item) => item.dispose?.());
        },
    };
}
