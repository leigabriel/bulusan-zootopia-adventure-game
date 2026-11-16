# Changelog

All notable changes to Bulusan Zootopia Adventure Game. Every build bumps the
version by 0.1 (see `version.json`) and the release workflow adds a section here
from the commit messages, so the newest version is always on top.

<!-- changelog:current -->
**Current version: 3.3** (version code 24, released 2026-11-16)
<!-- /changelog:current -->

<!-- changelog:entries -->

## 3.3 (2026-11-16)

Version code 24.

### Added
- i18n: Add t() lookup, language detection and useLanguage hook
- i18n: Add kid-friendly tagalog dictionary
- settings: Add language to default settings
- ui: Translate shared modal, pagination and side sheet text
- settings: Add english/tagalog language option and translate menus
- book: Add kid-friendly animal facts, categories and picture slugs
- book: Add nature journal animal book with real animal pictures
- i18n: Translate loading screen text
- book: Add 17 animal portrait images

### Changed
- guide: Translate controls guide and simplify wording
- hud: Drop old 3d book, keep translated camera overlay
- tasks: Rewrite task and dialogue text in simple kid wording
- book: Add ring-bound journal styles
- game: Translate notices and dialogue, wire new animal book
- error: Translate and simplify error screen text

## 3.2 (2026-11-16)

Version code 23.

### Added
- ui: Add first and third person view button top right and send web quit to bulusanzoo.com
- game: Wire camera view button into the hud

### Fixed
- monkeys: Keep feet planted during idle2, smile and roar so they stop floating

## 3.1 (2026-11-15)

Version code 22.

### Added
- audio: Add goat sound
- audio: Add pigeon sound
- audio: Add frog croak sound
- audio: Add running on water loop
- audio: Add ranger lino voice with pitch and formant raised for a girl voice
- animals: Play goat and pigeon sounds and export sound helpers
- frogs: Croak at random intervals with distance fade
- game: Use running on water loop and play ranger lino voice in dialogue

### Changed
- assets: Precache new animal, water and ranger lino sounds

## 3.0 (2026-11-15)

Version code 21.

### Added
- assets: Add trailhead sign model
- props: Replace painted safety guide with trailhead sign model
- shadows: Add quality presets, shadow flags and sun-following shadow box
- settings: Add shadow quality setting with device default
- ui: Add shadows off, low, medium, high selector to graphics settings
- photo: Add device save via android bridge, share sheet or blob download
- android: Add gallery photo saver bridge and legacy storage permission
- game: Apply shadow quality to every model and save photos to device

### Changed
- world: Place trailhead sign at the old safety guide spot
- assets: Precache trailhead sign instead of safety sign
- scene: Hand shadow control to shadow helpers and add sun target

### Removed
- assets: Drop old safety sign model

## 2.9 (2026-11-14)

Version code 20.

### Added
- changelog: Script that adds a release section from commit messages

### Changed
- changelog: Add changelog with current version and history up to 2.8
- android: Fetch full history and update changelog on each release

## Up to 2.8 (before the changelog)

### Added
- Redesigned game menu and in-game interface, with a pixel-style splash screen.
- Kid-friendly controls guide with separate pages for computer and phone or tablet, found in Settings.
- Mouse wheel and two-finger pinch camera zoom, with terrain and obstacle collision.
- Visitor pathways between the plaza, barn, stable, garden, windmill and tiger enclosure, with edge stones.
- Creek footbridge where the tiger path crosses the river. The player walks over the deck and the rails keep them on it.
- Splashing footstep sound when walking or running in the river.
- Flying birds in the sky, built from code instead of models.
- A troop of four monkeys that change action every 3 seconds, with new monkey animations (no climbing).
- Feeding tasks for the safe animals, and a Feed button on the right side of the screen.
- New environment art: oaks, shade and cherry trees, fallen logs, haystacks, stable, parrot run and a safety sign at the tiger enclosure.
- Android release builds that publish a signed APK, and upload the newest APK to Cloudflare R2 while deleting the older ones.

### Changed
- Graphics settings now choose quality only; the frame rate target is fixed at 60 FPS or higher.
- Owl, parrot and pigeon are smaller so they look right next to the other animals.
- Animal sounds are loud when the player is close and fade smoothly with distance.
- The creek narrows where the path crosses it so the bridge can span it.
- One rabbit model is used for every rabbit.

### Fixed
- Monkey no longer slides or dips when a jump animation ends.
- Goat and other skinned animals stand on the ground instead of floating.

### Removed
- Old rabbit and realistic monkey models, and the bird models, with their credits.
- The on-screen FPS selection and the main-menu Controls button.
