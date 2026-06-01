// routes/mtnExpressRoutes.js
const express = require('express');
const router = express.Router();
const mtnExpressController = require('../controllers/mtnExpressController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Public/authenticated route - create a new order
router.post('/', authMiddleware, mtnExpressController.createOrder);

// Protected routes (Admin only)
router.get('/', authMiddleware, adminMiddleware, mtnExpressController.getAllOrders);
router.get('/config', authMiddleware, adminMiddleware, mtnExpressController.getConfig);
router.put('/config', authMiddleware, adminMiddleware, mtnExpressController.updateConfig);
router.get('/pending/count', authMiddleware, adminMiddleware, mtnExpressController.getPendingCount);
router.get('/:id', authMiddleware, adminMiddleware, mtnExpressController.getOrderById);
router.put('/:id', authMiddleware, adminMiddleware, mtnExpressController.updateOrderStatus);
router.delete('/:id', authMiddleware, adminMiddleware, mtnExpressController.deleteOrder);

module.exports = router;
