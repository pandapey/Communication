const crypto = require('crypto');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

function setCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ success: false, message: 'Email already in use' });
    const user = await User.create({ name, email: email.toLowerCase(), password });
    const token = signToken(user._id);
    setCookie(res, token);
    res.status(201).json({ success: true, token, user: user.toSafeJSON() });
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();
    const token = signToken(user._id);
    setCookie(res, token);
    res.json({ success: true, token, user: user.toSafeJSON() });
  } catch (e) { next(e); }
}

async function logout(req, res, next) {
  try {
    if (req.user) {
      req.user.isOnline = false;
      req.user.lastSeen = new Date();
      await req.user.save();
    }
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out' });
  } catch (e) { next(e); }
}

async function me(req, res) {
  res.json({ success: true, user: req.user.toSafeJSON() });
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ success: true, message: 'If that email exists, a reset link was sent' });
    const raw = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });
    const url = `${process.env.CLIENT_URL}/reset-password/${raw}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your SyncSpace password',
      html: `<p>Hello ${user.name},</p><p>Reset here: <a href="${url}">${url}</a> (expires in 1h)</p>`,
    });
    res.json({ success: true, message: 'Reset link sent', debugToken: process.env.NODE_ENV === 'production' ? undefined : raw });
  } catch (e) { next(e); }
}

async function resetPassword(req, res, next) {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+password');
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.json({ success: true, message: 'Password reset. Please login.' });
  } catch (e) { next(e); }
}

module.exports = { register, login, logout, me, forgotPassword, resetPassword };
