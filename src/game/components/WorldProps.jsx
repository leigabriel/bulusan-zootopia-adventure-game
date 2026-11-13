import * as THREE from 'three';
import { loadGLB } from '../utils/glbCache.js';
import { createRng } from '../utils/meadowScatter.js';
import { FOOTPRINTS, footprintCircles, scatterPlacements } from '../utils/propPlacement.js';
import { isLandAccessible } from '../utils/riverMath.js';
import { WORLD_PROPS, getSignBoardRotation, isInKeepClearZone, isInsideTigerEnclosure } from '../data/worldPoints.js';
import { getTerrainHeight, plantObjectOnTerrain } from './Terrain.jsx';

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
    signBoard: '/models/structures/safety-sign.glb',
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

async function createSignTexture() {
    try {
        await document.fonts?.load('800 60px "Simply Rounded"');
    } catch { /* falls back to the system font */ }
    const width = 1024;
    const height = 820;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const family = '"Simply Rounded", "Trebuchet MS", sans-serif';
    // Text is shrunk to fit its row so it can never run off the board.
    const fitText = (text, x, y, size, maxWidth, weight = 800) => {
        let px = size;
        ctx.font = `${weight} ${px}px ${family}`;
        while (ctx.measureText(text).width > maxWidth && px > 20) {
            px -= 2;
            ctx.font = `${weight} ${px}px ${family}`;
        }
        ctx.fillText(text, x, y);
    };

    ctx.fillStyle = '#fff4d8';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#2e9e5b';
    ctx.fillRect(0, 0, width, 160);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    fitText('BULUSAN ZOOTOPIA', width / 2, 70, 88, width - 60);
    ctx.fillStyle = '#ffe28a';
    fitText('Visitor Safety Guide', width / 2, 126, 44, width - 60);

    const rules = [
        ['#e8453c', 'Never go near the Bengal Tiger.'],
        ['#2e9e5b', 'Look, don\u2019t touch the animals.'],
        ['#2e9e5b', 'Feed gently: hold the Feed button.'],
        ['#237fb5', 'Deep water slows you down.'],
    ];
    rules.forEach(([colour, text], index) => {
        const y = 232 + index * 108;
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(70, y, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        fitText(String(index + 1), 70, y + 2, 40, 40);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#3b2a1a';
        fitText(text, 122, y + 2, 50, width - 150);
    });

    ctx.fillStyle = '#ffe28a';
    ctx.fillRect(0, height - 132, width, 132);
    ctx.fillStyle = '#3b2a1a';
    ctx.textAlign = 'center';
    fitText('Be kind to every animal.', width / 2, height - 88, 48, width - 60);
    fitText('Ask a ranger if you need help!', width / 2, height - 38, 42, width - 60, 700);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

export async function loadWorldProps(scene, quality = 'medium', { existingTrees = [] } = {}) {
    const budget = BUDGETS[quality] || BUDGETS.medium;
    const [oak, shadeTree, cherryTree, fallenLog, haystack, stable, parrotRun, signBoard] = await Promise.all(
        Object.values(MODEL_PATHS).map(loadGLB),
    );
    [oak, shadeTree, cherryTree, fallenLog, haystack, stable, parrotRun, signBoard].forEach((gltf) => gltf && tuneMaterials(gltf.scene));

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

    // Information board: the model plus a painted panel on its face.
    if (signBoard) {
        const prop = { ...WORLD_PROPS.signBoard, rotation: getSignBoardRotation() };
        const group = placeSingle(scene, signBoard, prop, { castShadow, sink: 0.02 }, meshes);
        obstacles.push(...footprintCircles(prop, FOOTPRINTS.signBoard));
        const texture = await createSignTexture();
        const panelGeometry = new THREE.PlaneGeometry(1.62, 1.3);
        const panelMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.set(0, 1.35, 0.03);
        group.add(panel);
        disposables.push(texture, panelGeometry, panelMaterial);
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
