const mongoose = require('mongoose');

// 1-1 direct conversation. Group chats use Group model + messages with group ref.
// We keep Conversation for DMs to track unread, lastMessage, blocking.
const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, default: Date.now },
    // unreadCounts stored as Map<userId, count> for O(1) dashboard badges
    unreadCounts: { type: Map, of: Number, default: {} },
    isArchivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
