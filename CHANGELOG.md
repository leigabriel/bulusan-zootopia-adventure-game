# Changelog

All notable changes to Bulusan Zootopia Adventure Game. Every build bumps the
version by 0.1 (see `version.json`) and the release workflow adds a section here
from the commit messages, so the newest version is always on top.

<!-- changelog:current -->
**Current version: 2.8** (version code 19, released 2026-11-15)
<!-- /changelog:current -->

<!-- changelog:entries -->

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
