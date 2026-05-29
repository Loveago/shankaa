const express = require('express');
const { loginUser, logoutUser, signupUser } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const referralCodeService = require('../services/referralCodeService');

const router = express.Router();

router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/signup', signupUser);

// Admin routes for referral codes
router.post('/referral-codes/create', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { maxUses, expiresAt } = req.body;
    const code = await referralCodeService.createReferralCode(req.user.id, maxUses, expiresAt ? new Date(expiresAt) : null);
    res.status(201).json({ success: true, code });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/referral-codes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await referralCodeService.getAllReferralCodes(parseInt(page), parseInt(limit));
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/referral-codes/:codeId/deactivate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const code = await referralCodeService.deactivateReferralCode(parseInt(req.params.codeId));
    res.json({ success: true, code });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
