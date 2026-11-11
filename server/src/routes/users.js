const express = require('express');
const { protect } = require('../middleware/auth');
const u = require('../controllers/userController');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(protect);

router.get('/search', u.searchUsers);
router.get('/active', u.activeUsers);
router.get('/me', u.getProfile);
router.get('/:id', u.getProfile);
router.put('/me', u.updateProfile);
router.post('/avatar', upload.single('avatar'), u.uploadAvatar);
router.post('/:id/block', u.blockUser);
router.delete('/:id/block', u.unblockUser);

module.exports = router;
