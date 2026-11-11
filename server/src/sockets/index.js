const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Tracks online users: userId -> Set<socketId>
const online = new Map();

function getIo() { return global._io; }

async function setOnline(userId, isOnline) {
  await User.findByIdAndUpdate(userId, { isOnline, lastSeen: new Date() });
}

function initSockets(io) {
  global._io = io;

  // Auth middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (e) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = String(socket.user._id);
    if (!online.has(userId)) online.set(userId, new Set());
    online.get(userId).add(socket.id);
    await setOnline(userId, true);

    // Personal room for notifications
    socket.join(`user:${userId}`);
    io.emit('presence:online', { userId, at: new Date() });

    // Client tells us which DMs/groups to join (or server auto-joins)
    socket.on('rooms:join', async ({ conversations = [], groups = [] }) => {
      for (const id of conversations) socket.join(`dm:${id}`);
      for (const id of groups) socket.join(`group:${id}`);
    });

    socket.on('room:join', (room) => socket.join(room));
    socket.on('room:leave', (room) => socket.leave(room));

    // Typing indicators: { room, isTyping, kind: 'dm'|'group' }
    socket.on('typing', ({ room, isTyping }) => {
      socket.to(room).emit('typing', { room, userId, userName: socket.user.name, isTyping: !!isTyping });
    });

    // Read receipts from client after viewing
    socket.on('message:read', async ({ conversationId, groupId, messageIds = [] }) => {
      try {
        if (messageIds.length) {
          await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { readBy: socket.user._id } }
          );
        }
        const room = conversationId ? `dm:${conversationId}` : groupId ? `group:${groupId}` : null;
        if (room) {
          socket.to(room).emit('message:seen', { room, userId, messageIds, at: new Date() });
          // also clear unread
          if (conversationId) {
            await Conversation.findByIdAndUpdate(conversationId, {
              $set: { [`unreadCounts.${userId}`]: 0 },
            });
          }
        }
      } catch (e) { console.error('message:read error', e); }
    });

    // Delivery ack
    socket.on('message:delivered', async ({ messageId }) => {
      await Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredTo: socket.user._id } });
    });

    socket.on('disconnect', async () => {
      const set = online.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          online.delete(userId);
          await setOnline(userId, false);
          io.emit('presence:offline', { userId, lastSeen: new Date() });
        }
      }
    });
  });

  return { online };
}

module.exports = { initSockets, online };
