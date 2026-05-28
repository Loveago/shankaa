const prisma = require('../config/db');
const crypto = require('crypto');
const { createTransaction } = require('./transactionService');

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
    totalOrders: k.totalOrders
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
//  ORDER ENDPOINTS (wallet-deducting)
// ============================================================

/**
 * Get available products for a user's API integration.
 */
const getAvailableProducts = async () => {
  const products = await prisma.product.findMany({
    where: { showForAgents: true },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      promoPrice: true,
      usePromoPrice: true,
      stock: true
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
      price: (p.usePromoPrice && p.promoPrice != null) ? p.promoPrice : p.price,
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
    if (!item.productId) throw new Error(`Item ${i}: productId is required`);
    if (!item.mobileNumber) throw new Error(`Item ${i}: mobileNumber is required`);
    if (!item.quantity || parseInt(item.quantity) < 1) throw new Error(`Item ${i}: invalid quantity`);
  }

  return await prisma.$transaction(async (tx) => {
    // Fetch all products
    const productIds = items.map(i => parseInt(i.productId));
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = {};
    for (const p of products) productMap[p.id] = p;

    // Validate products and calculate total
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const product = productMap[parseInt(item.productId)];
      if (!product) throw new Error(`Product ID ${item.productId} not found`);
      if (product.stock < 1) throw new Error(`Product "${product.name}" is out of stock`);

      const effectivePrice = (product.usePromoPrice && product.promoPrice != null)
        ? product.promoPrice
        : product.price;
      const quantity = parseInt(item.quantity) || 1;
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

    // Check user balance
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.isSuspended) throw new Error('Account is suspended');

    // Compare using loanBalance (wallet balance)
    // loanBalance is stored as absolute positive value
    const balance = Math.abs(user.loanBalance || 0);
    if (balance < totalPrice) {
      throw new Error(
        `Insufficient wallet balance. Required: GHS ${totalPrice.toFixed(2)}, Available: GHS ${balance.toFixed(2)}`
      );
    }

    // Create the order with items
    const order = await tx.order.create({
      data: {
        userId,
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
      `API Order #${order.id} placed via "${items[0]?.productName || 'API'}" — ${items.length} item(s)`,
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
  getAvailableProducts,
  createApiOrder,
  getOrderStatus,
  getOrderStatuses,
  getWalletBalance,
  getNetworkMap
};
