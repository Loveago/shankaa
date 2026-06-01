const axios = require('axios');
const prisma = require('../config/db');

const SKANKA5_BASE_URL = 'https://agent.skanka5.com/api/v1';

// Network ID mapping from Skanka5 API docs
const NETWORK_MAP = {
  MTN: 3,
  TELECEL: 2,
  VODAFONE: 2,
  AT: 1,
  AIRTELTIGO: 1,
  'AT-ISHARE': 1,
  'AT-BIGTIME': 4
};

const getApiKey = async () => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'skanka5_api_key' } });
  return row?.value || process.env.SKANKA5_API_KEY || null;
};

const isAutoProcessingEnabled = async () => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'auto_process_orders' } });
  return row?.value === 'true';
};

// Detect network_id from product name
const detectNetworkId = (productName) => {
  const name = (productName || '').toUpperCase();
  if (name.includes('MTN')) {
    if (name.includes('AFA')) return 5;
    if (name.includes('EXPRESS')) return 6;
    if (name.includes('NEW')) return 7;
    return 3;
  }
  if (name.includes('TELECEL') || name.includes('VODAFONE')) return 2;
  if (name.includes('AT') && (name.includes('BIGTIME') || name.includes('BIG TIME'))) return 4;
  if (name.includes('AT') || name.includes('AIRTELTIGO') || name.includes('AIRTEL')) return 1;
  return null;
};

// Extract volume in MB from product name/description
const extractVolumeMb = (productName, description) => {
  const text = `${productName || ''} ${description || ''}`.toUpperCase();
  // Match "X.XGB" pattern
  const gbMatch = text.match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (gbMatch) return Math.round(parseFloat(gbMatch[1]) * 1000);
  // Match "XXXXMB" pattern
  const mbMatch = text.match(/(\d+)\s*MB/i);
  if (mbMatch) return parseInt(mbMatch[1]);
  return null;
};

// Clean phone number for Skanka5 (remove +, spaces, leading 233/0)
const cleanMsisdn = (phone) => {
  let cleaned = (phone || '').replace(/[\s\-+]/g, '');
  if (cleaned.startsWith('233') && cleaned.length === 12) return '0' + cleaned.slice(3);
  if (cleaned.length === 9) return '0' + cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 10) return cleaned;
  return cleaned;
};

// Submit a single order to Skanka5
const submitOrder = async (networkId, msisdn, volumeMb) => {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('Skanka5 API key not configured');

  try {
    const response = await axios({
      method: 'POST',
      url: `${SKANKA5_BASE_URL}/orders`,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        network_id: networkId,
        msisdn: msisdn,
        volume_mb: volumeMb
      },
      timeout: 30000
    });

    return response.data; // { success, reference, status, orders: [...] }
  } catch (error) {
    if (error.response) {
      console.error('[Skanka5] Submit error:', error.response.status, error.response.data);
      throw new Error(error.response.data?.message || `API error ${error.response.status}`);
    }
    throw error;
  }
};

// Submit a bulk order to Skanka5
const submitBulkOrder = async (networkId, recipients) => {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('Skanka5 API key not configured');

  try {
    const response = await axios({
      method: 'POST',
      url: `${SKANKA5_BASE_URL}/orders/bulk`,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        network_id: networkId,
        recipients: recipients
      },
      timeout: 30000
    });

    return response.data; // { success, reference, status, accepted, rejected, total_cost, orders: [...] }
  } catch (error) {
    if (error.response) {
      console.error('[Skanka5] Bulk submit error:', error.response.status, error.response.data);
      throw new Error(error.response.data?.message || `API error ${error.response.status}`);
    }
    throw error;
  }
};

// Check order status from Skanka5
const checkOrderStatus = async (reference) => {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('Skanka5 API key not configured');

  try {
    const response = await axios({
      method: 'GET',
      url: `${SKANKA5_BASE_URL}/orders/${reference}`,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return response.data; // { reference, items: [{ beneficiary_number, status, api_status, volume, network }] }
  } catch (error) {
    if (error.response?.status === 404) {
      return { reference, items: [], notFound: true };
    }
    console.error('[Skanka5] Status check error:', error.message);
    throw error;
  }
};

// Map Skanka5 status to our OrderItem status
const mapSkanka5Status = (skanka5Item) => {
  // status: 0 = pending/processing, positive = delivered, etc.
  // api_status: "success", "failed", "pending", etc.
  if (skanka5Item.api_status === 'success' || skanka5Item.status > 0) return 'Completed';
  if (skanka5Item.api_status === 'failed' || skanka5Item.status < 0) return 'Cancelled';
  if (skanka5Item.api_status === 'pending') return 'Processing';
  // Default to Processing for accepted orders
  return 'Processing';
};

// Process a list of order items through Skanka5
// Groups items by network, submits in bulk per network, and stores references
const processOrderItems = async (orderItems) => {
  const enabled = await isAutoProcessingEnabled();
  if (!enabled) {
    console.log('[Skanka5] Auto-processing disabled, skipping');
    return { processed: false, reason: 'disabled' };
  }

  // Filter only supported networks (MTN, Telecel, AirtelTigo)
  const skanka5Items = [];
  for (const item of orderItems) {
    const productName = item.productName || item.product?.name || '';
    const description = item.productDescription || item.product?.description || '';
    const networkId = detectNetworkId(productName);
    const volumeMb = extractVolumeMb(productName, description);
    const msisdn = cleanMsisdn(item.mobileNumber);

    if (networkId && volumeMb && msisdn) {
      skanka5Items.push({
        itemId: item.id,
        networkId,
        msisdn,
        volumeMb,
        productName
      });
    }
  }

  if (skanka5Items.length === 0) {
    console.log('[Skanka5] No eligible items for auto-processing (MTN/Telecel/AT only)');
    return { processed: false, reason: 'no-eligible-items' };
  }

  // Group by network
  const byNetwork = {};
  for (const si of skanka5Items) {
    if (!byNetwork[si.networkId]) byNetwork[si.networkId] = [];
    byNetwork[si.networkId].push(si);
  }

  const results = { processed: true, references: [], errors: [] };

  for (const [networkId, items] of Object.entries(byNetwork)) {
    try {
      const recipients = items.map(i => ({ msisdn: i.msisdn, volume_mb: i.volumeMb }));
      const response = await submitBulkOrder(parseInt(networkId), recipients);

      if (response.success && response.reference) {
        results.references.push(response.reference);

        // Store Skanka5 reference on each OrderItem
        if (response.orders) {
          for (let i = 0; i < response.orders.length && i < items.length; i++) {
            const skOrder = response.orders[i];
            const ourItem = items[i];

            // Update the order item with Skanka5 reference
            await prisma.orderItem.update({
              where: { id: ourItem.itemId },
              data: {
                skanka5Ref: response.reference,
                skanka5OrderCode: skOrder.order_code || null,
                skanka5Status: skOrder.status || 'accepted',
                status: 'Processing' // Mark as Processing since Skanka5 accepted it
              }
            });
          }
        } else {
          // No per-item response, just store reference on all items
          for (const ourItem of items) {
            await prisma.orderItem.update({
              where: { id: ourItem.itemId },
              data: {
                skanka5Ref: response.reference,
                skanka5Status: 'accepted',
                status: 'Processing'
              }
            });
          }
        }

        console.log(`[Skanka5] Submitted ${items.length} items to network ${networkId}, ref: ${response.reference}`);
      } else {
        results.errors.push({ networkId, error: 'No reference returned' });
      }
    } catch (error) {
      console.error(`[Skanka5] Failed network ${networkId}:`, error.message);
      results.errors.push({ networkId, error: error.message });
    }
  }

  return results;
};

// Trigger async processing - fire and forget after order creation
const triggerProcessing = async (order) => {
  try {
    // Extract order items (items array from the order)
    const items = order.items || [];
    if (items.length === 0) return;

    await processOrderItems(items);
  } catch (error) {
    console.error('[Skanka5] Trigger processing error:', error.message);
  }
};

// Background poller: check all pending Skanka5 orders and update statuses
const pollPendingOrders = async () => {
  const enabled = await isAutoProcessingEnabled();
  if (!enabled) return { polled: 0, updated: 0, reason: 'disabled' };

  try {
    // Find all distinct references that are still pending
    const pendingItems = await prisma.orderItem.findMany({
      where: {
        skanka5Ref: { not: null },
        skanka5Status: { notIn: ['success', 'failed', 'Completed', 'Cancelled'] },
        status: { in: ['Processing', 'Pending'] }
      },
      select: {
        id: true,
        skanka5Ref: true,
        skanka5Status: true,
        mobileNumber: true
      },
      orderBy: { id: 'asc' }
    });

    if (pendingItems.length === 0) return { polled: 0, updated: 0 };

    // Deduplicate by reference
    const uniqueRefs = [...new Set(pendingItems.map(i => i.skanka5Ref).filter(Boolean))];

    let totalUpdated = 0;

    for (const ref of uniqueRefs) {
      try {
        const status = await checkOrderStatus(ref);

        if (status.notFound) {
          console.log(`[Skanka5] Reference ${ref} not found on Skanka5`);
          continue;
        }

        if (!status.items || status.items.length === 0) continue;

        // Map Skanka5 items by beneficiary_number
        const skanka5ByPhone = {};
        for (const skItem of status.items) {
          const phone = cleanMsisdn(skItem.beneficiary_number);
          skanka5ByPhone[phone] = skItem;
        }

        // Update our order items that match this reference
        const ourItems = pendingItems.filter(i => i.skanka5Ref === ref);

        for (const item of ourItems) {
          const phone = cleanMsisdn(item.mobileNumber);
          const match = skanka5ByPhone[phone];

          if (match) {
            const newStatus = mapSkanka5Status(match);

            await prisma.orderItem.update({
              where: { id: item.id },
              data: {
                skanka5Status: match.api_status || match.status?.toString() || 'unknown',
                status: newStatus
              }
            });

            if (newStatus === 'Completed' || newStatus === 'Cancelled') {
              totalUpdated++;
              console.log(`[Skanka5] Item ${item.id} → ${newStatus} (ref: ${ref}, phone: ${phone})`);
            }
          }
        }
      } catch (error) {
        console.error(`[Skanka5] Poll error for ref ${ref}:`, error.message);
      }
    }

    return { polled: uniqueRefs.length, updated: totalUpdated };
  } catch (error) {
    console.error('[Skanka5] Poll error:', error.message);
    return { polled: 0, updated: 0, error: error.message };
  }
};

const crypto = require('crypto');

// Get webhook secret from settings
const getWebhookSecret = async () => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'skanka5_webhook_secret' } });
  return row?.value || process.env.SKANKA5_WEBHOOK_SECRET || null;
};

// Verify HMAC-SHA256 signature from Skanka5 webhook
const verifyWebhookSignature = (payload, signature, secret) => {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

// Process incoming Skanka5 webhook — expects JSON body with items[]
// Webhook fires only for bulk orders (5+ recipients), matching by order_code
const processWebhook = async (payload, signature) => {
  const enabled = await isAutoProcessingEnabled();
  if (!enabled) {
    console.log('[Skanka5 Webhook] Auto-processing disabled, ignoring');
    return { processed: false, reason: 'disabled' };
  }

  const secret = await getWebhookSecret();
  if (secret) {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      console.error('[Skanka5 Webhook] Invalid HMAC signature');
      return { processed: false, reason: 'invalid-signature' };
    }
  }

  const items = payload.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { processed: false, reason: 'no-items' };
  }

  let updated = 0;
  for (const skItem of items) {
    if (!skItem.order_code) continue;

    try {
      // Match by skanka5OrderCode stored during initial submission
      const ourItem = await prisma.orderItem.findFirst({
        where: { skanka5OrderCode: skItem.order_code },
        select: { id: true, status: true }
      });

      if (!ourItem) continue;

      const newStatus = mapSkanka5Status({
        api_status: skItem.api_status,
        status: skItem.status
      });

      await prisma.orderItem.update({
        where: { id: ourItem.id },
        data: {
          skanka5Status: skItem.api_status || skItem.status?.toString() || 'unknown',
          status: newStatus
        }
      });

      console.log(`[Skanka5 Webhook] Item ${ourItem.id} (${skItem.order_code}) → ${newStatus}`);
      updated++;
    } catch (error) {
      console.error(`[Skanka5 Webhook] Error processing ${skItem.order_code}:`, error.message);
    }
  }

  return { processed: true, updated, total: items.length };
};

module.exports = {
  submitOrder,
  submitBulkOrder,
  checkOrderStatus,
  processOrderItems,
  triggerProcessing,
  pollPendingOrders,
  processWebhook,
  isAutoProcessingEnabled,
  getApiKey,
  getWebhookSecret,
  verifyWebhookSignature,
  detectNetworkId,
  extractVolumeMb,
  cleanMsisdn
};
