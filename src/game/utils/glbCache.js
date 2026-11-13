import { createGLTFLoader } from './gltfLoader.js';
import { resolveAssetUrl } from './localAssets.js';

// One shared load per GLB path, so animals, trees and structures that appear
// many times in the world are downloaded and parsed once.
const cache = new Map();

export function loadGLB(path) {
    if (cache.has(path)) return cache.get(path);
    const pending = (async () => {
        try {
            const url = await resolveAssetUrl(path);
            return await createGLTFLoader().loadAsync(url);
        } catch (error) {
            console.warn(`Failed to load ${path}:`, error);
            return null;
        }
    })();
    cache.set(path, pending);
    return pending;
}

export async function releaseGLBCache() {
    const entries = await Promise.all(cache.values());
    cache.clear();
    entries.forEach((gltf) => {
        gltf?.scene.traverse((child) => {
            if (!child.isMesh) return;
            child.geometry?.dispose();
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => material?.dispose());
        });
    });
}
