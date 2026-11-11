# Socket.IO Architecture — SyncSpace

Auth: `io(auth={ token: JWT })`. Server verifies JWT in `io.use()`. Rejects without token.

## Rooms
- `user:<userId>` — personal, auto-joined on connect. Notifications + group invites.
- `dm:<conversationId>` — 1-1 conversation. Joined via `rooms:join` or `room:join`.
- `group:<groupId>` — group chat room.

## Client → Server
| Event | Payload | Description |
|---|---|---|
| `rooms:join` | `{ conversations: string[], groups: string[] }` | Bulk join after fetching lists |
| `room:join` | `string` room name | Join single room |
| `room:leave` | `string` | Leave room |
| `typing` | `{ room, isTyping: boolean }` | Broadcast typing to room peers |
| `message:read` | `{ conversationId?, groupId?, messageIds: string[] }` | Mark viewed, clears unread, emits `message:seen` |
| `message:delivered` | `{ messageId }` | Delivery ack, adds to `deliveredTo` |

## Server → Client
| Event | Payload | When |
|---|---|---|
| `message:new` | Message (populated sender, replyTo) | New DM/group message |
| `message:updated` | Message | Edit / reaction |
| `message:deleted` | `{ _id, conversation?, group? }` | Soft delete |
| `message:seen` | `{ room, userId, messageIds, at }` | Read receipt |
| `typing` | `{ room, userId, userName, isTyping }` | Peer typing |
| `presence:online` | `{ userId, at }` | User connected |
| `presence:offline` | `{ userId, lastSeen }` | Last socket of user disconnected |
| `group:created` | Group | Broadcast (clients refetch if member) |
| `group:updated` | Group | Rename / members / photo |

## Connection / Reconnection
- Client: `socket.io-client` with `reconnection: true, attempts: 10, delay: 1s`.
- On `connect`, re-emit `rooms:join` with fresh IDs (handles refresh + reconnect).
- Offline handling: REST pagination still works; optimistic UI shows `⏳ pending`; Socket replays missed messages via `GET /messages?page=1` on reconnect.
- Delivery flow: send REST → server saves + emits `message:new` → receivers emit `message:delivered` → sender sees `✓`; on view emit `message:read` → peers see `✓✓ seen`.

## Scaling note
Single-node uses in-memory `online: Map<userId, Set<socketId>>`. For multi-instance, add Redis adapter (`@socket.io/redis-adapter`) + sticky sessions.
