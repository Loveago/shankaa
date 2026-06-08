const axios = require('axios');
const prisma = require('../config/db');

// Paystack API URLs
const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';
const settingsService = require('./settingsService');
const shopService = require('./shopService');
const { resolvePrice } = require('../utils/priceRouter');

// Paystack charges a 2% fee on all transactions.
// We add this fee on top so the seller receives the full base amount.
const PAYSTACK_FEE_RATE = 0.02;
/** Given a base amount, return the total (including 2% Paystack fee). */
const withPaystackFee = (amount) => parseFloat(amount) * (1 + PAYSTACK_FEE_RATE);

const getPaystackSecret = async () => {
  const fromDb = await settingsService.getSettingValue(settingsService.SETTINGS_KEYS.PAYSTACK_SECRET);
  return fromDb || process.env.PAYSTACK_SECRET_KEY;
};

const UNPAID_ORDER_EXPIRY_HOURS = 24;

const calculateUnpaidOrderExpiry = (createdAt = new Date()) => {
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + UNPAID_ORDER_EXPIRY_HOURS);
  return expiresAt;
};

const createUnpaidOrderForTransaction = async ({
  transactionId,
  externalRef,
  productId,
  productName,
  mobileNumber,
  email,
  amount,
  currency = 'GHS',
  paymentUrl = null,
  paystackRef = null,
  status = 'PENDING',
  paymentStatus = 'UNPAID',
  paidAt = null,
  createdAt = new Date()
}) => {
  return prisma.unpaidOrder.upsert({
    where: { externalRef },
    update: {
      productId: productId ? parseInt(productId) : null,
      productName: productName || null,
      mobileNumber,
      customerEmail: email || null,
      amount: parseFloat(amount),
      currency,
      paymentUrl,
      paystackRef,
      status,
      paymentStatus,
      paidAt,
      paymentTransactionId: transactionId,
      expiresAt: calculateUnpaidOrderExpiry(createdAt)
    },
    create: {
      externalRef,
      productId: productId ? parseInt(productId) : null,
      productName: productName || null,
      mobileNumber,
      customerEmail: email || null,
      amount: parseFloat(amount),
      currency,
      paymentUrl,
      paystackRef,
      status,
      paymentStatus,
      paidAt,
      paymentTransactionId: transactionId,
      expiresAt: calculateUnpaidOrderExpiry(createdAt)
    }
  });
};

const updateUnpaidOrderAfterVerification = async (externalRef, data = {}) => {
  const unpaidOrder = await prisma.unpaidOrder.findUnique({ where: { externalRef } });
  if (!unpaidOrder) return null;

  return prisma.unpaidOrder.update({
    where: { externalRef },
    data: {
      status: data.status ?? unpaidOrder.status,
      paymentStatus: data.paymentStatus ?? unpaidOrder.paymentStatus,
      paidAt: data.paidAt ?? unpaidOrder.paidAt,
      paystackRef: data.paystackRef ?? unpaidOrder.paystackRef,
      paymentAttempts: { increment: data.incrementAttempts ? 1 : 0 },
      lastAttemptAt: data.lastAttemptAt ?? new Date(),
      paymentUrl: data.paymentUrl ?? unpaidOrder.paymentUrl,
      expiresAt: data.extendExpiry ? calculateUnpaidOrderExpiry(new Date()) : unpaidOrder.expiresAt
    }
  });
};

// Generate unique external reference for store orders
const generateStoreRef = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `STORE-${timestamp}-${random}`;
};

// Generate unique reference for bulk orders
const generateBulkRef = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BULK-${timestamp}-${random}`;
};

// Create a real Order only if the payment has been verified by Paystack.
// Atomic guard: checks transaction exists, no order linked yet, product available.
const createOrderIfNotExists = async (externalRef, productId, mobileNumber) => {
  const shopUser = await shopService.getOrCreateShopUser();
  return await prisma.$transaction(async (tx) => {
    const transaction = await tx.paymentTransaction.findUnique({ where: { externalRef } });
    if (!transaction) return { created: false, error: 'Transaction not found' };
    if (transaction.orderId) {
      const existingOrder = await tx.order.findUnique({ where: { id: transaction.orderId } });
      return { created: false, alreadyExists: true, orderId: transaction.orderId, order: existingOrder };
    }
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { rolePrices: { select: { role: true, price: true } } },
    });
    if (!product) return { created: false, error: 'Product not found' };
    if (product.shopStockClosed) return { created: false, error: 'Product is currently closed for purchases' };
    if (!product.showInShop) return { created: false, error: 'Product is not available in shop' };
    const order = await tx.order.create({
      data: {
        userId: shopUser.id,
        mobileNumber,
        status: 'Pending',
        orderNumber: externalRef,
        items: {
          create: [{
            productId,
            quantity: 1,
            mobileNumber,
            status: 'Pending',
            productName: product.name,
            productPrice: resolvePrice(product, null),
            productDescription: product.description
          }]
        }
      },
      include: { items: true }
    });
    await tx.paymentTransaction.update({ where: { externalRef }, data: { orderId: order.id } });
    return { created: true, orderId: order.id, order };
  }, { timeout: 15000 });
};

// Initialize Paystack transaction and get payment URL
const initializePayment = async (email, mobileNumber, amount, productId, productName, callbackUrl) => {
  const externalRef = generateStoreRef();
  
  // Format phone number
  let formattedPhone = mobileNumber.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '233' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('233')) {
    formattedPhone = '233' + formattedPhone;
  }

  // Create payment transaction + unpaid order together before redirecting to Paystack
  const paymentTransaction = await prisma.$transaction(async (tx) => {
    const createdTransaction = await tx.paymentTransaction.create({
      data: {
        externalRef,
        mobileNumber: formattedPhone,
        amount: parseFloat(amount),
        currency: 'GHS',
        channel: 'PAYSTACK',
        status: 'PENDING',
        productId: productId ? parseInt(productId) : null,
        productName
      }
    });

    await tx.unpaidOrder.upsert({
      where: { externalRef },
      update: {
        productId: productId ? parseInt(productId) : null,
        productName: productName || null,
        mobileNumber: formattedPhone,
        customerEmail: email || null,
        amount: parseFloat(amount),
        currency: 'GHS',
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentTransactionId: createdTransaction.id,
        expiresAt: calculateUnpaidOrderExpiry(createdTransaction.createdAt)
      },
      create: {
        externalRef,
        productId: productId ? parseInt(productId) : null,
        productName: productName || null,
        mobileNumber: formattedPhone,
        customerEmail: email || null,
        amount: parseFloat(amount),
        currency: 'GHS',
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentTransactionId: createdTransaction.id,
        expiresAt: calculateUnpaidOrderExpiry(createdTransaction.createdAt)
      }
    });

    return createdTransaction;
  });

  try {
    console.log('Initializing Paystack Payment...');
    
    // Paystack amount is in pesewas (kobo equivalent), so multiply by 100.
    // Include the 2% Paystack fee on top so the seller receives the full base amount.
    const amountInPesewas = Math.round(withPaystackFee(amount) * 100);

    const secret = await getPaystackSecret();
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
        reference: externalRef,
        callback_url: callbackUrl || process.env.PAYSTACK_CALLBACK_URL,
        metadata: {
          productId: productId,
          productName: productName,
          mobileNumber: formattedPhone,
          custom_fields: [
            {
              display_name: "Mobile Number",
              variable_name: "mobile_number",
              value: formattedPhone
            },
            {
              display_name: "Product",
              variable_name: "product_name",
              value: productName
            }
          ]
        },
        channels: ['mobile_money', 'card']
      },
      timeout: 30000
    });

    console.log('Paystack Initialize Response:', response.data);

    if (response.data.status === true) {
      const paymentUrl = response.data.data.authorization_url;
      const accessCode = response.data.data.access_code;
      const paystackRef = response.data.data.reference;

      // Update transaction with Paystack response
      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: {
          moolreCode: accessCode,
          moolreMessage: 'Payment initialized',
          moolreSessionId: paystackRef,
          status: 'INITIALIZED'
        }
      });

      await updateUnpaidOrderAfterVerification(externalRef, {
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paystackRef,
        paymentUrl,
        lastAttemptAt: new Date()
      });

      return {
        success: true,
        transactionId: paymentTransaction.id,
        externalRef,
        paymentUrl: paymentUrl,
        accessCode: accessCode,
        reference: paystackRef,
        message: 'Payment initialized successfully'
      };
    } else {
      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: {
          status: 'FAILED',
          moolreMessage: response.data.message || 'Failed to initialize payment'
        }
      });

      await updateUnpaidOrderAfterVerification(externalRef, {
        status: 'FAILED',
        paymentStatus: 'FAILED',
        lastAttemptAt: new Date()
      });

      return {
        success: false,
        transactionId: paymentTransaction.id,
        externalRef,
        error: response.data.message || 'Failed to initialize payment'
      };
    }

  } catch (error) {
    console.error('Paystack Initialize Error:', error.response?.data || error.message);
    
    await prisma.paymentTransaction.update({
      where: { id: paymentTransaction.id },
      data: {
        status: 'FAILED',
        moolreMessage: error.response?.data?.message || error.message
      }
    });

    await updateUnpaidOrderAfterVerification(externalRef, {
      status: 'FAILED',
      paymentStatus: 'FAILED',
      lastAttemptAt: new Date()
    });

    return {
      success: false,
      transactionId: paymentTransaction.id,
      externalRef,
      error: error.response?.data?.message || error.message
    };
  }
};

// Verify payment with Paystack API
const verifyPayment = async (reference) => {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { externalRef: reference }
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  try {
    console.log('Verifying Paystack Payment:', reference);
    
    const secret = await getPaystackSecret();
    const response = await axios({
      method: 'GET',
      url: `${PAYSTACK_VERIFY_URL}/${reference}`,
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('Paystack Verify Response:', response.data);

    const paymentData = response.data.data;
    const paymentStatus = paymentData?.status;
    
    // Paystack status: success, failed, abandoned
    const isSuccess = paymentStatus === 'success';
    const isPending = paymentStatus === 'pending' || paymentStatus === 'ongoing';
    const isFailed = paymentStatus === 'failed' || paymentStatus === 'abandoned';

    let status = transaction.status;
    if (isSuccess) {
      status = 'SUCCESS';
    } else if (isFailed) {
      status = 'FAILED';
    }

    // Update transaction
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: status,
        moolreCode: paymentData?.gateway_response || paymentStatus,
        moolreMessage: paymentData?.message || `Payment ${paymentStatus}`
      }
    });

    await updateUnpaidOrderAfterVerification(reference, {
      status: isSuccess ? 'PAID' : isFailed ? 'FAILED' : 'PENDING',
      paymentStatus: isSuccess ? 'PAID' : isFailed ? 'FAILED' : 'UNPAID',
      paidAt: isSuccess ? new Date() : null,
      paystackRef: paymentData?.reference || transaction.moolreSessionId,
      incrementAttempts: true,
      lastAttemptAt: new Date()
    });

    return {
      success: isSuccess,
      pending: isPending,
      transactionId: transaction.id,
      externalRef: reference,
      status: status,
      amount: paymentData?.amount / 100,
      paystackResponse: response.data
    };

  } catch (error) {
    console.error('Paystack Verify Error:', error.response?.data || error.message);
    return {
      success: false,
      pending: true,
      transactionId: transaction.id,
      externalRef: reference,
      error: error.response?.data?.message || error.message
    };
  }
};

// Handle Paystack webhook callback
const handleWebhook = async (webhookData) => {
  console.log('Paystack Webhook Received:', webhookData);
  
  // Paystack webhook event structure
  const event = webhookData.event;
  const data = webhookData.data;
  
  if (!data || !data.reference) {
    console.error('Webhook missing reference');
    return { success: false, error: 'Missing reference' };
  }

  const externalRef = data.reference;

  // Find the transaction
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { externalRef }
  });

  if (!transaction) {
    console.error('Transaction not found for webhook:', externalRef);
    return { success: false, error: 'Transaction not found' };
  }

  // Determine status from webhook event
  // charge.success = payment successful
  const isSuccess = event === 'charge.success' && data.status === 'success';
  const isFailed = event === 'charge.failed' || data.status === 'failed';

  let newStatus = transaction.status;
  if (isSuccess) {
    newStatus = 'SUCCESS';
  } else if (isFailed) {
    newStatus = 'FAILED';
  }

  // Update transaction
  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: newStatus,
      moolreSessionId: data.id?.toString() || transaction.moolreSessionId,
      moolreMessage: data.gateway_response || transaction.moolreMessage
    }
  });

  await updateUnpaidOrderAfterVerification(externalRef, {
    status: isSuccess ? 'PAID' : isFailed ? 'FAILED' : 'PENDING',
    paymentStatus: isSuccess ? 'PAID' : isFailed ? 'FAILED' : 'UNPAID',
    paidAt: isSuccess ? new Date() : null,
    paystackRef: data.reference || transaction.moolreSessionId,
    incrementAttempts: true,
    lastAttemptAt: new Date()
  });

  return {
    success: isSuccess,
    transactionId: transaction.id,
    externalRef,
    productId: transaction.productId,
    productName: transaction.productName,
    mobileNumber: transaction.mobileNumber,
    amount: transaction.amount,
    status: newStatus
  };
};

// Check payment status
const checkPaymentStatus = async (externalRef) => {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { externalRef }
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  return {
    transactionId: transaction.id,
    externalRef: transaction.externalRef,
    status: transaction.status,
    amount: transaction.amount,
    mobileNumber: transaction.mobileNumber,
    productId: transaction.productId,
    productName: transaction.productName,
    orderId: transaction.orderId,
    createdAt: transaction.createdAt
  };
};

// Get all payment transactions (for admin)
const getAllPaymentTransactions = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  const [transactions, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.paymentTransaction.count()
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Update transaction with order ID after successful order creation
const linkTransactionToOrder = async (externalRef, orderId) => {
  return await prisma.paymentTransaction.update({
    where: { externalRef },
    data: { orderId }
  });
};

// Get all successful payments that don't have orders (for reconciliation)
// Excludes payments that already failed order creation (permanent failures like product unavailable)
const getOrphanedSuccessfulPayments = async () => {
  return await prisma.unpaidOrder.findMany({
    where: {
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentTransaction: {
        orderId: null,
        productId: { not: null }
      }
    },
    include: {
      paymentTransaction: true
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
};

// Get transactions that may have been paid but never confirmed in our DB.
// These are stuck in PENDING/INITIALIZED because BOTH the webhook AND the
// frontend verify fallback failed. We actively re-verify these against Paystack.
// Window: older than 3 minutes (give the normal flow time) and within the last 3 days.
const getStuckPendingPayments = async () => {
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  return await prisma.unpaidOrder.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      createdAt: { lte: threeMinutesAgo, gte: threeDaysAgo },
      paymentTransaction: {
        orderId: null,
        productId: { not: null },
        status: { in: ['PENDING', 'INITIALIZED', 'SUCCESS'] }
      }
    },
    include: {
      paymentTransaction: true
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
};

// Mark transaction as having order creation attempted
const markOrderCreationAttempted = async (transactionId, success, errorMessage = null) => {
  return await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      moolreMessage: success 
        ? 'Order created successfully' 
        : `Order creation failed: ${errorMessage || 'Unknown error'}`
    }
  });
};

// Verify payment directly with Paystack and create order if successful
const verifyAndCreateOrder = async (reference, shopService) => {
  console.log('[Payment Reconciliation] Processing reference:', reference);

  const existingTransaction = await prisma.paymentTransaction.findUnique({
    where: { externalRef: reference }
  });

  if (!existingTransaction) {
    return { success: false, error: 'Transaction not found' };
  }

  if (existingTransaction.orderId) {
    return { success: true, message: 'Order already exists', orderId: existingTransaction.orderId };
  }

  try {
    const secret = await getPaystackSecret();
    const response = await axios({
      method: 'GET',
      url: `${PAYSTACK_VERIFY_URL}/${reference}`,
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const paymentData = response.data.data;
    const paystackStatus = paymentData?.status;
    const isSuccess = paystackStatus === 'success';
    const isFailed = paystackStatus === 'failed' || paystackStatus === 'abandoned';

    if (!isSuccess) {
      await prisma.paymentTransaction.update({
        where: { id: existingTransaction.id },
        data: { status: isFailed ? 'FAILED' : existingTransaction.status }
      });

      await updateUnpaidOrderAfterVerification(reference, {
        status: isFailed ? 'FAILED' : 'PENDING',
        paymentStatus: isFailed ? 'FAILED' : 'UNPAID',
        paystackRef: paymentData?.reference || existingTransaction.moolreSessionId,
        incrementAttempts: true,
        lastAttemptAt: new Date()
      });

      return { success: false, error: 'Payment not successful', status: paystackStatus };
    }

    await prisma.paymentTransaction.update({
      where: { id: existingTransaction.id },
      data: {
        status: 'SUCCESS',
        moolreCode: paymentData?.gateway_response || existingTransaction.moolreCode,
        moolreMessage: paymentData?.message || 'Payment verified by reconciliation'
      }
    });

    await updateUnpaidOrderAfterVerification(reference, {
      status: 'PAID',
      paymentStatus: 'PAID',
      paidAt: new Date(),
      paystackRef: paymentData?.reference || existingTransaction.moolreSessionId,
      incrementAttempts: true,
      lastAttemptAt: new Date()
    });

    if (existingTransaction.productId && existingTransaction.mobileNumber) {
      try {
        const orderResult = await createOrderIfNotExists(
          reference,
          existingTransaction.productId,
          existingTransaction.mobileNumber
        );

        if (orderResult.created || orderResult.alreadyExists) {
          const resolvedOrderId = orderResult.orderId;
          await markOrderCreationAttempted(existingTransaction.id, true);
          console.log('[Payment Reconciliation] Order created/linked:', resolvedOrderId);

          return {
            success: true,
            message: orderResult.created ? 'Payment verified and order created' : 'Payment verified and order already existed',
            orderId: resolvedOrderId,
            mobileNumber: existingTransaction.mobileNumber
          };
        }

        await markOrderCreationAttempted(existingTransaction.id, false, orderResult.error || 'Unknown order creation error');
        return { success: false, error: orderResult.error || 'Order creation failed' };
      } catch (orderError) {
        console.error('[Payment Reconciliation] Order creation failed:', orderError);
        await markOrderCreationAttempted(existingTransaction.id, false, orderError.message);
        return { success: false, error: 'Order creation failed', details: orderError.message };
      }
    }

    return { success: false, error: 'Missing product or mobile number' };
  } catch (error) {
    console.error('[Payment Reconciliation] Verification error:', error.message);
    await updateUnpaidOrderAfterVerification(reference, {
      incrementAttempts: true,
      lastAttemptAt: new Date()
    });
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  handleWebhook,
  checkPaymentStatus,
  getAllPaymentTransactions,
  linkTransactionToOrder,
  getOrphanedSuccessfulPayments,
  getStuckPendingPayments,
  verifyAndCreateOrder,
  createUnpaidOrderForTransaction,
  updateUnpaidOrderAfterVerification,
  createOrderIfNotExists,
  generateStoreRef,
  generateBulkRef
};
