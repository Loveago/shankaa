// controllers/mtnExpressController.js
const mtnExpressService = require('../services/mtnExpressService');

class MtnExpressController {
  // Create a new MTN Express order (public/authenticated)
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
}

module.exports = new MtnExpressController();
