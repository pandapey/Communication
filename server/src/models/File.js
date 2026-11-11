const mongoose = require('mongoose');

// Optional standalone file registry (all attachments also embedded in Message).
// Useful for dashboard storage view + admin audit.
const fileSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    url: { type: String, required: true },
    publicId: String,
    fileName: String,
    mimeType: String,
    size: Number,
    resourceType: String,
  },
  { timestamps: true }
);

fileSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('File', fileSchema);
