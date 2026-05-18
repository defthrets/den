import { App, WebSocket, HttpResponse } from 'uWebSockets.js';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

// ── Config ────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3002');
const JWT_SECRET = process.env.JWT_SECRET ?? 'changeme';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const PRESENCE_TTL = 30; // seconds

interface UserData {
  userId: string;
  username: string;
  roomId: string;
  col: number;
  row: number;
}

type Packet =
  | { type: 'join'; roomId: string; token: string }
  | { type: 'move'; col: number; row: number }
  | { type: 'leave' }
  | { type: 'chat'; encryptedPayload: string };

async function main() {
  // ── Redis ──────────────────────────────────────────────────────────────
  const redis = new Redis(REDIS_URL);
  const redisSub = new Redis(REDIS_URL);

  // In-memory per-instance room state: roomId -> connected sockets
  const rooms = new Map<string, Set<WebSocket<UserData>>>();

  function broadcast(roomId: string, payload: object, except?: WebSocket<UserData>) {
    const sockets = rooms.get(roomId);
    if (!sockets) return;
    const msg = JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws !== except) ws.send(msg, false);
    }
  }

  function send(ws: WebSocket<UserData>, payload: object) {
    ws.send(JSON.stringify(payload), false);
  }

  // Multi-instance fanout: subscribe to each room's Redis channel so a packet
  // arriving on one server reaches peers connected to other servers.
  redisSub.on('message', (channel: string, message: string) => {
    const roomId = channel.replace('room:', '');
    const sockets = rooms.get(roomId);
    if (!sockets) return;
    for (const ws of sockets) {
      ws.send(message, false);
    }
  });

  async function subscribeRoom(roomId: string) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
      await redisSub.subscribe(`room:${roomId}`);
    }
  }

  async function unsubscribeRoom(roomId: string) {
    if (rooms.get(roomId)?.size === 0) {
      rooms.delete(roomId);
      await redisSub.unsubscribe(`room:${roomId}`);
    }
  }

  // ── uWebSockets server ────────────────────────────────────────────────
  const uwsApp = App();

  uwsApp.ws<UserData>('/room', {
    idleTimeout: 60,
    maxPayloadLength: 4 * 1024, // 4 KB is plenty for a Signal envelope

    open() {
      // No-op: client must send a 'join' packet to enter a room
    },

    async message(ws, raw) {
      let packet: Packet;
      try {
        packet = JSON.parse(Buffer.from(raw).toString()) as Packet;
      } catch {
        return;
      }

      const data = ws.getUserData();

      switch (packet.type) {
        case 'join': {
          let claims: any;
          try {
            claims = jwt.verify(packet.token, JWT_SECRET);
          } catch {
            send(ws, { type: 'error', code: 'bad_token' });
            ws.close();
            return;
          }

          data.userId = claims.sub;
          data.username = claims.username;
          data.roomId = packet.roomId;
          data.col = 5;
          data.row = 5;

          await subscribeRoom(packet.roomId);
          rooms.get(packet.roomId)!.add(ws);

          await redis.setex(
            `presence:${data.userId}`,
            PRESENCE_TTL,
            packet.roomId,
          );

          // Send current snapshot to the joiner
          const roomState: UserData[] = [];
          for (const peer of rooms.get(packet.roomId)!) {
            if (peer !== ws) roomState.push(peer.getUserData());
          }
          send(ws, { type: 'room_state', avatars: roomState });

          // Announce to others
          broadcast(
            packet.roomId,
            {
              type: 'avatar_joined',
              userId: data.userId,
              username: data.username,
              col: data.col,
              row: data.row,
            },
            ws,
          );
          break;
        }

        case 'move': {
          if (!data.roomId) return;
          if (
            typeof packet.col !== 'number' ||
            typeof packet.row !== 'number' ||
            packet.col < 0 || packet.col >= 10 ||
            packet.row < 0 || packet.row >= 8
          ) return;

          data.col = packet.col;
          data.row = packet.row;

          await redis.expire(`presence:${data.userId}`, PRESENCE_TTL);

          const moveMsg = {
            type: 'avatar_moved',
            userId: data.userId,
            col: packet.col,
            row: packet.row,
          };
          await redis.publish(`room:${data.roomId}`, JSON.stringify(moveMsg));
          broadcast(data.roomId, moveMsg, ws);
          break;
        }

        case 'chat': {
          if (!data.roomId || !packet.encryptedPayload) return;

          // Server is blind to the payload — it just relays the envelope.
          const chatMsg = {
            type: 'chat',
            fromUserId: data.userId,
            encryptedPayload: packet.encryptedPayload,
          };
          await redis.publish(`room:${data.roomId}`, JSON.stringify(chatMsg));
          broadcast(data.roomId, chatMsg, ws);
          break;
        }

        case 'leave': {
          ws.close();
          break;
        }
      }
    },

    async close(ws) {
      const data = ws.getUserData();
      if (!data.roomId) return;

      const sockets = rooms.get(data.roomId);
      sockets?.delete(ws);

      broadcast(data.roomId, {
        type: 'avatar_left',
        userId: data.userId,
      });

      await redis.del(`presence:${data.userId}`);
      await unsubscribeRoom(data.roomId);
    },
  });

  uwsApp.get('/health', (res: HttpResponse) => {
    res.end('ok');
  });

  uwsApp.listen(PORT, (token) => {
    if (token) {
      console.log(`den-rooms listening on :${PORT}`);
    } else {
      console.error(`Failed to listen on :${PORT}`);
      process.exit(1);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
