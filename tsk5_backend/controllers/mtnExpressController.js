// controllers/mtnExpressController.js
const mtnExpressService = require('../services/mtnExpressService');

class MtnExpressController {
  // Initialize Paystack payment for MTN Express (authenticated users)
  async initializePayment(req, res) {
    try {
      const { phoneNumber, email } = req.body;
      const userId = req.user?.id || null;

      if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
      }

      const result = await mtnExpressService.initializePayment({
        phoneNumber, email, userId
      });

      res.status(200).json({
        success: true,
        message: 'Payment initialized',
        paymentUrl: result.paymentUrl,
        paymentRef: result.paymentRef,
        orderId: result.orderId
      });
    } catch (error) {
      const status = error.message.includes('disabled') ? 400 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  // Verify Paystack payment after redirect (authenticated)
  async verifyPayment(req, res) {
    try {
      const { reference } = req.body;
      if (!reference) {
        return res.status(400).json({ success: false, message: 'Payment reference is required' });
      }

      const result = await mtnExpressService.verifyPayment(reference);
      res.status(200).json({
        success: true,
        message: 'Payment verified successfully. Awaiting admin approval.',
        order: result.order
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Check if MTN Express is available/enabled (public)
  async getAvailability(req, res) {
    try {
      const enabled = await mtnExpressService.isEnabled();
      const config = await mtnExpressService.getDefaultConfig();
      res.status(200).json({
        success: true,
        data: { enabled, ...config }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Create a new MTN Express order (public/authenticated) — legacy receipt flow
  async createOrder(req, res) {
    try {
      const { receiptNumber, phoneNumber, bundleSize, amount } = req.body;
      const userId = req.user?.id || null;

      if (!receiptNumber || !phoneNumber) {
        return res.status(400).json({ success: false, message: 'Receipt number and phone number are required' });
      }

      const order = await mtnExpressService.createOrder({
        receiptNumber, phoneNumber, bundleSize, amount, userId
      });

      res.status(201).json({ success: true, data: order, message: 'MTN Express order submitted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get all MTN Express orders (Admin only)
  async getAllOrders(req, res) {
    try {
      const { status } = req.query;
      const normalizedStatus = (status && status !== 'all' && status.trim() !== '') ? status.trim() : null;
      const orders = await mtnExpressService.getAllOrders(normalizedStatus);
      res.status(200).json({ success: true, data: orders || [], message: 'Orders fetched successfully' });
    } catch (error) {
      res.status(500).json({ success: false, data: [], message: error.message });
    }
  }

  // Get pending orders count (Admin only)
  async getPendingCount(req, res) {
    try {
      const count = await mtnExpressService.getPendingCount();
      res.status(200).json({ success: true, data: { count }, message: 'Pending count fetched successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get order by ID (Admin only)
  async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const order = await mtnExpressService.getOrderById(id);
      res.status(200).json({ success: true, data: order, message: 'Order fetched successfully' });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  // Update order status (Admin only)
  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      if (!status) return res.status(400).json({ success: false, message: 'Status is required' });
      const order = await mtnExpressService.updateOrderStatus(id, status, adminNotes);
      res.status(200).json({ success: true, data: order, message: 'Order status updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Delete order (Admin only)
  async deleteOrder(req, res) {
    try {
      const { id } = req.params;
      const result = await mtnExpressService.deleteOrder(id);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get MTN Express config (Admin only)
  async getConfig(req, res) {
    try {
      const config = await mtnExpressService.getDefaultConfig();
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Update MTN Express config (Admin only)
  async updateConfig(req, res) {
    try {
      const { bundleSize, amount } = req.body;
      const config = await mtnExpressService.updateConfig({ bundleSize, amount });
      res.status(200).json({ success: true, data: config, message: 'MTN Express configuration updated' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Toggle MTN Express enabled/disabled (Admin only)
  async toggleEnabled(req, res) {
    try {
      const { enabled } = req.body;
      if (enabled === undefined) return res.status(400).json({ success: false, message: 'enabled field is required' });
      const result = await mtnExpressService.setEnabled(enabled);
      res.status(200).json({ success: true, data: result, message: `MTN Express ${enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new MtnExpressController();
