import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_METADATA, ANIMAL_METADATA_BY_NAME, getAnimalBookEntry } from '../src/game/data/animalMetadata.js';

test('ANIMAL_METADATA contains 17 animals', () => {
    assert.equal(ANIMAL_METADATA.length, 17);
});

test('every animal has required fields', () => {
    for (const animal of ANIMAL_METADATA) {
        assert.ok(animal.name, `missing name`);
        assert.ok(animal.scientific, `missing scientific for ${animal.name}`);
        assert.ok(animal.file, `missing file for ${animal.name}`);
        assert.ok(animal.habitat, `missing habitat for ${animal.name}`);
        assert.ok(animal.diet, `missing diet for ${animal.name}`);
        assert.ok(animal.fact, `missing fact for ${animal.name}`);
        assert.ok(animal.description, `missing description for ${animal.name}`);
        assert.ok(animal.emoji, `missing emoji for ${animal.name}`);
    }
});

test('ANIMAL_METADATA_BY_NAME is indexed by name', () => {
    assert.equal(ANIMAL_METADATA_BY_NAME['Alpaca']?.name, 'Alpaca');
    assert.equal(ANIMAL_METADATA_BY_NAME['Bengal Tiger']?.name, 'Bengal Tiger');
    assert.equal(ANIMAL_METADATA_BY_NAME['Nonexistent'], undefined);
});

test('getAnimalBookEntry resolves Rabbit variants to Rabbit', () => {
    const idle = getAnimalBookEntry('Rabbit (Idle)');
    const walk = getAnimalBookEntry('Rabbit (Walk)');
    const normal = getAnimalBookEntry('Rabbit');
    assert.equal(idle?.name, 'Rabbit');
    assert.equal(walk?.name, 'Rabbit');
    assert.equal(normal?.name, 'Rabbit');
});

test('getAnimalBookEntry returns undefined for unknown names', () => {
    assert.equal(getAnimalBookEntry('Dragon'), undefined);
    assert.equal(getAnimalBookEntry(''), undefined);
});

test('all animal names are unique', () => {
    const names = ANIMAL_METADATA.map(a => a.name);
    assert.equal(new Set(names).size, names.length);
});

test('all animal files are unique', () => {
    const files = ANIMAL_METADATA.map(a => a.file);
    assert.equal(new Set(files).size, files.length);
});

test('new animals are in the book and their models ship in public/', async () => {
    const fs = await import('node:fs');
    for (const name of ['Parrot', 'Pigeon', 'Owl', 'Goat', 'Frog', 'Koi Fish']) {
        const entry = ANIMAL_METADATA_BY_NAME[name];
        assert.ok(entry, `${name} missing from the book`);
        assert.ok(fs.existsSync(`public/models/animals/${entry.file}`), `${name} model missing`);
    }
});
