const prisma = require('../config/db');

class AfaRegistrationService {
  // Create a new registration
  async createRegistration(data) {
    try {
      const { fullName, phoneNumber, location, occupation, idType, idNumber, userId } = data;

      // Check if phone number already has a pending registration
      const existing = await prisma.afaRegistration.findFirst({
        where: { phoneNumber, status: 'pending' }
      });
      if (existing) {
        throw new Error('A pending registration already exists for this phone number');
      }

      const registration = await prisma.afaRegistration.create({
        data: {
          fullName,
          phoneNumber,
          location,
          occupation: occupation || null,
          idType,
          idNumber,
          status: 'pending',
          userId: userId ? parseInt(userId) : null
        }
      });

      return registration;
    } catch (error) {
      throw new Error(`Failed to create registration: ${error.message}`);
    }
  }

  // Get all registrations (admin) with optional status filter
  async getAllRegistrations(status = null) {
    try {
      const whereClause = (status && status !== 'all' && status.trim() !== '')
        ? { status: status.trim() }
        : {};

      const registrations = await prisma.afaRegistration.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      return registrations;
    } catch (error) {
      throw new Error(`Failed to fetch registrations: ${error.message}`);
    }
  }

  // Get pending registrations count
  async getPendingCount() {
    try {
      const count = await prisma.afaRegistration.count({
        where: { status: 'pending' }
      });
      return count;
    } catch (error) {
      throw new Error(`Failed to count pending registrations: ${error.message}`);
    }
  }

  // Get single registration by ID
  async getRegistrationById(id) {
    try {
      const registration = await prisma.afaRegistration.findUnique({
        where: { id: parseInt(id) }
      });
      if (!registration) {
        throw new Error('Registration not found');
      }
      return registration;
    } catch (error) {
      throw new Error(`Failed to fetch registration: ${error.message}`);
    }
  }

  // Update registration status (approve/reject) with admin notes
  async updateRegistrationStatus(id, status, adminNotes = '') {
    try {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status. Must be pending, approved, or rejected');
      }

      const registration = await prisma.afaRegistration.update({
        where: { id: parseInt(id) },
        data: {
          status,
          adminNotes: adminNotes || null
        }
      });

      return registration;
    } catch (error) {
      throw new Error(`Failed to update registration: ${error.message}`);
    }
  }

  // Delete a registration
  async deleteRegistration(id) {
    try {
      await prisma.afaRegistration.delete({
        where: { id: parseInt(id) }
      });
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete registration: ${error.message}`);
    }
  }

  // Create registration with payment reference
  async createRegistrationWithPayment(data, paymentRef) {
    try {
      const { fullName, phoneNumber, location, occupation, idType, idNumber, userId } = data;

      const existing = await prisma.afaRegistration.findFirst({
        where: { phoneNumber, status: 'pending' }
      });
      if (existing) {
        throw new Error('A pending registration already exists for this phone number');
      }

      const registration = await prisma.afaRegistration.create({
        data: {
          fullName,
          phoneNumber,
          location,
          occupation: occupation || null,
          idType,
          idNumber,
          status: 'pending',
          paymentRef,
          paymentStatus: 'unpaid',
          userId: userId ? parseInt(userId) : null
        }
      });

      return registration;
    } catch (error) {
      throw new Error(`Failed to create registration: ${error.message}`);
    }
  }

  // Mark registration as paid
  async markAsPaid(paymentRef) {
    try {
      const registration = await prisma.afaRegistration.updateMany({
        where: { paymentRef, paymentStatus: 'unpaid' },
        data: { paymentStatus: 'paid' }
      });
      return registration;
    } catch (error) {
      throw new Error(`Failed to mark registration as paid: ${error.message}`);
    }
  }
}

module.exports = new AfaRegistrationService();
