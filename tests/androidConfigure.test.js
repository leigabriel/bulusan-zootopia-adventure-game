import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_COLOR, mainActivitySource, missingSigningEnv, patchGradle, patchLauncherBackground, patchManifest, patchStyles } from '../scripts/android-configure.mjs';

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

const MANIFEST = `<manifest><application><activity
            android:configChanges="orientation"
            android:name=".MainActivity"
            android:exported="true"></activity></application></manifest>`;

test('locks the main activity to landscape once', () => {
    const out = patchManifest(MANIFEST);
    assert.match(out, /android:name="\.MainActivity"\s+android:screenOrientation="sensorLandscape"/);
    assert.equal(patchManifest(out), out);
    assert.throws(() => patchManifest('<manifest></manifest>'));
});

const STYLES = `<resources>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowNoTitle">true</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
    </style>
</resources>`;

test('makes the app full screen with a branded splash, once', () => {
    const out = patchStyles(STYLES);
    assert.match(out, /android:windowFullscreen/);
    assert.ok(out.includes(`windowSplashScreenBackground">${BRAND_COLOR}<`));
    assert.equal(patchStyles(out), out);
    assert.throws(() => patchStyles('<resources></resources>'));
});

test('launcher background uses the brand color', () => {
    assert.ok(patchLauncherBackground('<color name="ic_launcher_background">#FFFFFF</color>').includes(BRAND_COLOR));
});

test('activity hides system bars and keeps the screen on', () => {
    const src = mainActivitySource('com.example.game');
    assert.match(src, /^package com\.example\.game;/);
    assert.match(src, /FLAG_KEEP_SCREEN_ON/);
    assert.match(src, /BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);
    assert.match(src, /onWindowFocusChanged/);
});
