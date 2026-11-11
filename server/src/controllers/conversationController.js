const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

async function listConversations(req, res, next) {
  try {
    const convos = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name email avatar isOnline lastSeen statusText')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name avatar' } })
      .sort({ lastMessageAt: -1 })
      .limit(50);
    // Self-heal: if the saved preview is a deleted placeholder (e.g. deleted
    // before the delete-fix was deployed), point it back at real content.
    const mapped = await Promise.all(convos.map(async (c) => {
      let last = c.lastMessage;
      if (last && last.isDeleted) {
        last = await Message.findOne({ conversation: c._id, isDeleted: false })
          .populate('sender', 'name avatar')
          .sort({ createdAt: -1 });
        await Conversation.findByIdAndUpdate(c._id, {
          lastMessage: last ? last._id : null,
          lastMessageAt: last ? last.createdAt : c.lastMessageAt,
        });
      }
      return {
        _id: c._id,
        participants: c.participants,
        peer: c.participants.find((p) => String(p._id) !== String(req.user._id)),
        lastMessage: last,
        lastMessageAt: last ? last.createdAt : c.lastMessageAt,
        unread: c.unreadCounts?.get(String(req.user._id)) || 0,
      };
    }));
    res.json({ success: true, conversations: mapped });
  } catch (e) { next(e); }
}

async function getOrCreate(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId || userId === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Invalid peer' });
    }
    const peer = await User.findById(userId);
    if (!peer) return res.status(404).json({ success: false, message: 'Peer not found' });
    // ObjectId arrays need string comparison — .includes() with ObjectId fails silently.
    const peerBlockedMe = (peer.blockedUsers || []).some((b) => String(b) === String(req.user._id));
    const iBlockedPeer = (req.user.blockedUsers || []).some((b) => String(b) === String(peer._id));
    if (peerBlockedMe || iBlockedPeer) {
      return res.status(403).json({ success: false, message: 'Cannot chat (blocked)' });
    }
    let convo = await Conversation.findOne({
      participants: { $all: [req.user._id, userId], $size: 2 },
    }).populate('participants', 'name email avatar isOnline lastSeen statusText');
    if (!convo) {
      convo = await Conversation.create({ participants: [req.user._id, userId] });
      convo = await convo.populate('participants', 'name email avatar isOnline lastSeen statusText');
    }
    res.json({ success: true, conversation: convo });
  } catch (e) { next(e); }
}

async function markRead(req, res, next) {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ success: false, message: 'Not found' });
    if (!convo.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }
    convo.unreadCounts.set(String(req.user._id), 0);
    await convo.save();
    await Message.updateMany(
      { conversation: convo._id, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function deleteConversation(req, res, next) {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ success: false, message: 'Not found' });
    if (!convo.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Not a participant' });
    }
    await Message.deleteMany({ conversation: convo._id });
    await Conversation.findByIdAndDelete(convo._id);
    res.json({ success: true, message: 'Chat deleted' });
  } catch (e) { next(e); }
}

module.exports = { listConversations, getOrCreate, markRead, deleteConversation };
