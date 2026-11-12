// Prepares the generated android/ project (it is not committed) for a signed
// release build: stamps the version from version.json, wires the release
// signing config to environment variables so no secret is ever written to disk,
// and turns the stock Capacitor shell into a landscape, full-screen game app
// with the game's own icon and splash screen.
//   node scripts/android-configure.mjs [--require-signing]
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readVersion } from './version.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidApp = join(root, 'android', 'app');
const gradleFile = join(androidApp, 'build.gradle');
const mainDir = join(androidApp, 'src', 'main');

// Same green as the game icon, used behind adaptive icons and the splash.
export const BRAND_COLOR = '#63DE81';

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

// The game is a landscape game: lock it so players never have to rotate the
// phone, while still allowing either landscape direction.
export function patchManifest(xml) {
    if (xml.includes('android:screenOrientation')) return xml;
    const pattern = /(<activity\b[^>]*?android:name="\.MainActivity")/;
    if (!pattern.test(xml)) throw new Error('MainActivity not found in AndroidManifest.xml');
    return xml.replace(pattern, '$1\n            android:screenOrientation="sensorLandscape"');
}

// Full-screen window plus a branded splash background (Android 12+ ignores the
// old splash image and uses these attributes instead).
export function patchStyles(xml) {
    let text = xml;
    if (!text.includes('android:windowFullscreen')) {
        text = text.replace(
            /(<style name="AppTheme\.NoActionBar" parent="[^"]*">)/,
            '$1\n        <item name="android:windowFullscreen">true</item>'
        );
    }
    if (!text.includes('windowSplashScreenBackground')) {
        text = text.replace(
            /(<item name="android:background">@drawable\/splash<\/item>)/,
            `$1\n        <item name="windowSplashScreenBackground">${BRAND_COLOR}</item>\n        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>`
        );
    }
    if (!text.includes('windowSplashScreenBackground') || !text.includes('android:windowFullscreen')) {
        throw new Error('expected Capacitor themes not found in styles.xml');
    }
    return text;
}

export function patchLauncherBackground(xml) {
    return xml.replace(/#[0-9A-Fa-f]{6}/, BRAND_COLOR);
}

// Replaces the stock Activity with one that keeps the screen on, draws edge to
// edge (including under display notches) and hides the system bars. Swiping in
// from a screen edge shows them briefly, so both gesture navigation and the
// three-button bar still work.
export function mainActivitySource(packageName) {
    return `package ${packageName};

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
`;
}

function readAppId() {
    return JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8')).appId;
}

// Copies the committed game icons and splash over the Capacitor defaults and
// removes the per-orientation splash images that would shadow the new one.
function installResources() {
    const res = join(mainDir, 'res');
    cpSync(join(root, 'scripts', 'android-res'), res, { recursive: true });
    for (const folder of readdirSync(res)) {
        if (/^drawable-(land|port)-/.test(folder)) rmSync(join(res, folder, 'splash.png'), { force: true });
    }
}

function patchFile(path, patch) {
    if (!existsSync(path)) throw new Error(`${path} not found; run "npx cap add android" first`);
    writeFileSync(path, patch(readFileSync(path, 'utf8')));
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
    const appId = readAppId();
    patchFile(join(mainDir, 'AndroidManifest.xml'), patchManifest);
    patchFile(join(mainDir, 'res', 'values', 'styles.xml'), patchStyles);
    patchFile(join(mainDir, 'res', 'values', 'ic_launcher_background.xml'), patchLauncherBackground);
    writeFileSync(join(mainDir, 'java', ...appId.split('.'), 'MainActivity.java'), mainActivitySource(appId));
    installResources();
    console.log(`android/app/build.gradle -> version ${version.versionName} (${version.versionCode}), release signing from environment, landscape + icons applied`);
}
