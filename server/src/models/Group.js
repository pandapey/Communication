const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    photo: { type: String, default: '' },
    photoPublicId: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
    // permissions
    onlyAdminsCanPost: { type: Boolean, default: false },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, default: Date.now },
    inviteCode: { type: String, unique: true, sparse: true },
    // unreadCounts stored as Map<userId, count> for WhatsApp-style badges
    unreadCounts: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

groupSchema.index({ 'members.user': 1 });
groupSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Group', groupSchema);
