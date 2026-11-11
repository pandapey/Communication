const express = require('express');
const { protect } = require('../middleware/auth');
const n = require('../controllers/notificationController');

const router = express.Router();
router.use(protect);
router.get('/', n.list);
// static route BEFORE param route so /read-all is never mistaken for /:id
router.put('/read-all', n.markAllRead);
router.post('/read-all', n.markAllRead); // alias: older client used POST
router.put('/:id/read', n.markRead);
router.post('/:id/read', n.markRead); // alias for robustness

module.exports = router;
