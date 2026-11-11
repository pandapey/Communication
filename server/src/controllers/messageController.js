const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const File = require('../models/File');
const { uploadBuffer, resourceTypeFor } = require('../utils/cloudUpload');

function parseMentions(text) {
  const out = [];
  const re = /@([a-f0-9]{24})/g; // client sends @<userId> for mentions
  let m;
  while ((m = re.exec(text || ''))) out.push(m[1]);
  return [...new Set(out)];
}

function isGroupMember(group, userId) {
  return group.members.some((mem) => String(mem.user) === String(userId));
}
function isGroupAdmin(group, userId) {
  return group.members.some((mem) => String(mem.user) === String(userId) && mem.role === 'admin');
}

async function assertCanRead({ conversationId, groupId, userId }) {
  if (conversationId) {
    const convo = await Conversation.findById(conversationId).select('participants');
    if (!convo) { const e = new Error('Conversation not found'); e.statusCode = 404; throw e; }
    if (!convo.participants.some((p) => String(p) === String(userId))) {
      const e = new Error('Not a participant of this conversation'); e.statusCode = 403; throw e;
    }
    return { convo };
  }
  if (groupId) {
    const group = await Group.findById(groupId).select('members onlyAdminsCanPost');
    if (!group) { const e = new Error('Group not found'); e.statusCode = 404; throw e; }
    if (!isGroupMember(group, userId)) {
      const e = new Error('Not a member of this group'); e.statusCode = 403; throw e;
    }
    return { group };
  }
  const e = new Error('conversationId or groupId required'); e.statusCode = 400; throw e;
}

async function listMessages(req, res, next) {
  try {
    const { conversationId, groupId, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '30', 10));
    if (!conversationId && !groupId) return res.status(400).json({ success: false, message: 'conversationId or groupId required' });
    // Authorization: caller must belong to the DM / group
    try {
      await assertCanRead({ conversationId, groupId, userId: req.user._id });
    } catch (authzErr) {
      const status = authzErr.statusCode || 403;
      return res.status(status).json({ success: false, message: authzErr.message });
    }
    const filter = { isDeleted: false };
    if (conversationId) filter.conversation = conversationId;
    if (groupId) filter.group = groupId;
    if (q) filter.$text = { $search: q };
    const [messages, total] = await Promise.all([
      Message.find(filter)
        .populate('sender', 'name avatar')
        .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name' } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Message.countDocuments(filter),
    ]);
    res.json({ success: true, messages: messages.reverse(), total, page, pages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
}

async function sendMessage(req, res, next) {
  try {
    const { conversationId, groupId, replyTo } = req.body;
    // Coerce text to string — a non-string payload would crash .slice() below.
    const text = typeof req.body.text === 'string' ? req.body.text : String(req.body.text ?? '');
    if (!conversationId && !groupId) return res.status(400).json({ success: false, message: 'Target required' });
    if (conversationId && groupId) return res.status(400).json({ success: false, message: 'Send to either DM or group, not both' });
    if (!text.trim() && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ success: false, message: 'Empty message' });
    }
    // Authorization + permission checks
    let convoDoc = null;
    let groupDoc = null;
    try {
      const r = await assertCanRead({ conversationId, groupId, userId: req.user._id });
      convoDoc = r.convo || null;
      groupDoc = r.group || null;
    } catch (authzErr) {
      const status = authzErr.statusCode || 403;
      return res.status(status).json({ success: false, message: authzErr.message });
    }
    if (groupDoc && groupDoc.onlyAdminsCanPost && !isGroupAdmin(groupDoc, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only admins can post in this group' });
    }
    if (conversationId) {
      const full = convoDoc.participants
        ? await Conversation.findById(conversationId).populate('participants', 'blockedUsers')
        : null;
      if (full) {
        const peer = full.participants.find((p) => String(p._id) !== String(req.user._id));
        if (peer && (peer.blockedUsers || []).some((b) => String(b) === String(req.user._id))) {
          return res.status(403).json({ success: false, message: 'Cannot message this user' });
        }
      }
    }
    // replyTo must belong to same room when provided
    if (replyTo) {
      const parent = await Message.findById(replyTo).select('conversation group');
      if (parent) {
        const sameRoom = String(parent.conversation || '') === String(conversationId || '') &&
          String(parent.group || '') === String(groupId || '');
        if (!sameRoom) return res.status(400).json({ success: false, message: 'Reply target is in another conversation' });
      }
    }
    const attachments = [];
    for (const f of req.files || []) {
      const r = await uploadBuffer(f.buffer, { folder: 'syncspace/files', fileName: f.originalname, mimeType: f.mimetype });
      attachments.push({
        url: r.secure_url, publicId: r.public_id, fileName: f.originalname,
        mimeType: f.mimetype, size: f.size, resourceType: resourceTypeFor(f.mimetype),
      });
    }
    const msg = await Message.create({
      sender: req.user._id,
      conversation: conversationId || undefined,
      group: groupId || undefined,
      text: text.slice(0, 4000),
      attachments,
      replyTo: replyTo || undefined,
      mentions: parseMentions(text),
      readBy: [req.user._id],
    });

    if (conversationId) {
      const convo = await Conversation.findById(conversationId);
      if (convo) {
        convo.lastMessage = msg._id;
        convo.lastMessageAt = new Date();
        for (const pid of convo.participants) {
          if (String(pid) !== String(req.user._id)) {
            convo.unreadCounts.set(String(pid), (convo.unreadCounts.get(String(pid)) || 0) + 1);
          }
        }
        await convo.save();
      }
    } else if (groupId) {
      const grp = await Group.findById(groupId);
      if (grp) {
        grp.lastMessage = msg._id;
        grp.lastMessageAt = new Date();
        for (const mem of grp.members) {
          const mid = String(mem.user);
          if (mid !== String(req.user._id)) {
            grp.unreadCounts.set(mid, (grp.unreadCounts.get(mid) || 0) + 1);
          }
        }
        await grp.save();
      }
    }

    for (const a of attachments) {
      await File.create({ owner: req.user._id, message: msg._id, url: a.url, publicId: a.publicId, fileName: a.fileName, mimeType: a.mimeType, size: a.size, resourceType: a.resourceType });
    }

    const populated = await msg.populate([
      { path: 'sender', select: 'name avatar' },
      { path: 'replyTo', populate: { path: 'sender', select: 'name' } },
    ]);

    // mention notifications
    for (const uid of msg.mentions) {
      await Notification.create({
        recipient: uid, sender: req.user._id, type: 'mention',
        title: `${req.user.name} mentioned you`, body: text.slice(0, 120),
        data: { messageId: msg._id, conversationId: conversationId || undefined, groupId: groupId || undefined },
      });
    }

    // emit via socket (attached in req.io by server.js)
    if (req.io) {
      const room = conversationId ? `dm:${conversationId}` : `group:${groupId}`;
      req.io.to(room).emit('message:new', populated);
    }

    res.status(201).json({ success: true, message: populated });
  } catch (e) { next(e); }
}

async function editMessage(req, res, next) {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg || msg.isDeleted) return res.status(404).json({ success: false, message: 'Not found' });
    if (String(msg.sender) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Only sender can edit' });
    msg.text = (req.body.text || '').slice(0, 4000);
    msg.isEdited = true;
    msg.editedAt = new Date();
    await msg.save();
    const populated = await msg.populate('sender', 'name avatar');
    if (req.io) {
      const room = msg.conversation ? `dm:${msg.conversation}` : `group:${msg.group}`;
      req.io.to(room).emit('message:updated', populated);
    }
    res.json({ success: true, message: populated });
  } catch (e) { next(e); }
}

async function deleteMessage(req, res, next) {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Not found' });
    const isAdmin = req.user.role === 'admin';
    if (String(msg.sender) !== String(req.user._id) && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Cannot delete' });
    }
    // Point the chat-list preview back at the latest non-deleted message,
    // so "This message was deleted" never lingers in the sidebar.
    async function refreshPreview() {
      if (msg.conversation) {
        const prev = await Message.findOne({ conversation: msg.conversation, isDeleted: false }).sort({ createdAt: -1 });
        await Conversation.findByIdAndUpdate(msg.conversation, {
          lastMessage: prev ? prev._id : null,
          lastMessageAt: prev ? prev.createdAt : msg.createdAt,
        });
      } else if (msg.group) {
        const prev = await Message.findOne({ group: msg.group, isDeleted: false }).sort({ createdAt: -1 });
        await Group.findByIdAndUpdate(msg.group, {
          lastMessage: prev ? prev._id : null,
          lastMessageAt: prev ? prev.createdAt : msg.createdAt,
        });
      }
    }
    // Second delete removes the "This message was deleted" trace entirely.
    if (msg.isDeleted) {
      const room = msg.conversation ? `dm:${msg.conversation}` : `group:${msg.group}`;
      const payload = { _id: msg._id, conversation: msg.conversation, group: msg.group, hard: true };
      await Message.deleteOne({ _id: msg._id });
      await refreshPreview();
      if (req.io && room) req.io.to(room).emit('message:deleted', payload);
      return res.json({ success: true, hard: true });
    }
    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.text = 'This message was deleted';
    msg.attachments = [];
    await msg.save();
    await refreshPreview();
    if (req.io) {
      const room = msg.conversation ? `dm:${msg.conversation}` : `group:${msg.group}`;
      req.io.to(room).emit('message:deleted', { _id: msg._id, conversation: msg.conversation, group: msg.group });
    }
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function toggleReaction(req, res, next) {
  try {
    const { emoji } = req.body;
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Not found' });
    const idx = msg.reactions.findIndex((r) => String(r.user) === String(req.user._id) && r.emoji === emoji);
    if (idx >= 0) msg.reactions.splice(idx, 1);
    else msg.reactions.push({ user: req.user._id, emoji });
    await msg.save();
    const populated = await msg.populate('sender', 'name avatar');
    if (req.io) {
      const room = msg.conversation ? `dm:${msg.conversation}` : `group:${msg.group}`;
      req.io.to(room).emit('message:updated', populated);
    }
    if (idx < 0 && String(msg.sender) !== String(req.user._id)) {
      await Notification.create({
        recipient: msg.sender, sender: req.user._id, type: 'reaction',
        title: `${req.user.name} reacted ${emoji}`, body: (msg.text || '').slice(0, 100),
        data: { messageId: msg._id },
      });
    }
    res.json({ success: true, message: populated });
  } catch (e) { next(e); }
}

module.exports = { listMessages, sendMessage, editMessage, deleteMessage, toggleReaction };
