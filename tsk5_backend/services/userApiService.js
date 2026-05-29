const prisma = require('../config/db');
const { resolvePrice } = require('../utils/priceRouter');
const { generateOrderNumber } = require('../utils/orderNumberGenerator');
const crypto = require('crypto');
const axios = require('axios');
const { createTransaction } = require('./transactionService');
const { fireOrderCreated } = require('./userApiWebhook');

// ============================================================
//  KEY MANAGEMENT
// ============================================================

/**
 * Generate a secure user-level API key.
 * Prefix "usk_" = User Secret Key for easy identification.
 */
const generateUserApiKey = () => {
  return 'usk_' + crypto.randomBytes(32).toString('hex');
};

/**
 * Create a new API key for a user.
 */
const createApiKey = async (userId, name) => {
  const existingCount = await prisma.userApiKey.count({ where: { userId } });
  if (existingCount >= 10) {
    throw new Error('Maximum of 10 API keys allowed per account.');
  }

  const apiKey = generateUserApiKey();

  const record = await prisma.userApiKey.create({
    data: { userId, name, apiKey }
  });

  return {
    id: record.id,
    name: record.name,
    apiKey: record.apiKey, // shown only on creation
    createdAt: record.createdAt
  };
};

/**
 * List all API keys for a user (mask actual key for security).
 */
const listApiKeys = async (userId) => {
  const keys = await prisma.userApiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return keys.map(k => ({
    id: k.id,
    name: k.name,
    apiKeyPreview: k.apiKey.substring(0, 12) + '...',
    isActive: k.isActive,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    totalOrders: k.totalOrders,
    webhookUrl: k.webhookUrl,
    webhookEnabled: k.webhookEnabled
  }));
};

/**
 * Revoke an API key (set inactive).
 */
const revokeApiKey = async (keyId, userId) => {
  const key = await prisma.userApiKey.findFirst({ where: { id: keyId, userId } });
  if (!key) throw new Error('API key not found.');

  return await prisma.userApiKey.update({
    where: { id: keyId },
    data: { isActive: false }
  });
};

/**
 * Reactivate a previously revoked key.
 */
const activateApiKey = async (keyId, userId) => {
  const key = await prisma.userApiKey.findFirst({ where: { id: keyId, userId } });
  if (!key) throw new Error('API key not found.');

  return await prisma.userApiKey.update({
    where: { id: keyId },
    data: { isActive: true }
  });
};

/**
 * Permanently delete an API key.
 */
const deleteApiKey = async (keyId, userId) => {
  const key = await prisma.userApiKey.findFirst({ where: { id: keyId, userId } });
  if (!key) throw new Error('API key not found.');

  return await prisma.userApiKey.delete({
    where: { id: keyId }
  });
};

// ============================================================
//  WEBHOOK MANAGEMENT
// ============================================================

/**
 * Update the webhook URL for an API key.
 */
const updateWebhookUrl = async (keyId, userId, webhookUrl) => {
  const key = await prisma.userApiKey.findFirst({ where: { id: keyId, userId } });
  if (!key) throw new Error('API key not found.');

  // Validate URL if provided (not clearing it)
  if (webhookUrl && webhookUrl.trim().length > 0) {
    try {
      new URL(webhookUrl.trim());
    } catch {
      throw new Error('Invalid webhook URL. Please provide a valid HTTPS URL.');
    }
    if (!webhookUrl.trim().startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS for security.');
    }
  }

  return await prisma.userApiKey.update({
    where: { id: keyId },
    data: {
      webhookUrl: webhookUrl && webhookUrl.trim().length > 0 ? webhookUrl.trim() : null,
      webhookEnabled: webhookUrl && webhookUrl.trim().length > 0 ? true : false
    },
    select: {
      id: true,
      name: true,
      webhookUrl: true,
      webhookEnabled: true
    }
  });
};

/**
 * Toggle webhook enabled/disabled for an API key.
 */
const toggleWebhook = async (keyId, userId) => {
  const key = await prisma.userApiKey.findFirst({ where: { id: keyId, userId } });
  if (!key) throw new Error('API key not found.');
  if (!key.webhookUrl) throw new Error('Set a webhook URL before enabling webhooks.');

  return await prisma.userApiKey.update({
    where: { id: keyId },
    data: { webhookEnabled: !key.webhookEnabled },
    select: {
      id: true,
      name: true,
      webhookUrl: true,
      webhookEnabled: true
    }
  });
};

/**
 * Test a webhook by sending a test payload.
 */
const testWebhook = async (keyId, userId) => {
  const key = await prisma.userApiKey.findFirst({ where: { id: keyId, userId } });
  if (!key) throw new Error('API key not found.');
  if (!key.webhookUrl) throw new Error('No webhook URL configured for this key.');

  const { deliverWebhook } = require('./userApiWebhook');
  const testPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from your API key.',
      apiKeyName: key.name,
      webhookUrl: key.webhookUrl
    }
  };

  const delivered = await deliverWebhook(key.webhookUrl, testPayload, 1);
  if (!delivered) throw new Error('Webhook test failed. Check your endpoint and try again.');
  return { success: true, message: 'Webhook test delivered successfully.' };
};

// ============================================================
//  ORDER ENDPOINTS (wallet-deducting)
// ============================================================

/**
 * Get available products for a user's API integration.
 */
const getAvailableProducts = async (role = null) => {
  const products = await prisma.product.findMany({
    where: { showForAgents: true },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      promoPrice: true,
      usePromoPrice: true,
      stock: true,
      rolePrices: { select: { role: true, price: true } },
    },
    orderBy: { name: 'asc' }
  });

  return products.map(p => {
    // Network mapping for documentation
    let network = 'other';
    const upper = (p.name || '').toUpperCase();
    if (upper.startsWith('MTN')) network = 'mtn';
    else if (upper.startsWith('TELECEL')) network = 'telecel';
    else if (upper.startsWith('AIRTEL')) network = 'airteltigo';

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: resolvePrice(p, role),
      stock: p.stock,
      network
    };
  });
};

/**
 * Place an order via user API key.
 * Deducts from the user's wallet balance, creates the order,
 * and returns the result.
 */
const createApiOrder = async (userId, items, apiKeyId) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items array is required and must not be empty.');
  }

  // Validate items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const hasProductId = item.productId !== undefined && item.productId !== null && String(item.productId).trim() !== '';
    const hasNetworkAndBundle = item.network && (item.bundleAmount !== undefined || item.productDescription);
    if (!hasProductId && !hasNetworkAndBundle) {
      throw new Error(`Item ${i}: provide productId, or provide network with bundleAmount/productDescription`);
    }
    if (!item.mobileNumber) throw new Error(`Item ${i}: mobileNumber is required`);
    if (!item.quantity || parseInt(item.quantity) < 1) throw new Error(`Item ${i}: invalid quantity`);
  }

  return await prisma.$transaction(async (tx) => {
    // Fetch all products with role prices
    const productIds = items
      .map(i => parseInt(i.productId))
      .filter(id => Number.isInteger(id) && id > 0);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      include: { rolePrices: { select: { role: true, price: true } } },
    });
    const productMap = {};
    for (const p of products) productMap[p.id] = p;

    // Look up the user's role for price resolution
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, isSuspended: true, loanBalance: true },
    });
    if (!user) throw new Error('User not found');
    if (user.isSuspended) throw new Error('Account is suspended');
    const userRole = user.role;

    // Validate products and calculate total
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const quantity = parseInt(item.quantity) || 1;
      let product = null;

      if (item.productId !== undefined && item.productId !== null && String(item.productId).trim() !== '') {
        const parsedProductId = parseInt(item.productId);
        product = productMap[parsedProductId];
        if (!product) throw new Error(`Product ID ${item.productId} not found`);
      } else {
        const networkUpper = String(item.network || '').trim().toUpperCase();
        const bundleValue = item.bundleAmount !== undefined && item.bundleAmount !== null
          ? String(item.bundleAmount).trim()
          : null;
        const normalizedBundle = bundleValue && !Number.isNaN(parseFloat(bundleValue))
          ? String(parseFloat(bundleValue))
          : null;
        const requestedDescription = item.productDescription
          ? String(item.productDescription).trim().toUpperCase()
          : (normalizedBundle ? `${normalizedBundle.toUpperCase()}GB` : null);

        if (!networkUpper || !requestedDescription) {
          throw new Error('When productId is omitted, network and bundleAmount/productDescription are required');
        }

        const roleUpper = String(userRole || '').toUpperCase();
        const productName = roleUpper === 'USER'
          ? networkUpper
          : `${networkUpper} - ${roleUpper}`;

        product = await tx.product.findFirst({
          where: {
            name: productName,
            description: requestedDescription,
            showForAgents: true,
          },
          include: { rolePrices: { select: { role: true, price: true } } },
        });

        if (!product) {
          throw new Error(`No product found for ${productName} ${requestedDescription}`);
        }
      }

      if (item.network) {
        const expectedNetwork = String(item.network).trim().toUpperCase();
        if (!String(product.name || '').toUpperCase().startsWith(expectedNetwork)) {
          throw new Error(
            `Item network mismatch: requested ${expectedNetwork}, but product ${product.id} is ${product.name}`
          );
        }
      }

      if (item.productName) {
        const expectedName = String(item.productName).trim().toUpperCase();
        if (String(product.name || '').toUpperCase() !== expectedName) {
          throw new Error(
            `Item productName mismatch: requested "${item.productName}", but product ${product.id} is "${product.name}"`
          );
        }
      }

      if (item.productDescription) {
        const expectedDescription = String(item.productDescription).trim().toUpperCase();
        if (String(product.description || '').toUpperCase() !== expectedDescription) {
          throw new Error(
            `Item description mismatch: requested "${item.productDescription}", but product ${product.id} is "${product.description || ''}"`
          );
        }
      }

      if (item.bundleAmount !== undefined && item.bundleAmount !== null && String(item.bundleAmount).trim() !== '') {
        const requestedBundle = parseFloat(String(item.bundleAmount).trim());
        const productBundle = parseFloat(String(product.description || '').replace(/[^0-9.]/g, ''));
        if (!Number.isNaN(requestedBundle) && !Number.isNaN(productBundle) && requestedBundle !== productBundle) {
          throw new Error(
            `Item bundle mismatch: requested ${requestedBundle}GB, but product ${product.id} is ${productBundle}GB`
          );
        }
      }

      if (product.stock < quantity) throw new Error(`Product "${product.name}" is out of stock`);

      const effectivePrice = resolvePrice(product, userRole);
      totalPrice += effectivePrice * quantity;

      orderItems.push({
        productId: product.id,
        quantity,
        mobileNumber: item.mobileNumber,
        status: 'Pending',
        productName: product.name,
        productPrice: effectivePrice,
        productDescription: product.description
      });
    }

    // Check balance (use the already-fetched user)
    const balance = Math.abs(user.loanBalance || 0);
    if (balance < totalPrice) {
      throw new Error(
        `Insufficient wallet balance. Required: GHS ${totalPrice.toFixed(2)}, Available: GHS ${balance.toFixed(2)}`
      );
    }

    // Create the order with items — linked to the API key for webhook support
    const orderNumber = generateOrderNumber();
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId,
        userApiKeyId: apiKeyId,
        mobileNumber: items[0]?.mobileNumber || null,
        items: { create: orderItems }
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, description: true, price: true }
            }
          }
        }
      }
    });

    // Deduct from wallet and record transaction
    await createTransaction(
      userId,
      -totalPrice,
      'ORDER',
      `API Order ${orderNumber} placed via "${items[0]?.productName || 'API'}" — ${items.length} item(s)`,
      `order:${order.id}`,
      tx
    );

    // Increment key usage counter
    await tx.userApiKey.update({
      where: { id: apiKeyId },
      data: { totalOrders: { increment: 1 } }
    });

    // Decrement product stock
    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      });
    }

    // Fire webhook outside the transaction (fire-and-forget)
    fireOrderCreated(order.id).catch(err => {
      console.error(`[API Order] Webhook error for order ${order.id}:`, err.message);
    });

    return {
      success: true,
      orderId: order.id,
      status: order.status,
      totalPrice,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.productPrice,
        mobileNumber: item.mobileNumber,
        status: item.status
      })),
      createdAt: order.createdAt
    };
  }, { timeout: 15000 });
};

/**
 * Check the status of a single order.
 */
const getOrderStatus = async (orderId, userId) => {
  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          productPrice: true,
          mobileNumber: true,
          status: true,
          updatedAt: true
        }
      }
    }
  });

  if (!order) throw new Error('Order not found');
  if (order.userId !== userId) throw new Error('Order does not belong to this account');

  return {
    orderId: order.id,
    status: order.status,
    items: order.items,
    createdAt: order.createdAt
  };
};

/**
 * Check the status of multiple orders.
 */
const getOrderStatuses = async (orderIds, userId) => {
  const ids = orderIds.map(id => parseInt(id));
  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, userId }, // scoped to the user
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          productPrice: true,
          mobileNumber: true,
          status: true,
          updatedAt: true
        }
      }
    }
  });

  return orders.map(order => ({
    orderId: order.id,
    status: order.status,
    items: order.items,
    createdAt: order.createdAt
  }));
};

/**
 * Get wallet balance for the user.
 */
const getWalletBalance = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { loanBalance: true, adminLoanBalance: true, hasLoan: true }
  });

  if (!user) throw new Error('User not found');

  return {
    balance: Math.abs(user.loanBalance || 0),
    hasLoan: user.hasLoan,
    adminLoanBalance: user.adminLoanBalance || 0,
    currency: 'GHS'
  };
};

/**
 * Get network usage summary (similar to order tracker but simpler).
 */
const getNetworkMap = async (userId) => {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        select: {
          productName: true,
          productPrice: true,
          status: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 500
  });

  const networkSummary = {
    mtn: { count: 0, total: 0 },
    telecel: { count: 0, total: 0 },
    airteltigo: { count: 0, total: 0 },
    other: { count: 0, total: 0 }
  };

  for (const order of orders) {
    for (const item of order.items) {
      const upper = (item.productName || '').toUpperCase();
      let network = 'other';
      if (upper.startsWith('MTN')) network = 'mtn';
      else if (upper.startsWith('TELECEL')) network = 'telecel';
      else if (upper.startsWith('AIRTEL')) network = 'airteltigo';

      networkSummary[network].count++;
      networkSummary[network].total += item.productPrice || 0;
    }
  }

  return networkSummary;
};

module.exports = {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  activateApiKey,
  deleteApiKey,
  updateWebhookUrl,
  toggleWebhook,
  testWebhook,
  getAvailableProducts,
  createApiOrder,
  getOrderStatus,
  getOrderStatuses,
  getWalletBalance,
  getNetworkMap
};
