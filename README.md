# Bulusan Zootopia Adventure Game

A local-first 3D wildlife exploration game set in Bulusan Zoo, Calapan City, where players complete story tasks, meet zoo rangers, discover and feed animals, take photos, and build an interactive animal guide.

## Tech stack

React 19, Three.js, Vite, Tailwind CSS 4, Capacitor (Android) and a PWA service worker. Progress is stored in the browser (`localStorage`) and game assets are cached in IndexedDB, so the game plays offline after the first load.

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run lint       # eslint
npm test           # node:test unit tests
npm run build      # production build into dist/
```

## Android

```bash
npm run android:debug     # debug APK
npm run android:release   # signed release APK (needs the signing settings below)
```

Both scripts build the web app, sync Capacitor, then run Gradle through `scripts/gradle.mjs`, which works on Windows, macOS and Linux. Set `JAVA_HOME` to a JDK (Android Studio's bundled JBR works).

## Project layout

- `src/game/MiniZooGame.jsx` - game loop, missions and state
- `src/game/components/` - terrain, river, animals, structures, scene setup
- `src/game/data/` - story tasks, animal info, shared world coordinates (`worldPoints.js`)
- `src/game/utils/` - storage, river math, asset cache, player profile
- `src/game/ui/` - menus, HUD, animal book, camera overlay
- `tests/` - unit tests for pure logic

## Controls

WASD move, mouse look, Space jump, F feed, E/T talk or collect, V change camera, Esc close panels. Touch devices get a joystick and buttons.

## Signed Android releases (GitHub Actions)

`.github/workflows/android.yml` runs on every push to `master` and `game-test`. It lints and tests, bumps the version by 0.1 (`1.0` -> `1.1` -> ... -> `1.9` -> `2.0`), builds a **signed release APK**, uploads it as a build artifact, publishes it as a GitHub Release and commits the new `version.json` back with `[skip ci]`. `version.json` is the single source for the Android version, the menu label and `package.json`.

Add these repository secrets (Settings -> Secrets and variables -> Actions) before the first run. The build fails on purpose if any is missing, because it never produces an unsigned or debug APK:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | base64 of your release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

Create a keystore once and keep it safe (losing it means you can no longer update the app):

```bash
keytool -genkeypair -v -keystore release.jks -alias zootopia -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.jks   # paste into ANDROID_KEYSTORE_BASE64 (macOS: base64 -i release.jks)
```

Never commit the keystore or its passwords.
