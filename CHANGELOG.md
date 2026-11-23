# Changelog

All notable changes to Bulusan Zootopia Adventure Game. Every build bumps the
version by 0.1 (see `version.json`) and the release workflow adds a section here
from the commit messages, so the newest version is always on top.

<!-- changelog:current -->
**Current version: 4.4** (version code 35, released 2026-11-23)
<!-- /changelog:current -->

<!-- changelog:entries -->

## 4.4 (2026-11-23)

Version code 35.

### Changed
- book: Use new english about-me text for all 16 animals
- i18n: New tagalog about-me text for the animal book

## 4.3 (2026-11-22)

Version code 34.

### Added
- cursor: Add pixel glove pointing-hand cursor draft
- multiplayer: Hold a new private room open to show its code first
- ui: Compact option for modal windows
- together: Show room code screen before entering and shrink type
- ui: Richer how-to-play guide, compact task panel, no menu animals
- i18n: Tagalog for room code screen, guide pages, no stag
- game: Release held room on join, keep stick during camera mode

### Changed
- audio: Replace game background music with new soundtrack
- audio: Re-encode background music to 112k to keep downloads small
- tasks: Feed all 12 animals after stag removal
- Compact window sizing and remove menu animal styles

### Removed
- cursor: Drop glove cursor draft
- animals: Remove red deer stag from the zoo
- data: Drop red deer stag from the animal book

## 4.2 (2026-11-21)

Version code 33.

### Added
- animals: Rideable horse with driven gait and seat position
- controls: Speed scale and player radius hooks for riding
- ui: Add ride horse and get off button
- i18n: Tagalog strings for horse riding
- multiplayer: Add ride action
- multiplayer: Show other players riding a horse
- game: Mount, ride and dismount horse with seated rider
- audio: Add hoof beat loop for horse riding
- models: Add japanese koi pond model
- koi: Koi pond with pellets, ripples and excited swimming
- world: Place koi pond and keep scenery clear of it
- world: Koi pond collision footprint
- world: Load koi pond and expose it to the game loop
- animals: Spawn three horses
- i18n: Tagalog string for feed koi
- ui: Add feed koi button
- game: Koi feeding, hoof sound while riding, eye-level cameras
- filter: Block tagalog and english body-part, sexual and slur words
- hud: On-screen waypoint placement and per-frame dom updater
- ui: Move quest arrow off the task card into a screen waypoint

### Fixed
- camera: First-person eye from head bone; wire screen waypoint
- camera: First-person eye height on horseback uses seated rider head

## 4.1 (2026-11-21)

Version code 32.

### Added
- multiplayer: Add english and tagalog word filter for names and chat
- multiplayer: Allow typed nicknames, add chat rules and private room codes
- multiplayer: Add filtered chat with cooldown to the room
- server: Add create room and join by code routing
- server: Support private rooms in the local dev server
- multiplayer: Add room modes, chat and not found status to client
- multiplayer: Use the zoo server by default so the apk works without a variable
- multiplayer: Keep chat log and notices in the session
- ui: Add room setup, typed name, header chip, players panel and chat box
- ui: Put players chip in the header and chat under the task card
- game: Wire room modes, chat and panel; ignore game keys while typing
- i18n: Add tagalog lines for rooms, typed names and chat
- multiplayer: Add hook that reports whether the device is online
- ui: Gray out play together when offline and show a connect message
- i18n: Add tagalog lines for the offline message

### Changed
- server: Describe private rooms, default server and chat limits
- ui: Let the game control whether the chat box is open

### Fixed
- multiplayer: Place name tags above the head bone
- game: Start with panel and chat closed and open only one at a time

## 4.0 (2026-11-19)

Version code 31.

### Fixed
- multiplayer: Call reconnect timers on the global object
- server: Call room snapshot interval on the global object

## 3.9 (2026-11-19)

Version code 30.

### Added
- multiplayer: Add shared protocol with list nicknames and fixed emotes
- multiplayer: Add room rules with limits, clamping and report kick
- multiplayer: Add socket host shared by worker and node server
- multiplayer: Add client with throttled updates and reconnect
- multiplayer: Add server url and saved nickname settings
- multiplayer: Add smoothing helpers for remote players
- multiplayer: Draw remote players with name tags and emote bubbles
- multiplayer: Add session joining client and ghost players
- server: Add cloudflare worker and durable object room
- server: Add local ws dev server
- ui: Add play together setup, players panel, mute and report
- ui: Add play together button and setup modal to main menu
- i18n: Add tagalog lines for play together
- game: Join room, tick ghost players and show together hud

### Changed
- server: Add wrangler config with sqlite durable object
- server: Add server package scripts
- server: Add local test and cloudflare deploy steps
- Add multiplayer url example
- Add ws dev dependency and mp:dev script
- ci: Pass play together server url to the android web build

### Fixed
- server: Allow adventuregame.bulusanzoo.com origin

## 3.8 (2026-11-17)

Version code 29.

### Added
- menu: Add mint meadow background picture

### Changed
- menu: Add sun rays, clouds, falling leaves and bobbing animals to menu scene
- menu: Replace flat sky and hills with layered meadow scene

## 3.7 (2026-11-17)

Version code 28.

### Added
- ui: Add sound, look, view, controls, language, phone, check and trophy grass icons

### Changed
- ui: Make close buttons plain so the grass x icon shows alone
- ui: Use grass x icon on modal and side sheet close buttons
- ui: Use grass icons in pause menu, guide cards, task checks, arrows and camera view button
- guide: Use grass icons for control cards
- camera: Use grass x icon on camera close button

## 3.6 (2026-11-17)

Version code 27.

### Added
- ui: Add grass menu button icons with pressed versions
- ui: Add grass icon that swaps to its pressed picture

### Changed
- ui: Show pressed grass icon while its button is held
- ui: Use grass icons for menu, guide, player, credits, tasks and camera buttons
- camera: Use grass camera icon on take photo button

## 3.5 (2026-11-17)

Version code 26.

### Removed
- book: Drop category tabs, rings and punched holes
- book: Drop unused ring positions
- book: Drop tab, ring and hole styles and widen page padding

## 3.4 (2026-11-16)

Version code 25.

### Added
- book: Add page size, turn angle, curl, shade and drag rules

### Changed
- book: Add covers, hinge, paper stacks, punched holes, hollow rings and leaf faces
- i18n: Rename graphics lines and add saving text

### Fixed
- book: Rebuild as two-page spread with spine, rings through holes, bending page turn and drag or swipe
- settings: Restore graphics section name and graphics quality label
- photo: Always download png in browsers and give every photo a unique name
- camera: Show save result in photo preview and drop false saved toast
- camera: Return save result so preview can show it

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
