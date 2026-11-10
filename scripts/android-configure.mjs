// Prepares the generated android/ project (it is not committed) for a signed
// release build: stamps the version from version.json and wires the release
// signing config to environment variables so no secret is ever written to disk.
//   node scripts/android-configure.mjs [--require-signing]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readVersion } from './version.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradleFile = join(root, 'android', 'app', 'build.gradle');

export const SIGNING_ENV = [
    'ANDROID_KEYSTORE_PATH',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
];

const SIGNING_BLOCK = `    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`;

export function patchGradle(source, { versionName, versionCode }) {
    let text = source;

    const code = /versionCode\s+\d+/;
    const name = /versionName\s+"[^"]*"/;
    if (!code.test(text) || !name.test(text)) throw new Error('versionCode/versionName not found in build.gradle');
    text = text.replace(code, `versionCode ${versionCode}`).replace(name, `versionName "${versionName}"`);

    if (!text.includes('signingConfigs {')) {
        if (!/^\s*buildTypes\s*\{/m.test(text)) throw new Error('buildTypes block not found in build.gradle');
        text = text.replace(/^(\s*)buildTypes\s*\{/m, `${SIGNING_BLOCK}$1buildTypes {`);
    }
    if (!text.includes('signingConfig signingConfigs.release')) {
        if (!/release\s*\{/.test(text.slice(text.indexOf('buildTypes')))) throw new Error('release build type not found in build.gradle');
        text = text.replace(/(buildTypes\s*\{\s*release\s*\{)/, '$1\n            signingConfig signingConfigs.release');
    }
    return text;
}

export function missingSigningEnv(env = process.env) {
    return SIGNING_ENV.filter((key) => !env[key]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    if (process.argv.includes('--require-signing')) {
        const missing = missingSigningEnv();
        if (missing.length > 0) {
            console.error(`Missing signing settings: ${missing.join(', ')}. A signed release APK cannot be built without them.`);
            process.exit(1);
        }
    }
    const version = readVersion();
    writeFileSync(gradleFile, patchGradle(readFileSync(gradleFile, 'utf8'), version));
    console.log(`android/app/build.gradle -> version ${version.versionName} (${version.versionCode}), release signing from environment`);
}
