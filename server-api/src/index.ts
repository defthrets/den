import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function main() {
  const app = Fastify({ logger: true });
  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyJwt, { secret: process.env.JWT_SECRET ?? 'changeme' });

  // ── Auth guard ────────────────────────────────────────────────────────────
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ── POST /auth/register ──────────────────────────────────────────────────
  app.post<{ Body: { username: string; displayName: string; password: string } }>(
    '/auth/register',
    async (req, reply) => {
      const { username, displayName, password } = req.body;
      if (!username || !password || !displayName) {
        return reply.status(400).send({ error: 'Missing fields' });
      }

      const hash = await bcrypt.hash(password, 12);
      try {
        const { rows } = await db.query(
          `INSERT INTO users (username, display_name, password_hash)
           VALUES ($1, $2, $3) RETURNING id, username, display_name`,
          [username.toLowerCase(), displayName, hash],
        );
        const user = rows[0];
        const token = app.jwt.sign({ sub: user.id, username: user.username });
        return { token, user };
      } catch (e: any) {
        if (e.code === '23505') {
          return reply.status(409).send({ error: 'Username taken' });
        }
        throw e;
      }
    },
  );

  // ── POST /auth/login ─────────────────────────────────────────────────────
  app.post<{ Body: { username: string; password: string } }>(
    '/auth/login',
    async (req, reply) => {
      const { username, password } = req.body;
      const { rows } = await db.query(
        'SELECT id, username, display_name, password_hash FROM users WHERE username = $1',
        [username.toLowerCase()],
      );
      const user = rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      const token = app.jwt.sign({ sub: user.id, username: user.username });
      return {
        token,
        user: { id: user.id, username: user.username, displayName: user.display_name },
      };
    },
  );

  // ── GET /users/me ────────────────────────────────────────────────────────
  app.get(
    '/users/me',
    { preHandler: [app.authenticate] },
    async (req: any) => {
      const { rows } = await db.query(
        `SELECT u.id, u.username, u.display_name, a.preset
         FROM users u
         JOIN avatar_configs a ON a.user_id = u.id
         WHERE u.id = $1`,
        [req.user.sub],
      );
      return rows[0];
    },
  );

  // ── GET /users/:id/avatar — public avatar preset (for rendering peers) ─
  app.get<{ Params: { id: string } }>(
    '/users/:id/avatar',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { rows } = await db.query(
        `SELECT u.id, u.username, a.preset
         FROM users u
         JOIN avatar_configs a ON a.user_id = u.id
         WHERE u.id = $1`,
        [req.params.id],
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Not found' });
      return rows[0];
    },
  );

  // ── GET /catalog/wardrobe — available avatar presets ─────────────────────
  // Each preset corresponds to a Retro-Diffusion-generated sprite sheet
  // bundled with the client at assets/sprites/<id>.png. The server only
  // tracks the id (in avatar_configs.preset) — colours/styles are baked
  // into the sprite at generation time.
  app.get('/catalog/wardrobe', async () => ({
    presets: [
      { id: 'casual_blue',     name: 'Casual' },
      { id: 'tank_redhead',    name: 'Tank' },
      { id: 'punk_purple',     name: 'Punk' },
      { id: 'summer_yellow',   name: 'Summer' },
      { id: 'athletic_green',  name: 'Athletic' },
      { id: 'scholar_glasses', name: 'Scholar' },
      { id: 'biker_black',     name: 'Biker' },
    ],
  }));

  // ── GET /catalog/furniture — list of placeable items ────────────────────
  // Sprite at /assets/furniture/<id>.png on the client.
  app.get('/catalog/furniture', async () => ({
    items: [
      { id: 'chair_wood',  name: 'Wooden chair' },
      { id: 'sofa_red',    name: 'Red sofa' },
      { id: 'bed_blue',    name: 'Blue bed' },
      { id: 'plant_tall',  name: 'Tall plant' },
      { id: 'table_round', name: 'Round table' },
      { id: 'lamp_floor',  name: 'Floor lamp' },
    ],
  }));

  // ── PUT /users/me/avatar ─────────────────────────────────────────────────
  app.put<{ Body: { preset?: string } }>(
    '/users/me/avatar',
    { preHandler: [app.authenticate] },
    async (req: any, reply) => {
      const { preset } = req.body;
      if (!preset || typeof preset !== 'string') {
        return reply.status(400).send({ error: 'preset is required' });
      }
      // TODO: validate preset is in /catalog/wardrobe.presets
      await db.query(
        `UPDATE avatar_configs
         SET preset = $2, updated_at = NOW()
         WHERE user_id = $1`,
        [req.user.sub, preset],
      );
      return { ok: true };
    },
  );

  // ── GET /users/:id/room ──────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/users/:id/room',
    { preHandler: [app.authenticate] },
    async (req) => {
      const { rows } = await db.query(
        'SELECT * FROM room_configs WHERE user_id = $1',
        [req.params.id],
      );
      return rows[0] ?? null;
    },
  );

  // ── PUT /users/me/room ───────────────────────────────────────────────────
  app.put<{ Body: { floorTileId?: number; wallStyleId?: number; furniture?: unknown[] } }>(
    '/users/me/room',
    { preHandler: [app.authenticate] },
    async (req: any) => {
      const { floorTileId, wallStyleId, furniture } = req.body;
      await db.query(
        `UPDATE room_configs SET
           floor_tile_id = COALESCE($2, floor_tile_id),
           wall_style_id = COALESCE($3, wall_style_id),
           furniture     = COALESCE($4::jsonb, furniture),
           updated_at    = NOW()
         WHERE user_id = $1`,
        [req.user.sub, floorTileId, wallStyleId, furniture ? JSON.stringify(furniture) : null],
      );
      return { ok: true };
    },
  );

  // ── GET /friends ─────────────────────────────────────────────────────────
  app.get(
    '/friends',
    { preHandler: [app.authenticate] },
    async (req: any) => {
      const { rows } = await db.query(
        `SELECT u.id, u.username, u.display_name
         FROM friends f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = $1`,
        [req.user.sub],
      );
      return rows;
    },
  );

  // ── POST /friends ────────────────────────────────────────────────────────
  app.post<{ Body: { username: string } }>(
    '/friends',
    { preHandler: [app.authenticate] },
    async (req: any, reply) => {
      const { rows } = await db.query(
        'SELECT id FROM users WHERE username = $1',
        [req.body.username.toLowerCase()],
      );
      if (!rows[0]) return reply.status(404).send({ error: 'User not found' });
      await db.query(
        'INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.sub, rows[0].id],
      );
      return { ok: true };
    },
  );

  // ── GET /keys/:userId — fetch a public key bundle for session setup ──────
  app.get<{ Params: { userId: string } }>(
    '/keys/:userId',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { rows } = await db.query(
        `SELECT identity_key, signed_pre_key, signed_pre_key_sig,
                one_time_pre_keys->0 AS one_time_pre_key
         FROM key_bundles WHERE user_id = $1`,
        [req.params.userId],
      );
      if (!rows[0]) return reply.status(404).send({ error: 'No key bundle' });

      // Consume the one-time pre-key
      await db.query(
        `UPDATE key_bundles
         SET one_time_pre_keys = one_time_pre_keys - 0
         WHERE user_id = $1`,
        [req.params.userId],
      );

      return rows[0];
    },
  );

  // ── POST /keys — upload my key bundle ───────────────────────────────────
  app.post<{
    Body: {
      identityKey: string;
      signedPreKey: string;
      signedPreKeySig: string;
      oneTimePreKeys: string[];
    };
  }>(
    '/keys',
    { preHandler: [app.authenticate] },
    async (req: any) => {
      const { identityKey, signedPreKey, signedPreKeySig, oneTimePreKeys } = req.body;
      await db.query(
        `INSERT INTO key_bundles
           (user_id, identity_key, signed_pre_key, signed_pre_key_sig, one_time_pre_keys)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET
           identity_key       = EXCLUDED.identity_key,
           signed_pre_key     = EXCLUDED.signed_pre_key,
           signed_pre_key_sig = EXCLUDED.signed_pre_key_sig,
           one_time_pre_keys  = EXCLUDED.one_time_pre_keys,
           updated_at         = NOW()`,
        [req.user.sub, identityKey, signedPreKey, signedPreKeySig, JSON.stringify(oneTimePreKeys)],
      );
      return { ok: true };
    },
  );

  // ── POST /messages — store an encrypted message ──────────────────────────
  app.post<{ Body: { recipientId: string; encryptedPayload: string } }>(
    '/messages',
    { preHandler: [app.authenticate] },
    async (req: any) => {
      const { recipientId, encryptedPayload } = req.body;
      const { rows } = await db.query(
        `INSERT INTO messages (sender_id, recipient_id, encrypted_payload)
         VALUES ($1, $2, $3) RETURNING id, created_at`,
        [req.user.sub, recipientId, encryptedPayload],
      );
      return rows[0];
    },
  );

  // ── GET /messages/:userId — conversation history ────────────────────────
  app.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
    '/messages/:userId',
    { preHandler: [app.authenticate] },
    async (req: any) => {
      const limit = Math.min(parseInt(req.query.limit ?? '50'), 100);
      const { rows } = await db.query(
        `SELECT id, sender_id, encrypted_payload, created_at
         FROM messages
         WHERE
           (sender_id = $1 AND recipient_id = $2)
           OR (sender_id = $2 AND recipient_id = $1)
         ORDER BY created_at DESC
         LIMIT $3`,
        [req.user.sub, req.params.userId, limit],
      );
      return rows.reverse();
    },
  );

  // ── Start ────────────────────────────────────────────────────────────────
  const port = parseInt(process.env.PORT ?? '3001');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`den-api listening on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
