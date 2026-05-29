const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');
const settingsController = require('../controllers/settingsController');

// Admin-only
router.get('/', auth, isAdmin, settingsController.getSettings);
router.put('/', auth, isAdmin, settingsController.updateSettings);

// Public (non-sensitive)
router.get('/public', settingsController.getPublicSettings);

module.exports = router;
