const Notification = require('../models/Notification');

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const filter = { recipient: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).populate('sender', 'name avatar').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);
    res.json({ success: true, notifications: items, total, unread, page, pages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
}

async function markRead(req, res, next) {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { list, markRead, markAllRead };
