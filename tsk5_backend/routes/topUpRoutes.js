const express = require('express');
const router = express.Router();
const TopUpController = require('../controllers/topUpController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

// Rate limiters for topup operations
const topupInitLimiter = rateLimiter({ windowMs: 60000, maxRequests: 10 });  // 10 topup initializations/min
const smsVerifyLimiter = rateLimiter({ windowMs: 60000, maxRequests: 5 });   // 5 SMS verifications/min
const webhookLimiter = rateLimiter({ windowMs: 60000, maxRequests: 60 });    // Webhooks from Paystack

// Initialize Paystack payment for wallet top-up (requires auth - user must be logged in)
router.post('/topup/initialize', authMiddleware, topupInitLimiter, TopUpController.initializeTopup);

// Verify top-up using Transaction ID (SMS verification) (requires auth)
router.post('/verify-sms', authMiddleware, smsVerifyLimiter, TopUpController.verifyTransactionId);

// Verify Paystack payment and credit wallet (requires auth)
router.post('/topup/verify', authMiddleware, topupInitLimiter, TopUpController.verifyTopup);

// Paystack webhook for top-ups (must stay public - called by Paystack servers)
router.post('/topup/webhook', webhookLimiter, TopUpController.handleWebhook);

// Get all top-ups (admin only)
router.get('/topups', authMiddleware, adminMiddleware, TopUpController.getTopUps);

// Get user's top-up history (requires auth)
router.get('/topups/user/:userId', authMiddleware, TopUpController.getUserTopups);

// Delete a top-up record (admin only)
router.delete('/topups/:id', authMiddleware, adminMiddleware, TopUpController.deleteTopup);

module.exports = router;
