// controllers/afaRegistrationController.js
const afaRegistrationService = require('../services/afaRegistrationService');

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
}

module.exports = new AfaRegistrationController();
