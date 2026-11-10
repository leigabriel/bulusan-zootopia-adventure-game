import test from 'node:test';
import assert from 'node:assert/strict';
import { missingSigningEnv, patchGradle } from '../scripts/android-configure.mjs';

const TEMPLATE = `android {
    defaultConfig {
        versionCode 1
        versionName "1.0"
    }
    buildTypes {
        release {
            minifyEnabled false
        }
    }
}
`;

test('stamps the version and wires release signing', () => {
    const out = patchGradle(TEMPLATE, { versionName: '1.3', versionCode: 4 });
    assert.match(out, /versionCode 4/);
    assert.match(out, /versionName "1\.3"/);
    assert.match(out, /signingConfigs \{\s+release \{/);
    assert.match(out, /release \{\s+signingConfig signingConfigs\.release/);
    assert.ok(out.indexOf('signingConfigs {') < out.indexOf('buildTypes {'));
});

test('patching twice changes nothing more', () => {
    const once = patchGradle(TEMPLATE, { versionName: '1.3', versionCode: 4 });
    assert.equal(patchGradle(once, { versionName: '1.3', versionCode: 4 }), once);
});

test('refuses a build.gradle it does not understand', () => {
    assert.throws(() => patchGradle('android {}', { versionName: '1.1', versionCode: 2 }));
});

test('reports missing signing secrets', () => {
    assert.deepEqual(missingSigningEnv({}).length, 4);
    assert.deepEqual(missingSigningEnv({
        ANDROID_KEYSTORE_PATH: 'a', ANDROID_KEYSTORE_PASSWORD: 'b', ANDROID_KEY_ALIAS: 'c', ANDROID_KEY_PASSWORD: 'd',
    }), []);
});
