// POST /api/skanka5/webhook — HMAC-SHA256 signed webhook from Skanka5
// Accepts both bulk (items[]) and single-order (flat) payload formats.
// Matches items first by order_code (skanka5OrderCode), then falls back
// to reference (skanka5Ref) — ensuring single orders update automatically.

const express = require('express');
const router = express.Router();
const skanka5Service = require('../services/skanka5Service');

// Skanka5 sends raw JSON body; we need the raw buffer for HMAC verification
router.post('/', express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString(); } }), async (req, res) => {
  try {
    const signature = req.headers['x-skanka5-signature'] || req.headers['x-signature'] || '';
    const payload = req.body;

    console.log('[Skanka5 Webhook] Received payload with', payload.items?.length || 0, 'items');

    const result = await skanka5Service.processWebhook(payload, signature);

    if (result.processed) {
      console.log(`[Skanka5 Webhook] Processed: ${result.updated}/${result.total} items updated`);
    } else {
      console.log(`[Skanka5 Webhook] Skipped: ${result.reason}`);
    }

    // Always return 200 quickly as per Skanka5 docs
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Skanka5 Webhook] Error:', error.message);
    // Still return 200 to prevent Skanka5 from retrying
    res.status(200).json({ received: true, error: 'internal' });
  }
});

module.exports = router;
