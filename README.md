# ⬡ SyncSpace — Real-Time Collaboration & Communication Platform

MERN + Socket.IO team chat: DMs, groups, file sharing, presence, typing, read receipts, reactions, replies, notifications, search, dark mode.

![stack](https://img.shields.io/badge/MERN-Socket.IO-indigo) ![auth](https://img.shields.io/badge/JWT-RBAC-green)

## ✨ Features
- **Auth:** register/login/logout, forgot/reset (email), JWT (Bearer+cookie), protected routes, `user/admin` roles
- **Users:** profile + photo (Cloudinary), status text, online/offline + lastSeen, search, block/unblock
- **DMs:** text/images/files, timestamps, read/unread, typing, reactions, reply, edit, delete
- **Groups:** create, photo, add/remove, admin roles, rename, `onlyAdminsCanPost`
- **Realtime (Socket.IO):** instant messages, typing, presence, read receipts, notifications, updates/deletes
- **Notifications:** new message, group invite, mention (`@<userId>`), reaction
- **Files:** images/PDF/docs via Cloudinary, preview, 10MB + MIME validation
- **Search:** users, conversations, messages ($text)
- **Dashboard:** recent convos, active users, unread badges, groups, notifications
- **Advanced:** infinite scroll (Load older + pagination), message search, emoji picker, reply threads, dark mode, responsive, optimistic UI, reconnect handling

## 🗂 Structure
```
Communication/
  server/
    server.js
    src/{config,models,middleware,routes,controllers,sockets,utils,seed}
  client/
    src/{app,features/{auth,chat,groups,users,notifications},components/{chat,layout,ui},hooks,services}
  docs/{REST_API,SOCKET_EVENTS,SCHEMA,DEPLOYMENT}.md
  docker-compose.yml  package.json
```

## 🚀 Quickstart
```bash
# 1. Mongo
docker run -d -p 27017:27017 mongo:7
# 2. Env
cp server/.env.example server/.env   # set MONGO_URI, JWT_SECRET, Cloudinary
cp client/.env.example client/.env
# 3. Install + seed + dev
npm run install:all
npm run seed --prefix server
npm run dev
```
- Client: http://localhost:5173 • Server: http://localhost:5000/api/health
- Seed logins: `admin@syncspace.app`, `liam@syncspace.app`, `mia@syncspace.app`, `noah@syncspace.app` — password `password123`

## 🔌 Socket rooms
`user:<id>` (self), `dm:<conversationId>`, `group:<groupId>` — see `docs/SOCKET_EVENTS.md`.
Events: `rooms:join, room:join, typing, message:read/delivered` → `message:new/updated/deleted/seen, typing, presence:online/offline, group:created/updated`.

## 📡 API
See `docs/REST_API.md` — `/auth, /users, /conversations, /messages (multipart files), /groups, /notifications, /search`.

## 🗄 Schemas
See `docs/SCHEMA.md` — User, Conversation, Message (attachments/reactions/reply/mentions), Group (members+roles), Notification, File.

## ☁️ Deploy
See `docs/DEPLOYMENT.md` + `docker compose up --build`.

## 🧪 Try it
1. Login as Liam + Mia (two browsers) → Users tab → start DM → watch typing + ✓✓.
2. Create group → add members → mention with `@<userId>` → check 🔔.
3. Send image/PDF → preview → react/edit/delete → dark mode 🌙.
