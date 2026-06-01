// controllers/afaRegistrationController.js
const afaRegistrationService = require('../services/afaRegistrationService');
const paymentService = require('../services/paymentService');

class AfaRegistrationController {
  // Create a new registration (public/authenticated users)
  async createRegistration(req, res) {
    try {
      const { fullName, phoneNumber, location, occupation, idType, idNumber } = req.body;

      // Validation
      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ success: false, message: 'Full name is required' });
      }
      if (!phoneNumber || !phoneNumber.trim()) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
      }
      if (!location || !location.trim()) {
        return res.status(400).json({ success: false, message: 'Town/Location is required' });
      }
      if (!idType || !['NATIONAL_ID', 'VOTER_ID'].includes(idType)) {
        return res.status(400).json({ success: false, message: 'ID type must be NATIONAL_ID or VOTER_ID' });
      }
      if (!idNumber || !idNumber.trim()) {
        return res.status(400).json({ success: false, message: 'ID number is required' });
      }

      // Optionally attach userId if user is logged in
      const userId = req.user?.id || null;

      const registration = await afaRegistrationService.createRegistration({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        location: location.trim(),
        occupation: occupation?.trim() || null,
        idType,
        idNumber: idNumber.trim(),
        userId
      });

      return res.status(201).json({
        success: true,
        message: 'Registration submitted successfully. Pending admin review.',
        registration
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get all registrations (admin only)
  async getAllRegistrations(req, res) {
    try {
      const { status } = req.query;
      const registrations = await afaRegistrationService.getAllRegistrations(status);
      return res.json({ success: true, registrations });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get pending registrations count (admin only)
  async getPendingCount(req, res) {
    try {
      const count = await afaRegistrationService.getPendingCount();
      return res.json({ success: true, count });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get single registration by ID (admin only)
  async getRegistrationById(req, res) {
    try {
      const registration = await afaRegistrationService.getRegistrationById(req.params.id);
      return res.json({ success: true, registration });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Update registration status (admin only)
  async updateRegistrationStatus(req, res) {
    try {
      const { status, adminNotes } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required' });
      }

      const registration = await afaRegistrationService.updateRegistrationStatus(
        req.params.id,
        status,
        adminNotes
      );

      return res.json({
        success: true,
        message: `Registration ${status} successfully`,
        registration
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Delete registration (admin only)
  async deleteRegistration(req, res) {
    try {
      await afaRegistrationService.deleteRegistration(req.params.id);
      return res.json({ success: true, message: 'Registration deleted successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Initialize payment for AFA registration (10 GHC)
  async initializeAfaPayment(req, res) {
    try {
      const { fullName, phoneNumber, location, occupation, idType, idNumber } = req.body;
      const userId = req.user?.id || null;

      // Validate form data
      if (!fullName || !phoneNumber || !location || !idType || !idNumber) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled' });
      }

      const AFA_FEE = 10; // 10 GHC

      // Build callback URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const callbackUrl = `${frontendUrl}/dashboard?afaPayment=callback`;

      // Initialize Paystack payment
      const result = await paymentService.initializePayment(
        `${phoneNumber}@afa.tsk5.com`,
        phoneNumber,
        AFA_FEE,
        null,
        'AFA Registration Fee',
        callbackUrl
      );

      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error || 'Payment initialization failed' });
      }

      // Create registration with payment reference
      await afaRegistrationService.createRegistrationWithPayment(
        { fullName: fullName.trim(), phoneNumber: phoneNumber.trim(), location: location.trim(), occupation: occupation?.trim() || null, idType, idNumber: idNumber.trim(), userId },
        result.externalRef
      );

      return res.json({
        success: true,
        message: 'Payment initialized',
        paymentUrl: result.paymentUrl,
        reference: result.reference,
        externalRef: result.externalRef
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Verify AFA registration payment via Paystack
  async verifyAfaPayment(req, res) {
    try {
      const { reference } = req.body;
      if (!reference) {
        return res.status(400).json({ success: false, message: 'Reference is required' });
      }

      const result = await paymentService.verifyPayment(reference);

      if (result.success) {
        await afaRegistrationService.markAsPaid(reference);
        return res.json({ success: true, message: 'Payment verified and registration submitted' });
      }

      return res.json({ success: false, status: result.status, message: result.message || 'Payment not yet confirmed' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new AfaRegistrationController();
