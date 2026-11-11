const express = require('express');
const { protect } = require('../middleware/auth');
const c = require('../controllers/conversationController');

const router = express.Router();
router.use(protect);
router.get('/', c.listConversations);
router.post('/dm', c.getOrCreate);
router.post('/:id/read', c.markRead);
router.delete('/:id', c.deleteConversation);

module.exports = router;
