const express = require('express');
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// Strict rate limit for payment initialization (prevent brute-force/abuse)
const paymentInitLimiter = rateLimiter({ windowMs: 60000, maxRequests: 20 });
// Strict rate limit for payment verification (prevent replay attacks)
const paymentVerifyLimiter = rateLimiter({ windowMs: 60000, maxRequests: 30 });

// Public routes for shop payments (Paystack)

// Initialize Paystack payment
router.post('/initialize', paymentInitLimiter, paymentController.initializePayment);

// Paystack webhook callback (must stay public - called by Paystack servers)
router.post('/webhook', paymentController.handleWebhook);

// Verify payment status (called after redirect from Paystack)
router.post('/verify', paymentVerifyLimiter, paymentController.verifyPaymentStatus);

// Check payment status
router.get('/status/:externalRef', paymentController.checkStatus);

// Admin-only routes - REQUIRE AUTHENTICATION
router.get('/transactions', authMiddleware, adminMiddleware, paymentController.getAllTransactions);
router.get('/unpaid-orders', authMiddleware, adminMiddleware, paymentController.getUnpaidOrders);
router.get('/unpaid-orders/stats', authMiddleware, adminMiddleware, paymentController.getUnpaidOrderStats);
router.post('/unpaid-orders/:id/reconcile', authMiddleware, adminMiddleware, paymentController.reconcileSingleUnpaidOrder);
router.post('/unpaid-orders/reconcile-all', authMiddleware, adminMiddleware, paymentController.reconcileAllUnpaidOrders);
router.get('/orphaned', authMiddleware, adminMiddleware, paymentController.getOrphanedPayments);
router.post('/reconcile', authMiddleware, adminMiddleware, paymentController.reconcilePayments);

module.exports = router;
