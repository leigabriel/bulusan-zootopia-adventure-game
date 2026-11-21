# Play Together room server

Runs the rooms for Play Together. One room holds up to 12 players, up to 20 rooms.
Players join the public zoo, or make a private room and share its 4-character code.
Only the nickname, the character, the position, emotes and short filtered chat messages are sent.

## Try it on your computer

```bash
npm run mp:dev                 # starts ws://localhost:8787/join
npm run dev                    # in another terminal
```

Open `http://localhost:5173/?mp=ws://localhost:8787/join` in two browser windows.
The address is remembered on that device. `?mp=off` forgets it.

## Put it online (Cloudflare, free plan)

```bash
cd server
npm install
npx wrangler login
npx wrangler deploy
```

Wrangler prints an address such as `https://bulusan-zoo-rooms.<you>.workers.dev`.
Build the game with the same address using `wss://`:

```bash
VITE_MULTIPLAYER_URL=wss://bulusan-zoo-rooms.<you>.workers.dev/join npm run build
```

The game already contains the address of the zoo's own server (`src/game/multiplayer/config.js`), so the web game and the Android app work without any variable. `VITE_MULTIPLAYER_URL` replaces it, for example for a test server. `?mp=off` hides Play Together on a device.

`ALLOWED_ORIGINS` in `wrangler.toml` can list extra website origins, separated by commas.
bulusanzoo.com and the Android app are allowed by default.

## Limits to know

- A room with players keeps a 100 ms timer, so one always-busy room uses about
  10,800 GB-s of Durable Object duration per day. The free plan gives 13,000.
- Moderation is demo level: a word filter for nicknames and chat (English and Tagalog), blocked links and phone numbers, a 1.5 second chat cooldown, mute, and 3 reports kick a player for the session. Free chat with children needs a proper review before a public release.
- Check the Philippines Data Privacy Act and Google Play Families policy before a public release.
