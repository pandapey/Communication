const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['new_message', 'group_invite', 'mention', 'reaction', 'team_invite', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    data: {
      conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
      groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    },
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
