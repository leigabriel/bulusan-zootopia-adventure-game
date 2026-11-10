// Single source of truth for the app version (version.json).
//   node scripts/version.mjs show   -> prints the current version name
//   node scripts/version.mjs bump   -> 1.0 -> 1.1 ... 1.9 -> 2.0, versionCode + 1
// The Android workflow runs `bump` for every push; the web build, the menu and
// the APK all read the same file so they can never disagree.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = join(root, 'version.json');
const packageFile = join(root, 'package.json');

export function bumpVersionName(name) {
    const match = /^(\d+)\.(\d+)$/.exec(String(name).trim());
    if (!match) throw new Error(`versionName "${name}" must look like 1.0`);
    const major = Number(match[1]);
    const minor = Number(match[2]);
    // Tenths: 1.8 -> 1.9 -> 2.0
    return minor >= 9 ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

export function bumpVersion(version) {
    return {
        versionName: bumpVersionName(version.versionName),
        versionCode: Number(version.versionCode) + 1,
    };
}

export function readVersion() {
    const version = JSON.parse(readFileSync(versionFile, 'utf8'));
    if (!/^\d+\.\d+$/.test(version.versionName) || !Number.isInteger(version.versionCode) || version.versionCode < 1) {
        throw new Error('version.json needs versionName like "1.0" and an integer versionCode >= 1');
    }
    return version;
}

function writeVersion(version) {
    writeFileSync(versionFile, `${JSON.stringify(version, null, 2)}\n`);
    const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
    pkg.version = `${version.versionName}.0`;
    writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const command = process.argv[2] || 'show';
    if (command === 'show') {
        console.log(readVersion().versionName);
    } else if (command === 'bump') {
        const next = bumpVersion(readVersion());
        writeVersion(next);
        console.log(next.versionName);
    } else {
        console.error('usage: node scripts/version.mjs [show|bump]');
        process.exit(1);
    }
}
