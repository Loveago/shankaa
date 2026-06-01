// routes/afaRegistrationRoutes.js
const express = require('express');
const router = express.Router();
const afaRegistrationController = require('../controllers/afaRegistrationController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Public route - submit a registration (no auth required)
router.post('/', afaRegistrationController.createRegistration);

// Authenticated route - submit a registration as logged-in user
router.post('/auth', authMiddleware, afaRegistrationController.createRegistration);

// Admin routes
router.get('/', authMiddleware, adminMiddleware, afaRegistrationController.getAllRegistrations);
router.get('/pending/count', authMiddleware, adminMiddleware, afaRegistrationController.getPendingCount);
router.get('/:id', authMiddleware, adminMiddleware, afaRegistrationController.getRegistrationById);
router.put('/:id', authMiddleware, adminMiddleware, afaRegistrationController.updateRegistrationStatus);
router.delete('/:id', authMiddleware, adminMiddleware, afaRegistrationController.deleteRegistration);

module.exports = router;
