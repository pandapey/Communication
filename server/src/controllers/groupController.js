const { v4: uuid } = require('uuid');
const Group = require('../models/Group');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { uploadBuffer } = require('../utils/cloudUpload');

function isMember(group, userId) {
  return group.members.some((m) => String(m.user) === String(userId));
}
function isAdmin(group, userId) {
  return group.members.some((m) => String(m.user) === String(userId) && m.role === 'admin');
}

async function listGroups(req, res, next) {
  try {
    const groups = await Group.find({ 'members.user': req.user._id })
      .populate('members.user', 'name avatar isOnline')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } })
      .sort({ lastMessageAt: -1 });
    // Self-heal: same deleted-preview fix as DMs (see conversationController).
    const mapped = await Promise.all(groups.map(async (g) => {
      let last = g.lastMessage;
      if (last && last.isDeleted) {
        last = await Message.findOne({ group: g._id, isDeleted: false })
          .populate('sender', 'name')
          .sort({ createdAt: -1 });
        await Group.findByIdAndUpdate(g._id, {
          lastMessage: last ? last._id : null,
          lastMessageAt: last ? last.createdAt : g.lastMessageAt,
        });
      }
      const o = g.toObject();
      o.lastMessage = last && last.toObject ? last.toObject() : last;
      o.lastMessageAt = last ? last.createdAt : g.lastMessageAt;
      o.unread = g.unreadCounts?.get(String(req.user._id)) || 0;
      o.isAdmin = g.members.some((m) => String(m.user?._id || m.user) === String(req.user._id) && m.role === 'admin');
      return o;
    }));
    res.json({ success: true, groups: mapped });
  } catch (e) { next(e); }
}

async function createGroup(req, res, next) {
  try {
    const mongoose = require('mongoose');
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    // Sanitize memberIds — invalid ObjectIds previously caused a 500 CastError.
    const rawIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const cleanIds = [...new Set(rawIds.map((id) => String(id)).filter((id) => mongoose.Types.ObjectId.isValid(id)))].slice(0, 100);
    const memberIds = cleanIds.filter((id) => id !== String(req.user._id));
    const unique = [String(req.user._id), ...memberIds];
    const group = await Group.create({
      name,
      description: description || '',
      createdBy: req.user._id,
      members: unique.map((id) => ({ user: id, role: String(id) === String(req.user._id) ? 'admin' : 'member' })),
      inviteCode: uuid().slice(0, 8),
    });
    for (const id of memberIds) {
      if (String(id) === String(req.user._id)) continue;
      await Notification.create({
        recipient: id, sender: req.user._id, type: 'group_invite',
        title: `Invited to ${name}`, body: `${req.user.name} added you to ${name}`,
        data: { groupId: group._id },
      });
    }
    const populated = await group.populate('members.user', 'name avatar isOnline');
    if (req.io) req.io.emit('group:created', populated);
    res.status(201).json({ success: true, group: populated });
  } catch (e) { next(e); }
}

async function getGroup(req, res, next) {
  try {
    const group = await Group.findById(req.params.id).populate('members.user', 'name email avatar isOnline lastSeen');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ success: false, message: 'Not a member' });
    res.json({ success: true, group });
  } catch (e) { next(e); }
}

async function renameGroup(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    if (!isAdmin(group, req.user._id)) return res.status(403).json({ success: false, message: 'Admins only' });
    group.name = req.body.name || group.name;
    if (typeof req.body.description === 'string') group.description = req.body.description;
    if (typeof req.body.onlyAdminsCanPost === 'boolean') group.onlyAdminsCanPost = req.body.onlyAdminsCanPost;
    await group.save();
    if (req.io) req.io.to(`group:${group._id}`).emit('group:updated', group);
    res.json({ success: true, group });
  } catch (e) { next(e); }
}

async function updatePhoto(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    if (!isAdmin(group, req.user._id)) return res.status(403).json({ success: false, message: 'Admins only' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No image' });
    const { uploadBuffer: up } = require('../utils/cloudUpload');
    const r = await up(req.file.buffer, { folder: 'syncspace/groups', fileName: req.file.originalname, mimeType: req.file.mimetype });
    group.photo = r.secure_url;
    group.photoPublicId = r.public_id;
    await group.save();
    res.json({ success: true, group });
  } catch (e) { next(e); }
}

async function addMembers(req, res, next) {
  try {
    const mongoose = require('mongoose');
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    // Any member may add people (like WhatsApp's default); removing members
    // and toggling admins stays admin-only (see removeMember / setAdmin).
    if (!isMember(group, req.user._id)) return res.status(403).json({ success: false, message: 'Not a member' });
    const rawIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const cleanIds = [...new Set(rawIds.map((id) => String(id)).filter((id) => mongoose.Types.ObjectId.isValid(id)))].slice(0, 100);
    for (const id of cleanIds) {
      if (!isMember(group, id)) {
        group.members.push({ user: id, role: 'member' });
        await Notification.create({
          recipient: id, sender: req.user._id, type: 'group_invite',
          title: `Added to ${group.name}`, body: `${req.user.name} added you`,
          data: { groupId: group._id },
        });
      }
    }
    await group.save();
    const populated = await group.populate('members.user', 'name avatar isOnline');
    if (req.io) req.io.to(`group:${group._id}`).emit('group:updated', populated);
    res.json({ success: true, group: populated });
  } catch (e) { next(e); }
}

async function removeMember(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    const target = req.params.userId;
    const selfLeave = String(target) === String(req.user._id);
    if (!selfLeave && !isAdmin(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }
    group.members = group.members.filter((m) => String(m.user) !== String(target));
    // If the last admin just left (or was removed), auto-promote the
    // earliest-joined remaining member so the group is never admin-less.
    let promotedId = null;
    if (group.members.length > 0 && !group.members.some((m) => m.role === 'admin')) {
      group.members[0].role = 'admin';
      promotedId = group.members[0].user;
    }
    await group.save();
    if (promotedId) {
      try {
        await Notification.create({
          recipient: promotedId, sender: req.user._id, type: 'system',
          title: `You are now admin of ${group.name}`,
          body: 'All admins left the group, so the longest-standing member was promoted.',
          data: { groupId: group._id },
        });
      } catch {}
    }
    if (req.io) req.io.to(`group:${group._id}`).emit('group:updated', group);
    res.json({ success: true, group });
  } catch (e) { next(e); }
}

async function setAdmin(req, res, next) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Not found' });
    if (!isAdmin(group, req.user._id)) return res.status(403).json({ success: false, message: 'Admins only' });
    const m = group.members.find((x) => String(x.user) === String(req.body.userId));
    if (!m) return res.status(404).json({ success: false, message: 'Member not found' });
    m.role = req.body.role === 'admin' ? 'admin' : 'member';
    await group.save();
    res.json({ success: true, group });
  } catch (e) { next(e); }
}

async function markRead(req, res, next) {
  try {
    const GroupModel = require('../models/Group');
    const Message = require('../models/Message');
    const group = await GroupModel.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!isMember(group, req.user._id)) return res.status(403).json({ success: false, message: 'Not a member' });
    group.unreadCounts.set(String(req.user._id), 0);
    await group.save();
    await Message.updateMany(
      { group: group._id, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function deleteGroup(req, res, next) {
  try {
    const Message = require('../models/Message');
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only group admins can delete the group' });
    }
    await Message.deleteMany({ group: group._id });
    await Group.findByIdAndDelete(group._id);
    if (req.io) req.io.emit('group:deleted', { _id: String(group._id) });
    res.json({ success: true, message: 'Group deleted' });
  } catch (e) { next(e); }
}

module.exports = { listGroups, createGroup, getGroup, renameGroup, updatePhoto, addMembers, removeMember, setAdmin, markRead, deleteGroup };
