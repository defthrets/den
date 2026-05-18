-- Den database schema
-- Run: psql $DATABASE_URL -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Avatar customisation ──────────────────────────────────────────────────
-- All colour values are hex strings (#RRGGBB). Style IDs reference sprite sheets.
CREATE TABLE IF NOT EXISTS avatar_configs (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  skin_color    TEXT NOT NULL DEFAULT '#FFCC99',
  hair_style    SMALLINT NOT NULL DEFAULT 0,
  hair_color    TEXT NOT NULL DEFAULT '#4A3728',
  shirt_style   SMALLINT NOT NULL DEFAULT 0,
  shirt_color   TEXT NOT NULL DEFAULT '#4488CC',
  pants_style   SMALLINT NOT NULL DEFAULT 0,
  pants_color   TEXT NOT NULL DEFAULT '#2244AA',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Room layout ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_configs (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cols          SMALLINT NOT NULL DEFAULT 10,
  rows          SMALLINT NOT NULL DEFAULT 8,
  floor_tile_id SMALLINT NOT NULL DEFAULT 0,  -- index into tile catalogue
  wall_style_id SMALLINT NOT NULL DEFAULT 0,
  -- furniture: [{id, col, row, rotation, style_id}]
  furniture     JSONB NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Friends ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friends (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- ── Signal Protocol key bundles ───────────────────────────────────────────
-- Private keys NEVER leave the device. Server stores only public material.
CREATE TABLE IF NOT EXISTS key_bundles (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  identity_key       TEXT NOT NULL,           -- base64 public identity key
  signed_pre_key     TEXT NOT NULL,           -- base64 signed pre-key
  signed_pre_key_sig TEXT NOT NULL,           -- base64 signature
  -- One-time pre-keys are consumed one-per-session establishment
  one_time_pre_keys  JSONB NOT NULL DEFAULT '[]',
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Encrypted messages ────────────────────────────────────────────────────
-- Payload is opaque to the server (Signal Double Ratchet ciphertext).
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID NOT NULL REFERENCES users(id),
  recipient_id    UUID NOT NULL REFERENCES users(id),
  -- Signal message envelope: {type, registrationId, body, ...}
  encrypted_payload TEXT NOT NULL,
  delivered       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient
  ON messages (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
  );

-- ── Seed default avatar + room config on user creation ───────────────────
CREATE OR REPLACE FUNCTION init_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO avatar_configs (user_id) VALUES (NEW.id);
  INSERT INTO room_configs (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_user_profile ON users;
CREATE TRIGGER trg_init_user_profile
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION init_user_profile();
