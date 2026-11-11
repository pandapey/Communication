const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const g = require('../controllers/groupController');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(protect);

router.get('/', g.listGroups);
router.post('/', [body('name').trim().notEmpty().withMessage('Group name required').isLength({ max: 80 })], validate, g.createGroup);
router.get('/:id', g.getGroup);
router.put('/:id', g.renameGroup);
router.delete('/:id', g.deleteGroup);
router.post('/:id/read', g.markRead);
router.post('/:id/photo', upload.single('photo'), g.updatePhoto);
router.post('/:id/members', g.addMembers);
router.delete('/:id/members/:userId', g.removeMember);
router.put('/:id/admin', g.setAdmin);

module.exports = router;
