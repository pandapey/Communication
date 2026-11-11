const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/authController');
const express = require('express');

const router = express.Router();

router.post('/register',
  authLimiter,
  [body('name').notEmpty().withMessage('Name required'), body('email').isEmail(), body('password').isLength({ min: 6 })],
  validate, c.register);

router.post('/login', authLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  validate, c.login);

router.post('/logout', protect, c.logout);
router.get('/me', protect, c.me);
router.post('/forgot-password', authLimiter, [body('email').isEmail()], validate, c.forgotPassword);
router.post('/reset-password/:token', authLimiter, [body('password').isLength({ min: 6 })], validate, c.resetPassword);

module.exports = router;
