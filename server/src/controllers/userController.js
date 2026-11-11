const User = require('../models/User');
const { uploadBuffer } = require('../utils/cloudUpload');

async function getProfile(req, res, next) {
  try {
    const user = await User.findById(req.params.id || req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: user.toSafeJSON() });
  } catch (e) { next(e); }
}

async function updateProfile(req, res, next) {
  try {
    const { name, statusText } = req.body;
    if (name) req.user.name = name;
    if (typeof statusText === 'string') req.user.statusText = statusText.slice(0, 140);
    await req.user.save();
    res.json({ success: true, user: req.user.toSafeJSON() });
  } catch (e) { next(e); }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image' });
    const r = await uploadBuffer(req.file.buffer, {
      folder: 'syncspace/avatars',
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    req.user.avatar = r.secure_url;
    req.user.avatarPublicId = r.public_id;
    await req.user.save();
    res.json({ success: true, user: req.user.toSafeJSON() });
  } catch (e) { next(e); }
}

async function searchUsers(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const filter = q
      ? { $or: [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] }
      : {};
    filter._id = { $ne: req.user._id };
    const [users, total] = await Promise.all([
      User.find(filter).sort({ isOnline: -1, name: 1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, users: users.map((u) => u.toSafeJSON()), total, page, pages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
}

async function blockUser(req, res, next) {
  try {
    const { id } = req.params;
    if (id === String(req.user._id)) return res.status(400).json({ success: false, message: "Can't block yourself" });
    if (!req.user.blockedUsers.includes(id)) req.user.blockedUsers.push(id);
    await req.user.save();
    res.json({ success: true, blocked: req.user.blockedUsers });
  } catch (e) { next(e); }
}

async function unblockUser(req, res, next) {
  try {
    req.user.blockedUsers = req.user.blockedUsers.filter((x) => String(x) !== req.params.id);
    await req.user.save();
    res.json({ success: true, blocked: req.user.blockedUsers });
  } catch (e) { next(e); }
}

async function activeUsers(req, res, next) {
  try {
    const users = await User.find({ isOnline: true, _id: { $ne: req.user._id } })
      .sort({ lastSeen: -1 }).limit(50);
    res.json({ success: true, users: users.map((u) => u.toSafeJSON()) });
  } catch (e) { next(e); }
}

module.exports = { getProfile, updateProfile, uploadAvatar, searchUsers, blockUser, unblockUser, activeUsers };
