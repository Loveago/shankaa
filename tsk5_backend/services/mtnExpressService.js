const prisma = require('../config/db');
const axios = require('axios');
const settingsService = require('./settingsService');

const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

// Paystack charges a 2% fee on all transactions.
// We add this fee on top so the seller receives the full base amount.
const PAYSTACK_FEE_RATE = 0.02;
/** Given a base amount, return the total (including 2% Paystack fee). */
const withPaystackFee = (amount) => parseFloat(amount) * (1 + PAYSTACK_FEE_RATE);

const getPaystackSecret = async () => {
  const fromDb = await settingsService.getSettingValue(settingsService.SETTINGS_KEYS.PAYSTACK_SECRET);
  return fromDb || process.env.PAYSTACK_SECRET_KEY;
};

const generatePaymentRef = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MTNEX-${timestamp}-${random}`;
};

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

  async isEnabled() {
    try {
      const val = await settingsService.getSettingValue(settingsService.SETTINGS_KEYS.MTN_EXPRESS_ENABLED, 'true');
      return val === 'true';
    } catch {
      return true;
    }
  }

  async setEnabled(enabled) {
    await settingsService.upsertSettings({ [settingsService.SETTINGS_KEYS.MTN_EXPRESS_ENABLED]: enabled ? 'true' : 'false' });
    return { enabled };
  }

  async updateConfig({ bundleSize, amount }) {
    const updates = {};
    if (bundleSize) updates[settingsService.SETTINGS_KEYS.MTN_EXPRESS_BUNDLE_SIZE] = bundleSize;
    if (amount !== undefined) updates[settingsService.SETTINGS_KEYS.MTN_EXPRESS_AMOUNT] = String(amount);
    await settingsService.upsertSettings(updates);
    return this.getDefaultConfig();
  }

  // Initialize Paystack payment for MTN Express
  async initializePayment({ phoneNumber, email, userId }) {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('MTN Express is currently disabled by admin');
    }

    const config = await this.getDefaultConfig();
    const paymentRef = generatePaymentRef();

    // Format phone
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '233' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('233')) {
      formattedPhone = '233' + formattedPhone;
    }

    // Determine the correct dashboard path based on user role
    let dashboardPath = '/user';
    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: { role: true }
        });
        if (user?.role) {
          const role = user.role.trim().toLowerCase();
          const rolePaths = {
            'premium': '/premium',
            'super': '/superagent',
            'normal': '/normalagent',
            'other': '/otherdashboard',
            'user': '/user'
          };
          dashboardPath = rolePaths[role] || '/user';
        }
      } catch (e) {
        // fallback to /user
      }
    }

    const secret = await getPaystackSecret();
    // Include the 2% Paystack fee on top so the seller receives the full base amount.
    const amountInPesewas = Math.round(withPaystackFee(config.amount) * 100);

    try {
      const response = await axios({
        method: 'POST',
        url: PAYSTACK_INITIALIZE_URL,
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json'
        },
        data: {
          email: email || `${formattedPhone}@tsk5.com`,
          amount: amountInPesewas,
          currency: 'GHS',
          reference: paymentRef,
          callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}${dashboardPath}?mtnExpress=callback`,
          metadata: {
            type: 'mtn_express',
            phoneNumber: formattedPhone,
            bundleSize: config.bundleSize,
            custom_fields: [
              {
                display_name: "Phone Number",
                variable_name: "phone_number",
                value: formattedPhone
              },
              {
                display_name: "Bundle",
                variable_name: "bundle_size",
                value: config.bundleSize
              }
            ]
          },
          channels: ['mobile_money', 'card']
        },
        timeout: 30000
      });

      if (response.data.status === true) {
        // Create the order in pending status with paymentRef
        const order = await prisma.mtnExpressOrder.create({
          data: {
            phoneNumber: formattedPhone,
            bundleSize: config.bundleSize,
            amount: config.amount,
            paymentRef,
            email: email || null,
            userId: userId || null,
            status: 'pending'
          }
        });

        return {
          success: true,
          paymentUrl: response.data.data.authorization_url,
          paymentRef,
          orderId: order.id
        };
      } else {
        throw new Error(response.data.message || 'Failed to initialize Paystack payment');
      }
    } catch (error) {
      throw new Error(`Payment initialization failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Verify Paystack payment after redirect
  async verifyPayment(reference) {
    const order = await prisma.mtnExpressOrder.findUnique({
      where: { paymentRef: reference }
    });

    if (!order) {
      throw new Error('MTN Express order not found for this payment reference');
    }

    if (order.status !== 'pending') {
      return { verified: true, order };
    }

    const secret = await getPaystackSecret();
    try {
      const response = await axios({
        method: 'GET',
        url: `${PAYSTACK_VERIFY_URL}/${encodeURIComponent(reference)}`,
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.status === true && response.data.data.status === 'success') {
        const updatedOrder = await prisma.mtnExpressOrder.update({
          where: { id: order.id },
          data: { status: 'pending' } // still pending — awaiting admin approval
        });
        return { verified: true, order: updatedOrder };
      } else {
        throw new Error('Payment not verified');
      }
    } catch (error) {
      throw new Error(`Payment verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Check if a payment reference has already been used to create an order
  async checkPaymentRef(reference) {
    const order = await prisma.mtnExpressOrder.findUnique({
      where: { paymentRef: reference }
    });
    return !!order;
  }

  async createOrder(data) {
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
