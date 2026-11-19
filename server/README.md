# Play Together room server

Runs the rooms for Play Together. One room holds up to 12 players, up to 20 rooms.
Only a list-made nickname, the character and the position are sent. No chat.

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

Without `VITE_MULTIPLAYER_URL` the Play Together button is hidden and the game is solo.

`ALLOWED_ORIGINS` in `wrangler.toml` can list extra website origins, separated by commas.
bulusanzoo.com and the Android app are allowed by default.

## Limits to know

- A room with players keeps a 100 ms timer, so one always-busy room uses about
  10,800 GB-s of Durable Object duration per day. The free plan gives 13,000.
- Moderation is demo level: list nicknames, fixed emotes, mute, and 3 reports kick a player for the session.
- Check the Philippines Data Privacy Act and Google Play Families policy before a public release.
