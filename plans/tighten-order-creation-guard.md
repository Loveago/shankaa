# Tighten Order-Creation Guard

**Goal:** Unpaid orders must never enter the normal order flow. A real `Order` record is only created after Paystack confirms the payment succeeded.

## Current Issue

There are **two separate order-creation code paths**, and one has weaker guards:

| Path | Where | Guard |
|------|-------|-------|
| `createOrderIfNotExists()` | `paymentController.js:8` | ✅ Atomic Prisma `$transaction`, checks `orderId` first |
| `verifyAndCreateOrder()` → `shopService.createShopOrder()` | `paymentService.js:633` | ❌ Direct `shopService` call, no atomic guard |

`verifyAndCreateOrder()` is called from:
- [`index.js:245`](tsk5_backend/index.js:245) — auto-reconciliation (orphaned paid)
- [`index.js:266`](tsk5_backend/index.js:266) — auto-reconciliation (stuck pending)
- [`paymentController.js:500`](tsk5_backend/controllers/paymentController.js:500) — single unpaid-order reconcile
- [`paymentController.js:551`](tsk5_backend/controllers/paymentController.js:551) — bulk reconcile

## Plan

### Step 1 — Move atomic helper into `paymentService.js`

Move `createOrderIfNotExists()` from [`paymentController.js:8-77`](tsk5_backend/controllers/paymentController.js:8) into [`paymentService.js`](tsk5_backend/services/paymentService.js) as a named export.

**Why:** Both the controller handlers AND `verifyAndCreateOrder()` need the same guard. Keeping one copy in the service avoids duplication and makes the guard always available.

**Changes in `paymentService.js`:**
- Add the full `createOrderIfNotExists` function
- Import `shopService.getOrCreateShopUser()` where needed (already imported via the caller pattern)
- Accept `shopService` as a parameter or import it directly

### Step 2 — Replace `shopService.createShopOrder()` inside `verifyAndCreateOrder()`

Change lines 631-653 in [`paymentService.js`](tsk5_backend/services/paymentService.js) from:

```javascript
if (existingTransaction.productId && existingTransaction.mobileNumber) {
  try {
    const order = await shopService.createShopOrder(
      existingTransaction.productId,
      existingTransaction.mobileNumber,
      'Shop Customer'
    );
    await linkTransactionToOrder(reference, order.id);
    ...
```

To:

```javascript
if (existingTransaction.productId && existingTransaction.mobileNumber) {
  try {
    const orderResult = await createOrderIfNotExists(
      reference,
      existingTransaction.productId,
      existingTransaction.mobileNumber
    );
    if (orderResult.created || orderResult.alreadyExists) {
      ...
```

### Step 3 — Update `paymentController.js`

Remove the local `createOrderIfNotExists` definition and import it from `paymentService.js` instead.

**Changes:**
- Remove lines 6-77 (the local `createOrderIfNotExists` + imports)
- Change the `require` at line 1 to destructure: `const { ..., createOrderIfNotExists } = require('../services/paymentService');`

## Result after changes

```
                   ┌─────────────────────────────┐
                   │   User clicks "Pay"           │
                   │   POST /api/payment/initialize │
                   └──────────┬──────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ initializePayment()           │
              │ - PaymentTransaction created  │
              │ - UnpaidOrder created         │
              │ - Redirect to Paystack         │
              └───────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Paystack      │  │ Frontend     │  │ Auto-        │
   │ Webhook      │  │ Verify       │  │ Reconcil.    │
   │ (server)     │  │ (callback)   │  │ (cron)       │
   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
          │                 │                 │
          ▼                 ▼                 ▼
   ┌──────────────────────────────────────────────┐
   │ Paystack verify succeeds?                     │
   └──────────┬───────────────────────┬───────────┘
              │ YES                   │ NO
              ▼                       ▼
   ┌────────────────────┐   ┌────────────────────┐
   │ createOrderIfNotExists│   │ Update UnpaidOrder  │
   │ (atomic guard)     │   │ to FAILED/PENDING   │
   │ Creates real Order │   └────────────────────┘
   │ Links transaction  │
   │ Updates UnpaidOrder│
   │ to PAID            │
   └────────────────────┘

Every real-order creation now goes through the same atomic
createOrderIfNotExists() path — unpaid orders never enter
the order-processing pipeline.
```

## Files changed

1. [`tsk5_backend/services/paymentService.js`](tsk5_backend/services/paymentService.js) — add `createOrderIfNotExists`, update `verifyAndCreateOrder` to use it
2. [`tsk5_backend/controllers/paymentController.js`](tsk5_backend/controllers/paymentController.js) — remove local `createOrderIfNotExists`, import from service
