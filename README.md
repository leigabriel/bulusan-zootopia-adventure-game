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
npm run android:release   # release app bundle
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
