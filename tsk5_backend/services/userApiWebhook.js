const axios = require('axios');
const prisma = require('../config/db');

/**
 * Maximum payload size for webhook delivery (64 KB).
 */
const MAX_PAYLOAD_BYTES = 65536;

/**
 * Timeout for each webhook delivery attempt (10 seconds).
 */
const WEBHOOK_TIMEOUT_MS = 10000;

/**
 * Maximum retries per webhook delivery.
 */
const MAX_RETRIES = 3;

/**
 * Build the webhook payload for an order status change.
 */
const buildWebhookPayload = (event, order, orderItems, apiKeyRecord) => ({
  event,
  timestamp: new Date().toISOString(),
  data: {
    orderId: order.id,
    status: order.status,
    totalItems: orderItems.length,
    items: orderItems.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName || item.product?.name,
      quantity: item.quantity,
      price: parseFloat(item.productPrice || item.product?.price || 0),
      mobileNumber: item.mobileNumber,
      status: item.status,
      updatedAt: item.updatedAt || order.createdAt
    })),
    apiKeyName: apiKeyRecord?.name || null,
    createdAt: order.createdAt
  }
});

/**
 * Deliver a webhook payload to a single URL with retry logic.
 * Uses fire-and-forget with background retry.
 */
const deliverWebhook = async (url, payload, retries = MAX_RETRIES) => {
  const payloadStr = JSON.stringify(payload);

  // Reject oversized payloads early
  if (Buffer.byteLength(payloadStr, 'utf-8') > MAX_PAYLOAD_BYTES) {
    console.error(`[Webhook] Payload too large (${Buffer.byteLength(payloadStr, 'utf-8')} bytes) for ${url}`);
    return false;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Shank-API-Webhook/1.0',
          'X-Webhook-Event': payload.event,
          'X-Webhook-Timestamp': payload.timestamp,
          'X-Webhook-Attempt': String(attempt)
        },
        timeout: WEBHOOK_TIMEOUT_MS,
        validateStatus: status => status >= 200 && status < 300
      });

      console.log(`[Webhook] Delivered to ${url} (attempt ${attempt}) — ${response.status}`);
      return true;
    } catch (error) {
      const statusCode = error.response?.status || 'N/A';
      const message = error.code || error.message;
      console.warn(`[Webhook] Attempt ${attempt}/${retries} failed for ${url} — ${statusCode} ${message}`);

      if (attempt < retries) {
        // Exponential backoff: 1s, 3s, 5s
        const delay = attempt * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[Webhook] All ${retries} attempts failed for ${url}`);
  return false;
};

/**
 * Fire a webhook for an order event.
 * Looks up the UserApiKey record from the order's apiKey relation.
 * If the key has a webhookUrl configured and webhookEnabled, delivers the payload.
 */
const fireWebhook = async (event, orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true }
            }
          }
        },
        apiKey: {
          select: { id: true, name: true, webhookUrl: true, webhookEnabled: true }
        }
      }
    });

    if (!order || !order.apiKey) {
      return; // Not an API order or no key linked — nothing to do
    }

    const { apiKey } = order;
    if (!apiKey.webhookEnabled || !apiKey.webhookUrl) {
      return; // Webhook not configured
    }

    const payload = buildWebhookPayload(event, order, order.items, apiKey);

    // Fire-and-forget (with retries handled inside deliverWebhook)
    deliverWebhook(apiKey.webhookUrl, payload).catch(err => {
      console.error(`[Webhook] Unhandled delivery error for order ${orderId}:`, err.message);
    });
  } catch (error) {
    console.error(`[Webhook] Error firing webhook for order ${orderId}:`, error.message);
  }
};

/**
 * Fire an "order.created" webhook.
 */
const fireOrderCreated = async (orderId) => {
  await fireWebhook('order.created', orderId);
};

/**
 * Fire an "order.updated" webhook (status change on one or more items).
 */
const fireOrderUpdated = async (orderId) => {
  await fireWebhook('order.updated', orderId);
};

module.exports = {
  fireOrderCreated,
  fireOrderUpdated,
  deliverWebhook
};
