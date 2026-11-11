# REST API — SyncSpace
Base: `http://localhost:5000/api` — Auth: `Authorization: Bearer <JWT>` (cookie `token` also accepted).

## Auth `/auth`
- `POST /auth/register` {name,email,password} → {token,user}
- `POST /auth/login` {email,password}
- `POST /auth/logout` (auth)
- `GET /auth/me` (auth)
- `POST /auth/forgot-password` {email} → {message, debugToken? (dev)}
- `POST /auth/reset-password/:token` {password}

## Users `/users` (auth)
- `GET /users/search?q=&page=&limit=` — exclude self, online first
- `GET /users/active` — online users
- `GET /users/me`, `GET /users/:id`
- `PUT /users/me` {name,statusText}
- `POST /users/avatar` multipart `avatar` → Cloudinary
- `POST /users/:id/block`, `DELETE /users/:id/block`

## Conversations `/conversations` (auth)
- `GET /conversations` → [{_id, participants, peer, lastMessage, unread}]
- `POST /conversations/dm` {userId} — get-or-create (403 if blocked)
- `POST /conversations/:id/read` — zero unread + mark readBy

## Messages `/messages` (auth)
- `GET /messages?conversationId=&groupId=&page=&limit=&q=` — paginated, newest-last, `q` uses $text search
- `POST /messages` multipart: `conversationId|groupId, text, replyTo?, files[0..5]` → emits `message:new`
- `PUT /messages/:id` {text} — sender only → `message:updated`
- `DELETE /messages/:id` — sender or admin → `message:deleted`
- `POST /messages/:id/reaction` {emoji} — toggle → `message:updated` + notification

## Groups `/groups` (auth)
- `GET /groups` — my groups
- `POST /groups` {name, description, memberIds[]} → invites + `group:created`
- `GET /groups/:id` — members only
- `PUT /groups/:id` {name, description, onlyAdminsCanPost} — admin
- `POST /groups/:id/photo` multipart `photo` — admin
- `POST /groups/:id/members` {memberIds[]} — admin
- `DELETE /groups/:id/members/:userId` — admin or self-leave
- `PUT /groups/:id/admin` {userId, role} — admin

## Notifications `/notifications` (auth)
- `GET /notifications?page=&limit=&unread=true?` → {notifications, total, unread}
- `PUT /notifications/:id/read`, `PUT /notifications/read-all`

## Search `/search` (auth)
- `GET /search?q=` → {users[10], messages[20], conversations[]}

## Health
- `GET /health` → {uptime, time}

### Errors
`{ success:false, message, errors?[{field,msg}] }` — 400 validation, 401 auth, 403 blocked/forbidden, 404, 429 rate-limit.
### Rate limits
`/api` 300/15min, auth 50/15min, `POST /messages` 60/min.
