# Den

Mobile encrypted messenger styled as Habbo Hotel. Opening a chat with a friend takes you into their pixel-art room where both customised avatars can hang out while messages flow E2E-encrypted in the background.

![Den preview — Victorian red walls + wood floor](docs/screenshot.png)

## Stack

- **mobile/** — Flutter + Flame (iOS + Android). Classic Habbo 64×32 isometric projection, sprite-based furniture, programmatic walls/floors.
- **preview/** — Browser preview of the room renderer that mirrors `mobile/lib/features/room/*` 1:1. Used for iteration before touching Flutter.
- **server-api/** — Fastify + PostgreSQL. Auth, avatar config, room config, friends, Signal Protocol key bundles, encrypted message store.
- **server-rooms/** — uWebSockets.js + Redis. Live avatar position/chat relay. Blind to chat payloads — only relays Signal envelopes.
- **tools/** — PixelLab generation + sprite normalisation scripts.

## Rendering rules

- **Strict 1:1 pixel art.** Every sprite renders at exactly its source resolution × room zoom (locked to a clean fraction like 2/3). No fractional scale factors, no anti-aliasing.
- **Wall + floor styles** are procedural. 8 wall presets (incl. 3 Victorian damasks) and 7 floor types (stone / wood / concrete / tile variants / marble / brick) all swap in via `window.roomStyle`.
- **Furniture sprite size = visual size.** If a piece looks too big, the source PNG is regenerated smaller via PixelLab — no runtime resize.

## Repo

https://github.com/defthrets/den (private)
