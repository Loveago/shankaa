const express = require('express');
const shopController = require('../controllers/shopController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// Rate limit public shop endpoints
const trackLimiter = rateLimiter({ windowMs: 60000, maxRequests: 30 }); // 30 track requests/min
const productLimiter = rateLimiter({ windowMs: 60000, maxRequests: 60 }); // 60 product fetches/min

// Public routes
router.get('/products', productLimiter, shopController.getShopProducts);

// REMOVED: Direct order creation endpoint (POST /order)
// Orders are now ONLY created after verified Paystack payment via:
// - Payment webhook (POST /api/payment/webhook)
// - Payment verify (POST /api/payment/verify)
// This prevents free orders without payment.

// Track orders by mobile number (public - customers need this)
router.get('/track', trackLimiter, shopController.trackOrders);

// Get all shop orders (admin only)
router.get('/orders', authMiddleware, adminMiddleware, shopController.getAllShopOrders);

module.exports = router;
