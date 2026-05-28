const userApiService = require('../services/userApiService');

// ============================================================
//  KEY MANAGEMENT (requires JWT auth — user logged in on dashboard)
// ============================================================

exports.createApiKey = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Key name is required' });
    }

    const result = await userApiService.createApiKey(req.user.id, name.trim());
    res.status(201).json({
      success: true,
      message: 'API key created. Copy it now — it will only be shown once.',
      data: result
    });
  } catch (error) {
    console.error('Create user API key error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.listApiKeys = async (req, res) => {
  try {
    const keys = await userApiService.listApiKeys(req.user.id);
    res.json({ success: true, data: keys });
  } catch (error) {
    console.error('List user API keys error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.revokeApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    await userApiService.revokeApiKey(parseInt(id), req.user.id);
    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    console.error('Revoke user API key error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.activateApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    await userApiService.activateApiKey(parseInt(id), req.user.id);
    res.json({ success: true, message: 'API key reactivated' });
  } catch (error) {
    console.error('Activate user API key error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    await userApiService.deleteApiKey(parseInt(id), req.user.id);
    res.json({ success: true, message: 'API key deleted permanently' });
  } catch (error) {
    console.error('Delete user API key error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================================
//  EXTERNAL ORDER ENDPOINTS (via x-api-key header — no JWT)
// ============================================================

exports.getProducts = async (req, res) => {
  try {
    const products = await userApiService.getAvailableProducts(req.user.role);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('User API getProducts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { items } = req.body;
    const result = await userApiService.createApiOrder(
      req.user.id,
      items,
      req.apiKeyRecord.id
    );

    // Emit real-time notification to admin
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('new-order', {
          orderId: result.orderId,
          userName: req.user.name,
          itemCount: items.length,
          source: 'api'
        });
      }
    } catch (e) { /* best-effort */ }

    res.status(201).json(result);
  } catch (error) {
    console.error('User API createOrder error:', error);
    const statusCode = error.message.includes('Insufficient') || error.message.includes('not found') || error.message.includes('out of stock')
      ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

exports.getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await userApiService.getOrderStatus(orderId, req.user.id);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('User API getOrderStatus error:', error);
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.getOrderStatuses = async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderIds array is required' });
    }
    if (orderIds.length > 50) {
      return res.status(400).json({ success: false, message: 'Maximum 50 order IDs per request' });
    }

    const orders = await userApiService.getOrderStatuses(orderIds, req.user.id);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('User API getOrderStatuses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWalletBalance = async (req, res) => {
  try {
    const balance = await userApiService.getWalletBalance(req.user.id);
    res.json({ success: true, data: balance });
  } catch (error) {
    console.error('User API getWalletBalance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getNetworkMap = async (req, res) => {
  try {
    const summary = await userApiService.getNetworkMap(req.user.id);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('User API getNetworkMap error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//  WEBHOOK MANAGEMENT (JWT Auth — from dashboard)
// ============================================================

exports.updateWebhookUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { webhookUrl } = req.body;
    const result = await userApiService.updateWebhookUrl(parseInt(id), req.user.id, webhookUrl);
    res.json({ success: true, message: 'Webhook URL updated', data: result });
  } catch (error) {
    console.error('Update webhook URL error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.toggleWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userApiService.toggleWebhook(parseInt(id), req.user.id);
    res.json({ success: true, message: `Webhook ${result.webhookEnabled ? 'enabled' : 'disabled'}`, data: result });
  } catch (error) {
    console.error('Toggle webhook error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.testWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userApiService.testWebhook(parseInt(id), req.user.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};
