# Deployment

## Local dev
1. MongoDB: `docker run -d -p 27017:27017 mongo:7` or Atlas URI.
2. `cp server/.env.example server/.env` → set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL=http://localhost:5173`, Cloudinary keys.
3. `cp client/.env.example client/.env`
4. Install: `npm run install:all` (root) or separately.
5. Seed: `npm run seed --prefix server` → creates admin@syncspace.app / liam / mia / noah (`password123`).
6. Dev: `npm run dev` (concurrently) → server :5000, client :5173.

## Env checklist
- `PORT, MONGO_URI, JWT_SECRET (32+ chars), JWT_EXPIRES_IN=7d, CLIENT_URL`
- `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` — required for avatars/files (else uploads fail; text chat still works).
- `SMTP_HOST/PORT/USER/PASS/FROM` — optional; without it reset emails are mocked to console + `debugToken` returned in dev.
- `MAX_FILE_MB=10`

## Production build
- Client: `npm run build --prefix client` → `client/dist` (static).
- Server serves API only; serve `dist` via Nginx/Vercel/Netlify, or `app.use(express.static('../client/dist'))`.
- Set `NODE_ENV=production`, strong `JWT_SECRET`, Atlas `MONGO_URI`, prod `CLIENT_URL`s (comma-separated for CORS + Socket.IO).

## Docker
`docker compose up --build` → mongo :27017, server :5000, client :80 (add Dockerfiles below).
- `server/Dockerfile`: `FROM node:20-alpine → WORKDIR /app → COPY package*.json → npm ci --omit=dev → COPY . → CMD ["node","server.js"]`
- `client/Dockerfile`: multi-stage `node:20-alpine build → nginx:alpine serve dist`.

## Checklist
Helmet ✅ CORS allowlist ✅ rate-limit ✅ validation ✅ JWT expiry ✅ bcrypt(10) ✅ multer type+size filter ✅ Cloudinary signed uploads ✅ soft-delete ✅ pagination ✅ indexes ✅ health endpoint ✅.
