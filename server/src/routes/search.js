const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const router = express.Router();
router.use(protect);

// GET /api/search?q=&type=users|messages|conversations
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, users: [], messages: [], conversations: [] });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const users = await User.find({ $or: [{ name: rx }, { email: rx }] })
      .limit(10);

    const messages = await Message.find({ $text: { $search: q }, isDeleted: false })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(20);

    const convos = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name email avatar')
      .sort({ lastMessageAt: -1 })
      .limit(20);

    // filter convos by participant name match
    const filteredConvos = convos.filter((c) =>
      c.participants.some((p) => rx.test(p.name || '') && String(p._id) !== String(req.user._id))
    );

    res.json({
      success: true,
      users: users.map((u) => u.toSafeJSON()),
      messages,
      conversations: filteredConvos,
    });
  } catch (e) { next(e); }
});

module.exports = router;
