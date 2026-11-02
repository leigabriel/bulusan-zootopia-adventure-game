import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TERRAIN_SEGMENTS, TERRAIN_SIZE, computeTerrainHeight, getTerrainGrid, sampleTerrainHeight } from '../src/game/utils/terrainField.js';

test('sampler returns the grid height exactly at mesh vertices', () => {
    const cell = TERRAIN_SIZE / TERRAIN_SEGMENTS;
    for (const [ix, iy] of [[0, 0], [10, 20], [110, 110], [220, 220], [57, 199]]) {
        const x = -TERRAIN_SIZE / 2 + ix * cell;
        const z = -TERRAIN_SIZE / 2 + iy * cell;
        assert.ok(Math.abs(sampleTerrainHeight(x, z) - computeTerrainHeight(x, z)) < 1e-4);
    }
});

test('sampler matches a ray cast against the real rendered mesh', () => {
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    const grid = getTerrainGrid();
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) pos.setZ(i, grid[i]);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.rotation.x = -Math.PI / 2;
    mesh.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // Include points in and near the river channel, where the old analytic height diverged most.
    const points = [[-4, 87], [42, 98], [88, 82], [-135, 108]];
    for (let i = 0; i < 40; i += 1) points.push([(rand() - 0.5) * 380, (rand() - 0.5) * 380]);
    for (const [x, z] of points) {
        raycaster.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
        const hit = raycaster.intersectObject(mesh)[0];
        assert.ok(hit, `no hit at ${x},${z}`);
        assert.ok(Math.abs(hit.point.y - sampleTerrainHeight(x, z)) < 0.01, `mismatch at ${x},${z}`);
    }
});

test('outside the mesh the analytic field is used', () => {
    assert.equal(sampleTerrainHeight(400, 400), computeTerrainHeight(400, 400));
});
