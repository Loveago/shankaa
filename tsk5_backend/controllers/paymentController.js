const paymentService = require('../services/paymentService');
const shopService = require('../services/shopService');
const crypto = require('crypto');
const prisma = require('../config/db');
const { createOrderIfNotExists } = paymentService;

// Initialize Paystack payment
const initializePayment = async (req, res) => {
  try {
    const { email, mobileNumber, amount, productId, productName } = req.body;
    console.log('[Controller] initializePayment called with:', { email, mobileNumber, amount, productId, productName });

    if (!mobileNumber || !amount) {
      console.log('[Controller] Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Mobile number and amount are required'
      });
    }

    // Check product availability before initializing payment
    if (productId) {
      console.log('[Controller] Checking product availability for ID:', productId);
      const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
      if (!product) {
        console.log('[Controller] Product not found');
        return res.status(400).json({ success: false, message: 'Product not found' });
      }
      if (product.stock <= 0) {
        console.log('[Controller] Product out of stock');
        return res.status(400).json({ success: false, message: 'Product is out of stock' });
      }
      if (product.shopStockClosed) {
        console.log('[Controller] Product shop closed');
        return res.status(400).json({ success: false, message: 'Product is currently unavailable for purchase' });
      }
      if (!product.showInShop) {
        console.log('[Controller] Product not shown in shop');
        return res.status(400).json({ success: false, message: 'Product is not available in shop' });
      }
      console.log('[Controller] Product check passed');
    }

    // Build callback URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const callbackUrl = `${frontendUrl}/shop?payment=callback`;
    console.log('[Controller] Calling paymentService.initializePayment');

    const result = await paymentService.initializePayment(
      email,
      mobileNumber,
      amount,
      productId,
      productName,
      callbackUrl
    );

    console.log('[Controller] initializePayment result:', { success: result.success, externalRef: result.externalRef, error: result.error });

    if (result.success) {
      console.log('[Controller] Returning success response');
      res.json({
        success: true,
        message: 'Payment initialized',
        transactionId: result.transactionId,
        externalRef: result.externalRef,
        paymentUrl: result.paymentUrl,
        accessCode: result.accessCode,
        reference: result.reference
      });
    } else {
      console.log('[Controller] Returning error response:', result.error);
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to initialize payment',
        transactionId: result.transactionId,
        externalRef: result.externalRef
      });
    }
  } catch (error) {
    console.error('[Controller] Payment initialization error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Handle Paystack webhook callback
const handleWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
      console.error('Invalid Paystack webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log('Paystack Webhook received:', req.body.event);
    
    // Check if this is a referral order - skip order creation as it's handled by storefront verify
    const metadata = req.body.data?.metadata;
    if (metadata?.type === 'referral_order') {
      console.log('Webhook: Skipping referral order - handled by storefront verification');
      return res.status(200).json({ received: true, type: 'referral_order' });
    }
    
    // Skip topup webhooks - they're handled by topup routes
    if (req.body.data?.reference?.startsWith('TOPUP-')) {
      return res.status(200).json({ received: true, type: 'topup' });
    }

    const result = await paymentService.handleWebhook(req.body);

    if (result.success && result.productId && result.mobileNumber) {
      // Payment successful - create order atomically (prevents duplicates with verify endpoint)
      // Retry up to 3 times to handle transient network failures
      let orderResult = null;
      let lastOrderError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          orderResult = await createOrderIfNotExists(
            result.externalRef,
            result.productId,
            result.mobileNumber
          );
          if (orderResult.created || orderResult.alreadyExists) {
            console.log(`[Webhook] Order created (attempt ${attempt}):`, orderResult.orderId);
            break;
          }
          // Order creation returned false without error - wait and retry
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } catch (orderError) {
          lastOrderError = orderError;
          console.error(`[Webhook] Order creation attempt ${attempt} failed:`, orderError.message);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }

      if (!orderResult && lastOrderError) {
        console.error('[Webhook] All order creation attempts failed:', lastOrderError.message);
      } else if (orderResult && !orderResult.created && !orderResult.alreadyExists) {
        console.error('[Webhook] Order creation failed permanently:', orderResult.error || 'Unknown error');
      }
    }

    // Always respond 200 to webhook
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handling error:', error);
    res.status(200).json({ received: true, error: error.message });
  }
};

// Verify payment status (called from frontend after redirect)
const verifyPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    console.log('[Payment Verify] Starting verification for:', reference);

    // Retry logic - try up to 3 times with delays
    let lastError = null;
    let result = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await paymentService.verifyPayment(reference);
        if (result.success || result.pending === false) {
          break; // Got a definitive result
        }
        // If pending, wait and retry
        if (result.pending && attempt < 3) {
          console.log(`[Payment Verify] Attempt ${attempt} - Payment pending, retrying in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err) {
        lastError = err;
        console.error(`[Payment Verify] Attempt ${attempt} failed:`, err.message);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!result && lastError) {
      throw lastError;
    }

    if (result.success) {
      // Payment confirmed - create order atomically (prevents duplicates with webhook)
      const transaction = await paymentService.checkPaymentStatus(reference);
      
      if (!transaction.orderId && transaction.productId && transaction.mobileNumber) {
        // Atomic order creation with retry
        let orderResult = null;
        let lastOrderError = null;

        for (let orderAttempt = 1; orderAttempt <= 3; orderAttempt++) {
          try {
            console.log(`[Payment Verify] Creating order atomically - attempt ${orderAttempt}`);
            orderResult = await createOrderIfNotExists(
              reference,
              transaction.productId,
              transaction.mobileNumber
            );
            if (orderResult.created || orderResult.alreadyExists) {
              console.log('[Payment Verify] Order result:', orderResult.created ? 'created' : 'already exists', orderResult.orderId);
              break;
            }
          } catch (err) {
            lastOrderError = err;
            console.error(`[Payment Verify] Order creation attempt ${orderAttempt} failed:`, err.message);
            if (orderAttempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        if (orderResult && (orderResult.created || orderResult.alreadyExists)) {
          // Trigger Skanka5 auto-processing for newly created orders (fire-and-forget)
          if (orderResult.created) {
            try {
              const prisma = require('../config/db');
              const skanka5Service = require('../services/skanka5Service');
              prisma.order.findUnique({
                where: { id: orderResult.orderId },
                include: { items: true }
              }).then(order => {
                if (order) skanka5Service.triggerProcessing(order).catch(err =>
                  console.error('[Skanka5] Shop payment trigger error:', err.message)
                );
              }).catch(() => {});
            } catch (e) { /* non-blocking */ }
          }

          res.json({
            success: true,
            message: 'Payment verified and order placed!',
            status: 'SUCCESS',
            order: {
              id: orderResult.orderId,
              mobileNumber: transaction.mobileNumber
            }
          });
        } else {
          console.error('[Payment Verify] All order creation attempts failed:', lastOrderError?.message);
          res.json({
            success: true,
            message: 'Payment verified! Order will be processed shortly.',
            status: 'SUCCESS',
            orderPending: true,
            reference: reference
          });
        }
      } else if (transaction.orderId) {
        res.json({
          success: true,
          message: 'Payment already verified',
          status: 'SUCCESS',
          order: { 
            id: transaction.orderId,
            mobileNumber: transaction.mobileNumber
          }
        });
      } else {
        // Payment verified but missing product/mobile info
        res.json({
          success: true,
          message: 'Payment verified! Order will be processed shortly.',
          status: 'SUCCESS',
          orderPending: true,
          reference: reference
        });
      }
    } else if (result.pending) {
      res.json({
        success: false,
        message: 'Payment is still pending. Please complete the payment.',
        status: 'PENDING'
      });
    } else {
      res.json({
        success: false,
        message: 'Payment failed or was abandoned',
        status: 'FAILED'
      });
    }
  } catch (error) {
    console.error('[Payment Verify] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Check payment status
const checkStatus = async (req, res) => {
  try {
    const { externalRef } = req.params;

    if (!externalRef) {
      return res.status(400).json({
        success: false,
        message: 'External reference is required'
      });
    }

    const status = await paymentService.checkPaymentStatus(externalRef);
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all payment transactions (admin)
const getAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await paymentService.getAllPaymentTransactions(page, limit);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const getUnpaidOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const mobileNumber = req.query.mobileNumber;

    const skip = (page - 1) * limit;
    const where = {};

    if (status) {
      where.status = status;
    }

    if (mobileNumber) {
      where.mobileNumber = { contains: mobileNumber };
    }

    let orders = [];
    let total = 0;

    try {
      // Primary query with paymentTransaction include
      [orders, total] = await Promise.all([
        prisma.unpaidOrder.findMany({
          where,
          include: {
            paymentTransaction: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.unpaidOrder.count({ where })
      ]);
    } catch (primaryError) {
      console.warn('[GetUnpaidOrders] Primary query with include failed, falling back:', primaryError.message);
      // Fallback: query without relation include so admin can still see the list
      [orders, total] = await Promise.all([
        prisma.unpaidOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.unpaidOrder.count({ where })
      ]);
    }

    res.json({
      success: true,
      unpaidOrders: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get unpaid orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const getUnpaidOrderStats = async (req, res) => {
  try {
    let pending = 0;
    let paidAwaitingProcessing = 0;
    let failed = 0;
    let expired = 0;
    let reconciled = 0;

    try {
      [pending, paidAwaitingProcessing, failed, expired, reconciled] = await Promise.all([
        prisma.unpaidOrder.count({ where: { status: 'PENDING', paymentStatus: 'UNPAID' } }),
        prisma.unpaidOrder.count({ where: { status: 'PAID', paymentStatus: 'PAID', paymentTransaction: { orderId: null } } }),
        prisma.unpaidOrder.count({ where: { status: 'FAILED' } }),
        prisma.unpaidOrder.count({ where: { status: 'EXPIRED' } }),
        prisma.unpaidOrder.count({ where: { status: { in: ['RECONCILED', 'COMPLETED'] } } })
      ]);
    } catch (primaryError) {
      console.warn('[GetUnpaidOrderStats] Primary query failed, falling back:', primaryError.message);
      // Fallback without relation filter
      [pending, paidAwaitingProcessing, failed, expired, reconciled] = await Promise.all([
        prisma.unpaidOrder.count({ where: { status: 'PENDING', paymentStatus: 'UNPAID' } }),
        prisma.unpaidOrder.count({ where: { status: 'PAID', paymentStatus: 'PAID' } }),
        prisma.unpaidOrder.count({ where: { status: 'FAILED' } }),
        prisma.unpaidOrder.count({ where: { status: 'EXPIRED' } }),
        prisma.unpaidOrder.count({ where: { status: { in: ['RECONCILED', 'COMPLETED'] } } })
      ]);
    }

    res.json({
      success: true,
      stats: {
        pending,
        paidAwaitingProcessing,
        failed,
        expired,
        reconciled,
        total: pending + paidAwaitingProcessing + failed + expired + reconciled
      }
    });
  } catch (error) {
    console.error('Get unpaid order stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const reconcileSingleUnpaidOrder = async (req, res) => {
  try {
    const unpaidOrderId = parseInt(req.params.id);

    if (isNaN(unpaidOrderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid unpaid order ID'
      });
    }

    let unpaidOrder = null;
    try {
      unpaidOrder = await prisma.unpaidOrder.findUnique({
        where: { id: unpaidOrderId },
        include: { paymentTransaction: true }
      });
    } catch (includeError) {
      console.warn('[ReconcileSingle] Include query failed, falling back:', includeError.message);
      unpaidOrder = await prisma.unpaidOrder.findUnique({
        where: { id: unpaidOrderId }
      });
    }

    if (!unpaidOrder) {
      return res.status(404).json({
        success: false,
        message: 'Unpaid order not found'
      });
    }

    const result = await paymentService.verifyAndCreateOrder(unpaidOrder.externalRef, shopService);

    res.json({
      success: !!result.success,
      message: result.success
        ? (result.orderId ? 'Unpaid order reconciled successfully' : result.message || 'Unpaid order checked successfully')
        : (result.error || 'Failed to reconcile unpaid order'),
      result
    });
  } catch (error) {
    console.error('Reconcile single unpaid order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Reconcile orphaned payments - process successful payments without orders
const reconcilePayments = async (req, res) => {
  try {
    console.log('[Payment Reconciliation] Starting reconciliation...');
    
    // Combine two sets:
    //  1. SUCCESS payments missing an order (order creation failed after payment confirmed)
    //  2. PENDING/INITIALIZED payments that may have been paid but never confirmed
    //     in our DB (both webhook and frontend verify failed)
    const [orphanedPayments, stuckPayments] = await Promise.all([
      paymentService.getOrphanedSuccessfulPayments(),
      paymentService.getStuckPendingPayments()
    ]);

    // De-duplicate by externalRef in case a payment appears in both sets
    const seen = new Set();
    const paymentsToProcess = [...orphanedPayments, ...stuckPayments].filter((p) => {
      if (seen.has(p.externalRef)) return false;
      seen.add(p.externalRef);
      return true;
    });

    console.log(`[Payment Reconciliation] Found ${orphanedPayments.length} orphaned + ${stuckPayments.length} stuck = ${paymentsToProcess.length} to process`);

    const results = {
      processed: 0,
      ordersCreated: 0,
      failed: 0,
      details: []
    };

    for (const payment of paymentsToProcess) {
      try {
        const result = await paymentService.verifyAndCreateOrder(payment.externalRef, shopService);
        results.processed++;
        
        if (result.success && result.orderId) {
          results.ordersCreated++;
          results.details.push({
            reference: payment.externalRef,
            status: 'success',
            orderId: result.orderId
          });
        } else if (result.success && result.message === 'Order already exists') {
          results.details.push({
            reference: payment.externalRef,
            status: 'already_exists',
            orderId: result.orderId
          });
        } else {
          results.failed++;
          results.details.push({
            reference: payment.externalRef,
            status: 'failed',
            error: result.error
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          reference: payment.externalRef,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('[Payment Reconciliation] Complete:', results);

    res.json({
      success: true,
      message: `Reconciliation complete. Created ${results.ordersCreated} orders.`,
      ...results
    });
  } catch (error) {
    console.error('[Payment Reconciliation] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Reconciliation failed'
    });
  }
};

// Reconcile ALL unpaid orders including FAILED ones
const reconcileAllUnpaidOrders = async (req, res) => {
  try {
    console.log('[Reconcile All] Starting bulk reconciliation of all unpaid orders...');

    // Get ALL unpaid orders regardless of status
    const unpaidOrders = await prisma.unpaidOrder.findMany({
      where: {
        externalRef: { not: '' }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    console.log(`[Reconcile All] Found ${unpaidOrders.length} unpaid orders to check`);

    const results = {
      total: unpaidOrders.length,
      processed: 0,
      ordersCreated: 0,
      alreadyExisted: 0,
      failed: 0,
      errors: 0,
      details: []
    };

    for (const order of unpaidOrders) {
      try {
        const result = await paymentService.verifyAndCreateOrder(order.externalRef, shopService);
        results.processed++;

        if (result.success && result.orderId) {
          results.ordersCreated++;
          results.details.push({
            reference: order.externalRef,
            status: 'success',
            orderId: result.orderId,
            previousStatus: order.status
          });
        } else if (result.success && result.alreadyExists) {
          results.alreadyExisted++;
          results.details.push({
            reference: order.externalRef,
            status: 'already_exists',
            orderId: result.orderId,
            previousStatus: order.status
          });
        } else {
          results.failed++;
          results.details.push({
            reference: order.externalRef,
            status: 'failed',
            error: result.error,
            previousStatus: order.status
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          reference: order.externalRef,
          status: 'error',
          error: error.message,
          previousStatus: order.status
        });
      }
    }

    console.log('[Reconcile All] Complete:', results);

    res.json({
      success: true,
      message: `Bulk reconciliation complete. Created ${results.ordersCreated} new orders, ${results.alreadyExisted} already existed, ${results.failed} failed, ${results.errors} errors.`,
      ...results
    });
  } catch (error) {
    console.error('[Reconcile All] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Bulk reconciliation failed'
    });
  }
};

// Get orphaned payments (successful payments without orders)
const getOrphanedPayments = async (req, res) => {
  try {
    const orphanedPayments = await paymentService.getOrphanedSuccessfulPayments();
    res.json({
      success: true,
      count: orphanedPayments.length,
      payments: orphanedPayments
    });
  } catch (error) {
    console.error('Get orphaned payments error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  initializePayment,
  handleWebhook,
  verifyPaymentStatus,
  checkStatus,
  getAllTransactions,
  getUnpaidOrders,
  getUnpaidOrderStats,
  reconcileSingleUnpaidOrder,
  reconcileAllUnpaidOrders,
  reconcilePayments,
  getOrphanedPayments
};
