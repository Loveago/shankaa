// routes/complaintRoutes.js
const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');

// Middleware
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Public routes (for shop customers)
router.post('/', complaintController.createComplaint);
router.get('/track/:mobileNumber', complaintController.getComplaintsByMobile);

// Protected routes (authenticated users)
router.post('/order-item-status', authMiddleware, complaintController.getComplaintsByOrderItemIds);

// =====================================================
// IMPORTANT: Specific literal routes MUST come before
// parameterized routes (/:id) to avoid Express matching issues.
// =====================================================

// Get complaint status for a specific order item (auth required)
router.get('/item/:orderItemId', authMiddleware, complaintController.getComplaintStatusForItem);

// Protected routes (Admin only)
router.get('/', authMiddleware, adminMiddleware, complaintController.getAllComplaints);
router.get('/pending/count', authMiddleware, adminMiddleware, complaintController.getPendingCount);
router.get('/:id', authMiddleware, adminMiddleware, complaintController.getComplaintById);
router.put('/:id', authMiddleware, adminMiddleware, complaintController.updateComplaintStatus);
router.post('/:id/refund', authMiddleware, adminMiddleware, complaintController.refundComplaint);
router.delete('/:id', authMiddleware, adminMiddleware, complaintController.deleteComplaint);

module.exports = router;
