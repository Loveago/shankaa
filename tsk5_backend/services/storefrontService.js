const axios = require('axios');
const prisma = require('../config/db');
const { resolvePrice } = require('../utils/priceRouter');
const { generateOrderNumber } = require('../utils/orderNumberGenerator');
const settingsService = require('./settingsService');

// Paystack API URLs
const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

const getPaystackSecret = async () => {
  const fromDb = await settingsService.getSettingValue(settingsService.SETTINGS_KEYS.PAYSTACK_SECRET);
  return fromDb || process.env.PAYSTACK_SECRET_KEY;
};

// Generate unique reference for referral orders
const generateReferralRef = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REF-${timestamp}-${random}`;
};

// Generate unique storefront slug from agent name
const generateStorefrontSlug = (name) => {
  const base = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const random = Math.random().toString(36).substring(2, 6);
  return `${base}-${random}`;
};

// Resolve the effective price for a product for the given agent role.
// Delegates to the shared resolvePrice utility so all channels (storefront,
// dashboards, shop, external API) use identical role-based pricing logic.
const effectivePriceOf = (product, role = null) => {
  return resolvePrice(product, role);
};

// ==================== AGENT STOREFRONT MANAGEMENT ====================

// Get or create storefront slug for an agent
const getOrCreateStorefrontSlug = async (agentId) => {
  const agent = await prisma.user.findUnique({
    where: { id: parseInt(agentId) },
    select: { id: true, name: true, storefrontSlug: true, storefrontWhatsapp: true }
  });

  if (!agent) throw new Error('Agent not found');

  if (agent.storefrontSlug) {
    return { slug: agent.storefrontSlug, whatsapp: agent.storefrontWhatsapp || '' };
  }

  // Generate and save new slug
  const slug = generateStorefrontSlug(agent.name);
  await prisma.user.update({
    where: { id: parseInt(agentId) },
    data: { storefrontSlug: slug }
  });

  return { slug, whatsapp: agent.storefrontWhatsapp || '' };
};

// Get all products available for storefront (filtered by agent role)
const getAvailableProducts = async (agentId) => {
  // Get agent's role for effective price resolution
  const agent = await prisma.user.findUnique({
    where: { id: parseInt(agentId) },
    select: { role: true }
  });

  if (!agent) throw new Error('Agent not found');

  const role = agent.role;

  // Show ALL products with stock > 0 — the old name-based role filtering
  // is obsolete now that per-account-type pricing (RolePrice) exists.
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    include: { rolePrices: { select: { role: true, price: true } } },
    orderBy: [{ name: 'asc' }, { price: 'asc' }]
  });

  // Expose the promo-aware price as `price` so the storefront UI (and its
  // min-price validation) operates on what the agent actually pays. Keep
  // the original `price` accessible as `basePrice` in case the client
  // wants to show a strikethrough or promo badge.
  return products.map(p => ({
    ...p,
    basePrice: p.price,
    onPromo: Boolean(p.usePromoPrice && typeof p.promoPrice === 'number'),
    price: effectivePriceOf(p, role)
  }));
};

// Get agent's storefront products
const getAgentStorefrontProducts = async (agentId) => {
  const rows = await prisma.storefrontProduct.findMany({
    where: { agentId: parseInt(agentId) },
    include: {
      product: {
        select: {
          id: true, name: true, description: true, price: true,
          promoPrice: true, usePromoPrice: true, stock: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Rewrite each product's `price` to the effective (promo-aware) price so
  // the agent's "Base Price" and the "Your Profit" calculation on the UI
  // reflect the current active price — matching how orders actually charge.
  return rows.map(sp => ({
    ...sp,
    product: sp.product
      ? {
          ...sp.product,
          basePrice: sp.product.price,
          onPromo: Boolean(sp.product.usePromoPrice && typeof sp.product.promoPrice === 'number'),
          price: effectivePriceOf(sp.product)
        }
      : sp.product
  }));
};

// Add product to agent's storefront
const addProductToStorefront = async (agentId, productId, customPrice) => {
  const product = await prisma.product.findUnique({
    where: { id: parseInt(productId) }
  });

  if (!product) throw new Error('Product not found');

  const basePrice = effectivePriceOf(product);
  if (parseFloat(customPrice) < basePrice) {
    throw new Error(`Custom price cannot be less than base price (GHS ${basePrice})`);
  }

  // Check if already exists
  const existing = await prisma.storefrontProduct.findUnique({
    where: {
      agentId_productId: {
        agentId: parseInt(agentId),
        productId: parseInt(productId)
      }
    }
  });

  if (existing) {
    // Update existing
    return await prisma.storefrontProduct.update({
      where: { id: existing.id },
      data: { customPrice: parseFloat(customPrice), isActive: true },
      include: { product: true }
    });
  }

  // Create new
  return await prisma.storefrontProduct.create({
    data: {
      agentId: parseInt(agentId),
      productId: parseInt(productId),
      customPrice: parseFloat(customPrice)
    },
    include: { product: true }
  });
};

// Update product price in storefront
const updateStorefrontProductPrice = async (agentId, storefrontProductId, customPrice) => {
  const storefrontProduct = await prisma.storefrontProduct.findFirst({
    where: {
      id: parseInt(storefrontProductId),
      agentId: parseInt(agentId)
    },
    include: { product: true }
  });

  if (!storefrontProduct) throw new Error('Storefront product not found');

  const basePrice = effectivePriceOf(storefrontProduct.product);
  if (parseFloat(customPrice) < basePrice) {
    throw new Error(`Custom price cannot be less than base price (GHS ${basePrice})`);
  }

  return await prisma.storefrontProduct.update({
    where: { id: parseInt(storefrontProductId) },
    data: { customPrice: parseFloat(customPrice) },
    include: { product: true }
  });
};

// Remove product from storefront
const removeProductFromStorefront = async (agentId, storefrontProductId) => {
  const storefrontProduct = await prisma.storefrontProduct.findFirst({
    where: {
      id: parseInt(storefrontProductId),
      agentId: parseInt(agentId)
    }
  });

  if (!storefrontProduct) throw new Error('Storefront product not found');

  await prisma.storefrontProduct.delete({
    where: { id: parseInt(storefrontProductId) }
  });

  return { success: true, message: 'Product removed from storefront' };
};

// Toggle product active status
const toggleStorefrontProduct = async (agentId, storefrontProductId) => {
  const storefrontProduct = await prisma.storefrontProduct.findFirst({
    where: {
      id: parseInt(storefrontProductId),
      agentId: parseInt(agentId)
    }
  });

  if (!storefrontProduct) throw new Error('Storefront product not found');

  return await prisma.storefrontProduct.update({
    where: { id: parseInt(storefrontProductId) },
    data: { isActive: !storefrontProduct.isActive },
    include: { product: true }
  });
};

// ==================== PUBLIC STOREFRONT ====================

// Get public storefront by slug
const getPublicStorefront = async (slug) => {
  const agent = await prisma.user.findFirst({
    where: { storefrontSlug: slug },
    select: { id: true, name: true, storefrontSlug: true, storefrontWhatsapp: true }
  });

  if (!agent) throw new Error('Storefront not found');

  const products = await prisma.storefrontProduct.findMany({
    where: {
      agentId: agent.id,
      isActive: true,
      product: { stock: { gt: 0 } }
    },
    include: {
      product: {
        select: { id: true, name: true, description: true, price: true, stock: true }
      }
    },
    orderBy: { customPrice: 'asc' }
  });

  return {
    agent: { name: agent.name, slug: agent.storefrontSlug, whatsapp: agent.storefrontWhatsapp },
    products: products.map(sp => ({
      id: sp.id,
      productId: sp.product.id,
      name: sp.product.name,
      description: sp.product.description,
      price: sp.customPrice,
      basePrice: sp.product.price,
      inStock: sp.product.stock > 0
    }))
  };
};

// ==================== REFERRAL ORDER PROCESSING ====================

// Initialize payment for referral order
const initializeReferralPayment = async (slug, storefrontProductId, customerName, customerPhone, callbackUrl) => {
  // Get agent and storefront product
  const agent = await prisma.user.findFirst({
    where: { storefrontSlug: slug },
    select: { id: true, name: true, email: true }
  });

  if (!agent) throw new Error('Storefront not found');

  const storefrontProduct = await prisma.storefrontProduct.findFirst({
    where: {
      id: parseInt(storefrontProductId),
      agentId: agent.id,
      isActive: true
    },
    include: { product: true }
  });

  if (!storefrontProduct) throw new Error('Product not available');
  if (storefrontProduct.product.stock <= 0) throw new Error('Product out of stock');

  const paymentRef = generateReferralRef();
  // Use the promo-aware effective price so the recorded basePrice, the
  // agent's commission, and the company revenue all line up with what
  // every other sale channel (shop, cart, external API) is charging.
  const basePrice = effectivePriceOf(storefrontProduct.product);
  const agentPrice = storefrontProduct.customPrice;
  const commission = agentPrice - basePrice;

  // Format phone number
  let formattedPhone = customerPhone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '233' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('233')) {
    formattedPhone = '233' + formattedPhone;
  }

  // Create referral order record
  const referralOrder = await prisma.referralOrder.create({
    data: {
      agentId: agent.id,
      productId: storefrontProduct.product.id,
      customerName,
      customerPhone: formattedPhone,
      basePrice,
      agentPrice,
      commission,
      paymentRef,
      paymentStatus: 'Pending',
      orderStatus: 'Pending'
    }
  });

  // Initialize Paystack payment
  try {
    const amountInPesewas = Math.round(agentPrice * 100);

    const secret = await getPaystackSecret();
    const response = await axios({
      method: 'POST',
      url: PAYSTACK_INITIALIZE_URL,
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      data: {
        email: `${formattedPhone}@tsk5.com`,
        amount: amountInPesewas,
        currency: 'GHS',
        reference: paymentRef,
        callback_url: callbackUrl,
        metadata: {
          type: 'referral_order',
          referralOrderId: referralOrder.id,
          agentId: agent.id,
          agentName: agent.name,
          productId: storefrontProduct.product.id,
          productName: storefrontProduct.product.name,
          customerName,
          customerPhone: formattedPhone,
          custom_fields: [
            { display_name: "Customer Name", variable_name: "customer_name", value: customerName },
            { display_name: "Mobile Number", variable_name: "mobile_number", value: formattedPhone },
            { display_name: "Agent", variable_name: "agent_name", value: agent.name },
            { display_name: "Product", variable_name: "product_name", value: storefrontProduct.product.name }
          ]
        },
        channels: ['mobile_money', 'card']
      },
      timeout: 30000
    });

    if (response.data.status === true) {
      return {
        success: true,
        paymentUrl: response.data.data.authorization_url,
        reference: paymentRef,
        referralOrderId: referralOrder.id
      };
    } else {
      throw new Error('Failed to initialize payment');
    }
  } catch (error) {
    // Update referral order status
    await prisma.referralOrder.update({
      where: { id: referralOrder.id },
      data: { paymentStatus: 'Failed' }
    });
    throw error;
  }
};

// Verify referral payment and create order
const verifyReferralPayment = async (reference) => {
  // Find referral order
  const referralOrder = await prisma.referralOrder.findUnique({
    where: { paymentRef: reference },
    include: {
      agent: { select: { id: true, name: true } },
      product: true
    }
  });

  if (!referralOrder) throw new Error('Referral order not found');

  // If already paid and order exists, return early to prevent duplicate
  if (referralOrder.paymentStatus === 'Paid' && referralOrder.orderId) {
    const existingOrder = await prisma.order.findUnique({
      where: { id: referralOrder.orderId },
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, name: true } }
      }
    });
    return {
      success: true,
      alreadyProcessed: true,
      order: existingOrder,
      referralOrder
    };
  }

  // Verify with Paystack
  try {
    const secret = await getPaystackSecret();
    const response = await axios({
      method: 'GET',
      url: `${PAYSTACK_VERIFY_URL}/${reference}`,
      headers: {
        'Authorization': `Bearer ${secret}`
      },
      timeout: 30000
    });

    if (response.data.status === true && response.data.data.status === 'success') {
      // Double-check to prevent race condition - use transaction
      const result = await prisma.$transaction(async (tx) => {
        // Re-fetch the referral order inside transaction to check current state
        const currentOrder = await tx.referralOrder.findUnique({
          where: { paymentRef: reference }
        });

        // If already processed, skip order creation
        if (currentOrder.paymentStatus === 'Paid' && currentOrder.orderId) {
          const existingOrder = await tx.order.findUnique({
            where: { id: currentOrder.orderId },
            include: {
              items: { include: { product: true } },
              user: { select: { id: true, name: true } }
            }
          });
          return { alreadyProcessed: true, order: existingOrder };
        }

        // Payment successful - create order in agent's name
        const order = await tx.order.create({
          data: {
            userId: referralOrder.agentId, // Order goes to agent
            mobileNumber: referralOrder.customerPhone,
            status: 'Pending',
            orderNumber: generateOrderNumber(),
            items: {
              create: [{
                productId: referralOrder.productId,
                quantity: 1,
                mobileNumber: referralOrder.customerPhone,
                status: 'Pending',
                productName: referralOrder.product.name,
                productPrice: referralOrder.basePrice,
                productDescription: referralOrder.product.description
              }]
            }
          },
          include: {
            items: { include: { product: true } },
            user: { select: { id: true, name: true } }
          }
        });

        // Update referral order
        await tx.referralOrder.update({
          where: { id: referralOrder.id },
          data: {
            paymentStatus: 'Paid',
            orderStatus: 'Processing',
            orderId: order.id
          }
        });

        // Commission is NOT credited here anymore.
        // It will be credited when the order item status is changed to "Completed"
        // See orderService.updateSingleOrderItemStatus for the commission logic

        return { alreadyProcessed: false, order };
      }, { timeout: 15000 });

      // Trigger Skanka5 auto-processing for newly created orders (fire-and-forget)
      if (!result.alreadyProcessed && result.order) {
        try {
          const skanka5Service = require('./skanka5Service');
          skanka5Service.triggerProcessing(result.order).catch(err =>
            console.error('[Skanka5] Storefront trigger error:', err.message)
          );
        } catch (e) { /* non-blocking */ }
      }

      return {
        success: true,
        alreadyProcessed: result.alreadyProcessed,
        message: result.alreadyProcessed ? 'Order already processed' : 'Payment verified and order created',
        order: result.order,
        referralOrder: {
          ...referralOrder,
          paymentStatus: 'Paid',
          orderId: result.order.id
        }
      };
    } else {
      await prisma.referralOrder.update({
        where: { id: referralOrder.id },
        data: { paymentStatus: 'Failed' }
      });

      return {
        success: false,
        message: 'Payment verification failed'
      };
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return {
      success: false,
      pending: true,
      message: error.message
    };
  }
};

// ==================== AGENT COMMISSION TRACKING ====================

// Get agent's referral orders and commission summary
const getAgentReferralSummary = async (agentId) => {
  // Fire-and-forget: clean stale pending referrals so agents don't see dead orders
  cleanupStalePendingReferrals().catch(() => {});

  const referralOrders = await prisma.referralOrder.findMany({
    where: { agentId: parseInt(agentId) },
    include: {
      product: { select: { id: true, name: true, description: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Calculate totals
  const totalOrders = referralOrders.length;
  const paidOrders = referralOrders.filter(o => o.paymentStatus === 'Paid');
  const totalCommission = paidOrders.reduce((sum, o) => sum + o.commission, 0);
  const unpaidCommission = paidOrders.filter(o => !o.commissionPaid).reduce((sum, o) => sum + o.commission, 0);
  const paidCommission = paidOrders.filter(o => o.commissionPaid).reduce((sum, o) => sum + o.commission, 0);

  return {
    orders: referralOrders,
    stats: {
      totalOrders,
      completedOrders: paidOrders.length,
      totalCommission,
      unpaidCommission,
      paidCommission
    }
  };
};

// ==================== ADMIN FUNCTIONS ====================

// Get all referral orders (for admin)
const getAllReferralOrders = async (filters = {}) => {
  // Fire-and-forget: clean stale pending referrals before returning admin view
  cleanupStalePendingReferrals().catch(() => {});

  const where = {};
  
  if (filters.agentId) where.agentId = parseInt(filters.agentId);
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.commissionPaid !== undefined) where.commissionPaid = filters.commissionPaid === 'true';
  
  if (filters.startDate && filters.endDate) {
    where.createdAt = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate + 'T23:59:59.999Z')
    };
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const skip = (page - 1) * limit;

  // Run paginated orders + stats in parallel
  const [totalCount, orders, statsAgg, unpaidAgg] = await Promise.all([
    prisma.referralOrder.count({ where }),
    prisma.referralOrder.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, phone: true, role: true } },
        product: { select: { id: true, name: true, description: true, price: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.referralOrder.aggregate({
      where: { ...where, paymentStatus: 'Paid' },
      _sum: { commission: true },
      _count: true
    }),
    prisma.referralOrder.aggregate({
      where: { ...where, paymentStatus: 'Paid', commissionPaid: false },
      _sum: { commission: true }
    })
  ]);

  const totalCommission = statsAgg._sum.commission || 0;
  const paidOrdersCount = statsAgg._count || 0;
  const unpaidCommission = unpaidAgg._sum.commission || 0;

  // Group by agent from current page only (lightweight)
  const agentSummary = {};
  orders.filter(o => o.paymentStatus === 'Paid').forEach(order => {
    const agentId = order.agentId;
    if (!agentSummary[agentId]) {
      agentSummary[agentId] = {
        agent: order.agent,
        totalOrders: 0,
        totalCommission: 0,
        unpaidCommission: 0
      };
    }
    agentSummary[agentId].totalOrders++;
    agentSummary[agentId].totalCommission += order.commission;
    if (!order.commissionPaid) {
      agentSummary[agentId].unpaidCommission += order.commission;
    }
  });

  return {
    orders,
    stats: {
      totalOrders: totalCount,
      paidOrders: paidOrdersCount,
      totalCommission,
      unpaidCommission
    },
    agentSummary: Object.values(agentSummary),
    pagination: {
      page, limit, total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit)
    }
  };
};

// Mark commissions as paid and optionally add to agent's wallet
// paymentMethod: 'wallet' (adds to agent wallet) or 'momo' (paid via momo, no wallet credit)
const markCommissionsPaid = async (agentId, orderIds, paymentMethod = 'wallet') => {
  // Get the unpaid orders to calculate total commission
  const unpaidOrders = await prisma.referralOrder.findMany({
    where: {
      id: { in: orderIds.map(id => parseInt(id)) },
      agentId: parseInt(agentId),
      paymentStatus: 'Paid',
      commissionPaid: false
    }
  });

  if (unpaidOrders.length === 0) {
    return {
      success: false,
      message: 'No unpaid commissions found',
      updatedCount: 0
    };
  }

  // Calculate total commission
  const totalCommission = unpaidOrders.reduce((sum, order) => sum + order.commission, 0);

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Mark orders as paid with payment method info
    const updateResult = await tx.referralOrder.updateMany({
      where: {
        id: { in: orderIds.map(id => parseInt(id)) },
        agentId: parseInt(agentId),
        paymentStatus: 'Paid',
        commissionPaid: false
      },
      data: {
        commissionPaid: true,
        paidAt: new Date(),
        commissionPaymentMethod: paymentMethod // 'wallet' or 'momo'
      }
    });

    // Only add to wallet if payment method is 'wallet'
    if (paymentMethod === 'wallet') {
      await tx.user.update({
        where: { id: parseInt(agentId) },
        data: {
          loanBalance: { increment: totalCommission }
        }
      });
    }

    return updateResult;
  }, { timeout: 15000 });

  const paymentMethodLabel = paymentMethod === 'momo' ? 'via MoMo' : "to agent's wallet";
  return {
    success: true,
    updatedCount: result.count,
    totalCommission,
    paymentMethod,
    message: `GHS ${totalCommission.toFixed(2)} paid ${paymentMethodLabel}`
  };
};

// Get weekly commission summary
const getWeeklyCommissionSummary = async () => {
  // Get start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const orders = await prisma.referralOrder.findMany({
    where: {
      paymentStatus: 'Paid',
      createdAt: {
        gte: weekStart,
        lte: weekEnd
      }
    },
    include: {
      agent: { select: { id: true, name: true, phone: true } }
    }
  });

  // Group by agent
  const agentCommissions = {};
  orders.forEach(order => {
    const agentId = order.agentId;
    if (!agentCommissions[agentId]) {
      agentCommissions[agentId] = {
        agent: order.agent,
        orders: 0,
        totalCommission: 0,
        unpaidCommission: 0
      };
    }
    agentCommissions[agentId].orders++;
    agentCommissions[agentId].totalCommission += order.commission;
    if (!order.commissionPaid) {
      agentCommissions[agentId].unpaidCommission += order.commission;
    }
  });

  return {
    weekStart,
    weekEnd,
    agents: Object.values(agentCommissions),
    totalCommission: orders.reduce((sum, o) => sum + o.commission, 0),
    totalUnpaid: orders.filter(o => !o.commissionPaid).reduce((sum, o) => sum + o.commission, 0)
  };
};

// ==================== STALE REFERRAL ORDER CLEANUP ====================
// Delete referral orders stuck in 'Pending' payment status for more than 24 hours.
// These represent customers who initiated payment but never completed on Paystack.
// Never touches Paid/Failed orders or any that were already linked to a real Order.
const cleanupStalePendingReferrals = async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await prisma.referralOrder.deleteMany({
      where: {
        paymentStatus: 'Pending',
        orderId: null,
        createdAt: { lt: cutoff }
      }
    });
    if (result.count > 0) {
      console.log(`[Referral Cleanup] Deleted ${result.count} stale pending referral order(s) older than 24h`);
    }
    return result.count;
  } catch (error) {
    console.error('[Referral Cleanup] Error:', error.message);
    return 0;
  }
};

// ==================== STOREFRONT WALLET & COMMISSION AUTO-DEPOSIT ====================
// Deposit commission to agent's storefront wallet automatically after payment verification
const depositCommissionToWallet = async (transaction) => {
  // Inside verifyReferralPayment, after payment is confirmed and order created,
  // we deposit the commission to the agent's storefrontWallet
  const { referralOrder } = transaction;
  await prisma.user.update({
    where: { id: referralOrder.agentId },
    data: {
      storefrontWallet: { increment: referralOrder.commission }
    }
  });
};

// Get agent's storefront wallet balance
const getStorefrontWallet = async (agentId) => {
  const agent = await prisma.user.findUnique({
    where: { id: parseInt(agentId) },
    select: { id: true, name: true, storefrontWallet: true }
  });

  if (!agent) throw new Error('Agent not found');

  return {
    agentId: agent.id,
    name: agent.name,
    balance: agent.storefrontWallet || 0
  };
};

// ==================== STOREFRONT WHATSAPP SETTINGS ====================
const updateStorefrontWhatsapp = async (agentId, whatsappNumber) => {
  const agent = await prisma.user.findUnique({
    where: { id: parseInt(agentId) }
  });
  if (!agent) throw new Error('Agent not found');

  return await prisma.user.update({
    where: { id: parseInt(agentId) },
    data: { storefrontWhatsapp: whatsappNumber || null },
    select: { id: true, name: true, storefrontWhatsapp: true }
  });
};

// ==================== WITHDRAWAL SYSTEM ====================
const createWithdrawalRequest = async (agentId, amount, mobileNumber) => {
  const agent = await prisma.user.findUnique({
    where: { id: parseInt(agentId) },
    select: { id: true, storefrontWallet: true }
  });

  if (!agent) throw new Error('Agent not found');
  if (amount <= 0) throw new Error('Invalid withdrawal amount');
  if (amount < 10) throw new Error('Minimum withdrawal amount is GHS 10');
  if ((agent.storefrontWallet || 0) < (amount + 1)) throw new Error(`Insufficient wallet balance. GHS 1 fee applies, so you need at least GHS ${amount + 1}`);

  const result = await prisma.$transaction(async (tx) => {
    // Deduct withdrawal amount + GHS 1 fee from wallet
    const totalDeduction = amount + 1;
    await tx.user.update({
      where: { id: parseInt(agentId) },
      data: { storefrontWallet: { decrement: totalDeduction } }
    });

    // Create withdrawal request (amount is the payout amount, fee is tracked separately)
    const withdrawal = await tx.withdrawalRequest.create({
      data: {
        agentId: parseInt(agentId),
        amount,
        mobileNumber,
        status: 'Pending'
      }
    });

    return withdrawal;
  });

  return result;
};

// Get all orders placed through the agent's storefront
const getAgentStorefrontOrders = async (agentId) => {
  const referralOrders = await prisma.referralOrder.findMany({
    where: {
      agentId: parseInt(agentId),
      orderId: { not: null },
      paymentStatus: 'Paid'
    },
    include: {
      product: { select: { id: true, name: true, description: true } },
      order: {
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, description: true } }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return referralOrders.map(ro => ({
    id: ro.id,
    customerName: ro.customerName,
    customerPhone: ro.customerPhone,
    productName: ro.product?.name || 'Unknown',
    basePrice: ro.basePrice,
    agentPrice: ro.agentPrice,
    commission: ro.commission,
    commissionPaid: ro.commissionPaid,
    paidAt: ro.paidAt,
    createdAt: ro.createdAt,
    order: ro.order ? {
      id: ro.order.id,
      orderNumber: ro.order.orderNumber,
      status: ro.order.status,
      createdAt: ro.order.createdAt,
      items: ro.order.items.map(item => ({
        id: item.id,
        productName: item.productName || item.product?.name,
        quantity: item.quantity,
        mobileNumber: item.mobileNumber,
        status: item.status,
        productPrice: item.productPrice
      }))
    } : null
  }));
};

// Get agent's withdrawal requests
const getAgentWithdrawalRequests = async (agentId) => {
  return await prisma.withdrawalRequest.findMany({
    where: { agentId: parseInt(agentId) },
    orderBy: { createdAt: 'desc' }
  });
};

// Admin: get all withdrawal requests
const getAllWithdrawalRequests = async (filters = {}) => {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.agentId) where.agentId = parseInt(filters.agentId);

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const skip = (page - 1) * limit;

  const [requests, totalCount] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, email: true, phone: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.withdrawalRequest.count({ where })
  ]);

  return {
    requests,
    pagination: {
      page, limit, totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      hasNext: page < Math.ceil(totalCount / limit)
    }
  };
};

// Admin: approve or reject a withdrawal request
const processWithdrawalRequest = async (requestId, status, adminNotes = null) => {
  if (!['Approved', 'Rejected'].includes(status)) {
    throw new Error('Status must be Approved or Rejected');
  }

  const request = await prisma.withdrawalRequest.findUnique({
    where: { id: parseInt(requestId) }
  });

  if (!request) throw new Error('Withdrawal request not found');
  if (request.status !== 'Pending') throw new Error('Request already processed');

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.withdrawalRequest.update({
      where: { id: parseInt(requestId) },
      data: {
        status,
        adminNotes: adminNotes || null,
        processedAt: new Date()
      }
    });

    // If rejected, refund the amount back to the agent's wallet
    if (status === 'Rejected') {
      await tx.user.update({
        where: { id: request.agentId },
        data: { storefrontWallet: { increment: request.amount } }
      });
    }

    return updated;
  });

  return result;
};

module.exports = {
  // Agent storefront management
  getOrCreateStorefrontSlug,
  getAvailableProducts,
  getAgentStorefrontProducts,
  addProductToStorefront,
  updateStorefrontProductPrice,
  removeProductFromStorefront,
  toggleStorefrontProduct,
  
  // Public storefront
  getPublicStorefront,
  
  // Referral order processing
  initializeReferralPayment,
  verifyReferralPayment,
  
  // Agent commission tracking
  getAgentReferralSummary,
  getAgentStorefrontOrders,
  
  // Admin functions
  getAllReferralOrders,
  markCommissionsPaid,
  getWeeklyCommissionSummary,

  // Storefront Wallet
  getStorefrontWallet,
  depositCommissionToWallet,

  // Storefront WhatsApp
  updateStorefrontWhatsapp,

  // Withdrawal System
  createWithdrawalRequest,
  getAgentWithdrawalRequests,
  getAllWithdrawalRequests,
  processWithdrawalRequest,

  // Maintenance
  cleanupStalePendingReferrals
};
