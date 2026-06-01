const prisma = require('../config/db');

const settingsService = require('./settingsService');

class MtnExpressService {
  async getDefaultConfig() {
    try {
      const [bundleSize, amount] = await Promise.all([
        settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MTN_EXPRESS_BUNDLE_SIZE, '214GB'),
        settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MTN_EXPRESS_AMOUNT, '300')
      ]);
      return { bundleSize, amount: parseFloat(amount) || 300 };
    } catch (error) {
      return { bundleSize: '214GB', amount: 300 };
    }
  }

  async updateConfig({ bundleSize, amount }) {
    const updates = {};
    if (bundleSize) updates[settingsService.SETTINGS_KEYS.MTN_EXPRESS_BUNDLE_SIZE] = bundleSize;
    if (amount !== undefined) updates[settingsService.SETTINGS_KEYS.MTN_EXPRESS_AMOUNT] = String(amount);
    await settingsService.upsertSettings(updates);
    return this.getDefaultConfig();
  }

  async createOrder(data) {
    try {
      const config = await this.getDefaultConfig();
      const { receiptNumber, phoneNumber, bundleSize, amount, userId } = data;
      if (!receiptNumber || !phoneNumber) {
        throw new Error('Receipt number and phone number are required');
      }
      const order = await prisma.mtnExpressOrder.create({
        data: {
          receiptNumber,
          phoneNumber,
          bundleSize: bundleSize || config.bundleSize,
          amount: amount || config.amount,
          userId: userId || null,
          status: 'pending'
        }
      });
      return order;
    } catch (error) {
      throw new Error(`Failed to create MTN Express order: ${error.message}`);
    }
  }

  async getAllOrders(status = null) {
    try {
      const whereClause = (status && status !== 'all' && status.trim() !== '')
        ? { status: status.trim() }
        : {};
      const orders = await prisma.mtnExpressOrder.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });
      return orders;
    } catch (error) {
      throw new Error(`Failed to fetch MTN Express orders: ${error.message}`);
    }
  }

  async getPendingCount() {
    try {
      const count = await prisma.mtnExpressOrder.count({
        where: { status: 'pending' }
      });
      return count;
    } catch (error) {
      throw new Error(`Failed to get pending count: ${error.message}`);
    }
  }

  async getOrderById(id) {
    try {
      const order = await prisma.mtnExpressOrder.findUnique({
        where: { id: parseInt(id) }
      });
      if (!order) throw new Error('MTN Express order not found');
      return order;
    } catch (error) {
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
  }

  async updateOrderStatus(id, status, adminNotes = '') {
    try {
      const updateData = { status };
      if (adminNotes) updateData.adminNotes = adminNotes;
      const order = await prisma.mtnExpressOrder.update({
        where: { id: parseInt(id) },
        data: updateData
      });
      return order;
    } catch (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }

  async deleteOrder(id) {
    try {
      await prisma.mtnExpressOrder.delete({ where: { id: parseInt(id) } });
      return { message: 'MTN Express order deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete order: ${error.message}`);
    }
  }
}

module.exports = new MtnExpressService();
