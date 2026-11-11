const express = require('express');
const { protect } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const m = require('../controllers/messageController');

const router = express.Router();
router.use(protect);

router.get('/', m.listMessages);
router.post('/', messageLimiter, upload.array('files', 5), m.sendMessage);
router.put('/:id', m.editMessage);
router.delete('/:id', m.deleteMessage);
router.post('/:id/reaction', m.toggleReaction);

module.exports = router;
