require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const connectDB = require('./src/config/db');
const { initCloudinary } = require('./src/config/cloudinary');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { initSockets } = require('./src/sockets');

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const convoRoutes = require('./src/routes/conversations');
const msgRoutes = require('./src/routes/messages');
const groupRoutes = require('./src/routes/groups');
const notifRoutes = require('./src/routes/notifications');
const searchRoutes = require('./src/routes/search');

const app = express();
app.set('trust proxy', 1);
initCloudinary();

const rawOrigins = (process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...rawOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])];

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    // allow same-origin / curl / mobile (no origin) and allowlisted web origins
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Rate-limit API before routes (was previously after routes → never applied)
app.use('/api/', apiLimiter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});
initSockets(io);

// attach io to REST so controllers can emit
app.use((req, res, next) => { req.io = io; next(); });

app.get('/api/health', (req, res) => res.json({ success: true, uptime: process.uptime(), time: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', convoRoutes);
app.use('/api/messages', msgRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/search', searchRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI).then(() => {
  server.listen(PORT, () => console.log(`SyncSpace server on :${PORT}`));
}).catch((e) => { console.error(e); process.exit(1); });
