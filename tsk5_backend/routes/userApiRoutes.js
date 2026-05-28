const express = require('express');
const router = express.Router();
const userApiController = require('../controllers/userApiController');
const userApiAuth = require('../middleware/userApiAuth');
const authMiddleware = require('../middleware/authMiddleware');

// ============================================================
//  USER KEY MANAGEMENT (JWT Auth — from dashboard)
// ============================================================
router.post('/keys', authMiddleware, userApiController.createApiKey);
router.get('/keys', authMiddleware, userApiController.listApiKeys);
router.patch('/keys/:id/revoke', authMiddleware, userApiController.revokeApiKey);
router.patch('/keys/:id/activate', authMiddleware, userApiController.activateApiKey);
router.delete('/keys/:id', authMiddleware, userApiController.deleteApiKey);

// Webhook management (JWT Auth)
router.patch('/keys/:id/webhook', authMiddleware, userApiController.updateWebhookUrl);
router.post('/keys/:id/webhook/toggle', authMiddleware, userApiController.toggleWebhook);
router.post('/keys/:id/webhook/test', authMiddleware, userApiController.testWebhook);

// ============================================================
//  EXTERNAL ORDER ENDPOINTS (x-api-key Auth — no JWT)
//  These endpoints use the user's API key for auth and
//  deduct from their wallet balance.
// ============================================================

// GET /api/user-api/products — List available products
router.get('/products', userApiAuth, userApiController.getProducts);

// POST /api/user-api/orders — Place an order (deducts wallet)
router.post('/orders', userApiAuth, userApiController.createOrder);

// GET /api/user-api/orders/:orderId — Check order status
router.get('/orders/:orderId', userApiAuth, userApiController.getOrderStatus);

// POST /api/user-api/orders/status — Check multiple order statuses
router.post('/orders/status', userApiAuth, userApiController.getOrderStatuses);

// GET /api/user-api/wallet — Check wallet balance
router.get('/wallet', userApiAuth, userApiController.getWalletBalance);

// GET /api/user-api/network-map — Get network usage summary
router.get('/network-map', userApiAuth, userApiController.getNetworkMap);

module.exports = router;
