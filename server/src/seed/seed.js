require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Seeding...');
  await Promise.all([
    User.deleteMany({}), Conversation.deleteMany({}), Group.deleteMany({}),
    Message.deleteMany({}), Notification.deleteMany({}),
  ]);

  const users = await User.create([
    { name: 'Ava Admin', email: 'admin@syncspace.app', password: 'password123', role: 'admin', statusText: 'Running SyncSpace 🚀', isOnline: true },
    { name: 'Liam Dev', email: 'liam@syncspace.app', password: 'password123', statusText: 'Shipping features', isOnline: true },
    { name: 'Mia Design', email: 'mia@syncspace.app', password: 'password123', statusText: 'In Figma 🎨' },
    { name: 'Noah QA', email: 'noah@syncspace.app', password: 'password123', statusText: 'Breaking things (for good)' },
  ]);
  const [admin, liam, mia, noah] = users;

  const dm = await Conversation.create({ participants: [liam._id, mia._id] });
  const m1 = await Message.create({ sender: liam._id, conversation: dm._id, text: 'Hey Mia! Final mockups ready? 👀', readBy: [liam._id] });
  const m2 = await Message.create({ sender: mia._id, conversation: dm._id, text: 'Almost! Uploading to Cloudinary now ✨', readBy: [liam._id, mia._id], replyTo: m1._id });
  dm.lastMessage = m2._id; dm.lastMessageAt = new Date(); await dm.save();

  const group = await Group.create({
    name: 'Product Launch 🚀',
    description: 'Ship v1 of SyncSpace',
    createdBy: admin._id,
    members: [
      { user: admin._id, role: 'admin' },
      { user: liam._id, role: 'admin' },
      { user: mia._id, role: 'member' },
      { user: noah._id, role: 'member' },
    ],
    inviteCode: 'LAUNCH1',
  });
  const g1 = await Message.create({ sender: admin._id, group: group._id, text: `Welcome to #${group.name}! Read the plan and react ✅`, readBy: [admin._id] });
  group.lastMessage = g1._id; await group.save();

  await Notification.create({
    recipient: mia._id, sender: liam._id, type: 'new_message',
    title: 'New message from Liam Dev', body: 'Hey Mia! Final mockups ready?',
    data: { conversationId: dm._id, messageId: m1._id },
  });

  console.log('Seed done. Logins: admin@syncspace.app / liam@syncspace.app / mia@syncspace.app / noah@syncspace.app (password123)');
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
