// Renders one portrait picture per animal from the same 3D models the game uses.
// Driven by render.cjs (Playwright); not part of the game bundle.
import * as THREE from 'three';
import { createGLTFLoader } from '/src/game/utils/gltfLoader.js';

const SIZE = 768;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Crops the transparent border, centres the animal in a square and saves a small WebP.
function trimToWebp(source, out = 512, margin = 0.05) {
    const probe = document.createElement('canvas');
    probe.width = source.width;
    probe.height = source.height;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(source, 0, 0);
    const { data, width, height } = pctx.getImageData(0, 0, probe.width, probe.height);
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (data[(y * width + x) * 4 + 3] > 24) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    const w = Math.max(1, maxX - minX + 1);
    const h = Math.max(1, maxY - minY + 1);
    const scale = (out * (1 - margin * 2)) / Math.max(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, minX, minY, w, h, (out - w * scale) / 2, (out - h * scale) / 2, w * scale, h * scale);
    return canvas.toDataURL('image/webp', 0.9);
}

window.renderPortrait = async ({ file, yaw = -0.7, pitch = 0.16, fill = 0.78, clip = 'idle', time = 0.4 }) => {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4de, 0x7a9a63, 1.35));
    const sun = new THREE.DirectionalLight(0xffefd0, 2.4);
    sun.position.set(-3.5, 6, 4.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4; sun.shadow.camera.right = 4; sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xbfe3ff, 0.7);
    rim.position.set(4, 3, -4);
    scene.add(rim);

    const loader = createGLTFLoader();
    const path = `/public/models/animals/${file}`;
    loader.setResourcePath(path.slice(0, path.lastIndexOf('/') + 1));
    const gltf = await new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));
    const model = gltf.scene;
    model.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = false; child.frustumCulled = false; }
    });

    if (gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(model);
        const wanted = gltf.animations.find((a) => a.name.toLowerCase() === clip)
            || gltf.animations.find((a) => /idle|stand|breath/i.test(a.name))
            || gltf.animations[0];
        mixer.clipAction(wanted).play();
        mixer.update(Math.min(time, Math.max(0, wanted.duration - 0.05)));
    }
    model.rotation.y = yaw;
    model.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(model, true);
    const size = box.getSize(new THREE.Vector3());
    const scale = 3 / Math.max(size.x, size.y, size.z, 0.001);
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model, true);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    model.updateMatrixWorld(true);
    scene.add(model);

    // Soft ground patch so the animal sits on something, shadow only.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.28 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    box = new THREE.Box3().setFromObject(model, true);
    const fitSize = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    const radius = Math.max(fitSize.x, fitSize.y, fitSize.z) / 2;
    const distance = (radius / fill) / Math.tan((camera.fov * Math.PI) / 360) * 0.92;
    camera.position.set(mid.x, mid.y + Math.sin(pitch) * distance, mid.z + Math.cos(pitch) * distance);
    camera.lookAt(mid);

    renderer.render(scene, camera);
    const url = trimToWebp(renderer.domElement);
    scene.traverse((child) => {
        if (child.isMesh) {
            child.geometry?.dispose();
            [].concat(child.material).forEach((m) => m?.dispose());
        }
    });
    return url;
};
window.portraitReady = true;
