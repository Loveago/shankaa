// routes/complaintRoutes.js
const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimiter = require('../middleware/rateLimiter');

// Ensure uploads directory exists for complaint proof images
const uploadDir = path.join(__dirname, '../uploads/complaints');
fs.mkdirSync(uploadDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueFilename = `complaint-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});
const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed (png, jpg, jpeg, gif, webp)'));
  }
});

// Middleware
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Rate limiters for public complaint endpoints
const complaintCreateLimiter = rateLimiter({ windowMs: 60000, maxRequests: 10 }); // 10 complaints/min per IP
const complaintTrackLimiter = rateLimiter({ windowMs: 60000, maxRequests: 30 });  // 30 track requests/min per IP

// Public routes (for shop customers)
router.post('/', complaintCreateLimiter, complaintController.createComplaint);
router.get('/track/:mobileNumber', complaintTrackLimiter, complaintController.getComplaintsByMobile);

// Protected routes (authenticated users)
router.post('/order-item-status', authMiddleware, complaintController.getComplaintsByOrderItemIds);
// Get all complaints for the logged-in user
router.get('/my', authMiddleware, complaintController.getUserComplaints);

// Specific literal routes MUST come before parameterized routes
router.get('/item/:orderItemId', authMiddleware, complaintController.getComplaintStatusForItem);

// Serve complaint proof images (no auth required for display)
router.get('/image/:filename', complaintController.getProofImage);
// Admin: upload/delete proof image
router.post('/:id/proof-image', authMiddleware, adminMiddleware, proofUpload.single('proofImage'), complaintController.uploadProofImage);
router.delete('/:id/proof-image', authMiddleware, adminMiddleware, complaintController.deleteProofImage);

// Protected routes (Admin only)
router.get('/', authMiddleware, adminMiddleware, complaintController.getAllComplaints);
router.get('/pending/count', authMiddleware, adminMiddleware, complaintController.getPendingCount);
router.get('/:id', authMiddleware, adminMiddleware, complaintController.getComplaintById);
router.put('/:id', authMiddleware, adminMiddleware, complaintController.updateComplaintStatus);
router.post('/:id/refund', authMiddleware, adminMiddleware, complaintController.refundComplaint);
router.delete('/:id', authMiddleware, adminMiddleware, complaintController.deleteComplaint);

module.exports = router;
