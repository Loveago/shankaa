const prisma = require("../config/db");
const { createTransaction } = require("./transactionService");

/**
 * Get counts of pending order items grouped by network (for export UI)
 */
const getPendingCountsByNetwork = async () => {
  // Find all pending OrderItems that have NOT been assigned to any batch yet
  const items = await prisma.orderItem.findMany({
    where: {
      status: "Pending",
      batchId: null
    },
    select: { productName: true, productPrice: true, quantity: true, productDescription: true, product: { select: { name: true, price: true, description: true } } }
  });

  const networks = { MTN: { count: 0, total: 0, gb: 0 }, TELECEL: { count: 0, total: 0, gb: 0 }, "AIRTEL TIGO": { count: 0, total: 0, gb: 0 } };

  for (const item of items) {
    const name = (item.productName || item.product?.name || "").toUpperCase();
    const desc = (item.productDescription || item.product?.description || "").toLowerCase();
    
    // Extract GB from description
    const gbMatch = desc.match(/(\d+(?:\.\d+)?)\s*gb/i);
    const gbValue = gbMatch ? parseFloat(gbMatch[1]) : 0;
    
    for (const net of Object.keys(networks)) {
      if (name.startsWith(net)) {
        networks[net].count++;
        networks[net].total += (item.productPrice || item.product?.price || 0) * item.quantity;
        networks[net].gb += gbValue * item.quantity;
        break;
      }
    }
  }

  return networks;
};

/**
 * Export pending orders by network: creates a batch, links orders, returns rows for Excel
 */
const exportPendingByNetwork = async (adminUserId, network) => {
  return await prisma.$transaction(async (tx) => {
    // Find pending items matching the network that have NOT been assigned to any batch
    const pendingItems = await tx.orderItem.findMany({
      where: {
        status: "Pending",
        batchId: null,
        OR: [
          { productName: { startsWith: network.toUpperCase() } },
          { productName: null, product: { name: { startsWith: network.toUpperCase() } } },
          { productName: "", product: { name: { startsWith: network.toUpperCase() } } }
        ]
      },
      include: {
        order: { include: { user: { select: { id: true, name: true, phone: true } } } },
        product: { select: { id: true, name: true, description: true, price: true } }
      }
    });

    if (pendingItems.length === 0) {
      throw new Error(`No pending orders found for ${network}`);
    }

    // Get distinct order IDs
    const orderIdSet = new Set(pendingItems.map(item => item.orderId));
    const orderIds = [...orderIdSet];

    // Calculate totals including GB
    let totalPrice = 0;
    let totalGb = 0;
    for (const item of pendingItems) {
      totalPrice += (item.productPrice || item.product.price) * item.quantity;
      
      // Extract GB from product description
      const desc = (item.productDescription || item.product.description || "").toLowerCase();
      const gbMatch = desc.match(/(\d+(?:\.\d+)?)\s*gb/i);
      const gbValue = gbMatch ? parseFloat(gbMatch[1]) : 0;
      totalGb += gbValue * item.quantity;
    }

    // Create the batch
    const filename = `${network.toUpperCase()}_export_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.xlsx`;
    const batch = await tx.orderBatch.create({
      data: {
        userId: parseInt(adminUserId),
        filename,
        network: network.toUpperCase(),
        totalItems: pendingItems.length,
        totalPrice,
        totalGb,
        status: "Pending"
      }
    });

    // Link orders to the batch (only if not already linked to another batch)
    await tx.order.updateMany({
      where: { id: { in: orderIds }, batchId: null },
      data: { batchId: batch.id }
    });

    // Set batchId on each exported item AND update status to Processing
    const itemIds = pendingItems.map(item => item.id);
    await tx.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { status: "Processing", batchId: batch.id }
    });

    // Update the batch status to Processing as well
    await tx.orderBatch.update({
      where: { id: batch.id },
      data: { status: "Processing" }
    });

    // Build Excel rows
    const rows = pendingItems.map(item => ({
      orderId: item.orderId,
      itemId: item.id,
      agent: item.order.user?.name || "N/A",
      phone: item.mobileNumber || item.order.mobileNumber || "",
      product: item.productName || item.product.name,
      bundle: item.productDescription || item.product.description,
      price: item.productPrice || item.product.price,
      quantity: item.quantity,
      status: "Processing"
    }));

    return { batch, rows, totalItems: pendingItems.length, totalPrice };
  }, { timeout: 30000 });
};

/**
 * Get all order batches with computed stats
 * NOTE: items/relations are excluded for performance — they are loaded on demand via getBatchById
 */
const getAllBatches = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [totalCount, batches] = await Promise.all([
    prisma.orderBatch.count(),
    prisma.orderBatch.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        filename: true,
        network: true,
        totalItems: true,
        totalPrice: true,
        totalGb: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      }
    })
  ]);

  const result = batches.map(batch => ({
    id: batch.id,
    filename: batch.filename,
    network: batch.network,
    totalItems: batch.totalItems,
    totalPrice: batch.totalPrice,
    totalGb: batch.totalGb || 0,
    status: batch.status,
    createdAt: batch.createdAt,
    exportedBy: batch.user,
  }));

  return {
    batches: result,
    pagination: {
      page, limit, total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

/**
 * Get a specific batch with all its orders and order items
 */
const getBatchById = async (batchId) => {
  const batch = await prisma.orderBatch.findUnique({
    where: { id: parseInt(batchId) },
    include: {
      user: { select: { id: true, name: true } },
      items: {
        include: {
          order: { include: { user: { select: { id: true, name: true, phone: true } } } },
          product: { select: { id: true, name: true, description: true, price: true } }
        }
      }
    }
  });

  if (!batch) throw new Error("Order batch not found");

  // Restructure items into orders format for frontend compatibility
  const orderMap = new Map();
  for (const item of batch.items) {
    const orderId = item.orderId;
    if (!orderMap.has(orderId)) {
      orderMap.set(orderId, {
        id: orderId,
        user: item.order?.user || null,
        items: []
      });
    }
    orderMap.get(orderId).items.push(item);
  }
  batch.orders = [...orderMap.values()];

  return batch;
};

/**
 * Update status of all order items in a batch (auto-refund on cancel)
 */
const updateBatchStatus = async (batchId, newStatus) => {
  const validStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status. Must be: Pending, Processing, Completed, or Cancelled");
  }

  return await prisma.$transaction(async (tx) => {
    const batch = await tx.orderBatch.findUnique({
      where: { id: parseInt(batchId) },
      include: {
        items: {
          include: { order: true, product: true }
        }
      }
    });

    if (!batch) throw new Error("Order batch not found");

    let totalRefund = 0;
    let updatedCount = 0;

    if (newStatus === "Cancelled") {
      // Group items by order for refund processing
      const orderItemsMap = new Map();
      for (const item of batch.items) {
        if (!orderItemsMap.has(item.orderId)) {
          orderItemsMap.set(item.orderId, { order: item.order, items: [] });
        }
        orderItemsMap.get(item.orderId).items.push(item);
      }

      for (const [orderId, { order, items }] of orderItemsMap) {
        const refundReference = `batch_refund:${batchId}:order:${orderId}`;
        const existingRefund = await tx.transaction.findFirst({
          where: { userId: order.userId, type: "ORDER_ITEMS_REFUND", reference: refundReference }
        });

        if (!existingRefund) {
          let orderRefund = 0;
          for (const item of items) {
            if (item.status !== "Cancelled" && item.status !== "Canceled") {
              orderRefund += (item.productPrice || item.product.price) * item.quantity;
            }
          }
          if (orderRefund > 0) {
            await createTransaction(order.userId, orderRefund, "ORDER_ITEMS_REFUND",
              `Batch #${batchId} - Order #${orderId} cancelled & refunded (Amount: ${orderRefund})`,
              refundReference, tx);
            totalRefund += orderRefund;
          }
        }
      }
    }

    // Update all items in this batch by their batchId
    const result = await tx.orderItem.updateMany({
      where: { batchId: parseInt(batchId) },
      data: { status: newStatus }
    });
    updatedCount = result.count;

    await tx.orderBatch.update({
      where: { id: parseInt(batchId) },
      data: { status: newStatus }
    });

    return {
      success: true, batchId: parseInt(batchId), newStatus, updatedItems: updatedCount, totalRefund,
      message: `Batch #${batchId}: ${updatedCount} items updated to ${newStatus}${totalRefund > 0 ? `, refunded GHS ${totalRefund.toFixed(2)}` : ''}`
    };
  }, { timeout: 30000 });
};

/**
 * Update a single order item status within a batch (with refund if cancelled)
 */
const updateBatchOrderItemStatus = async (batchId, itemId, newStatus) => {
  const validStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
  if (!validStatuses.includes(newStatus)) throw new Error("Invalid status");

  return await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: parseInt(itemId) },
      include: { order: true, product: true }
    });

    if (!item) throw new Error("Order item not found");
    if (item.batchId !== parseInt(batchId)) throw new Error("Order item does not belong to this batch");

    if (newStatus === "Cancelled" && item.status !== "Cancelled" && item.status !== "Canceled") {
      const refundReference = `batch_item_refund:${batchId}:item:${itemId}`;
      const existingRefund = await tx.transaction.findFirst({
        where: { userId: item.order.userId, type: "ORDER_ITEM_REFUND", reference: refundReference }
      });

      if (!existingRefund) {
        const refundAmount = (item.productPrice || item.product.price) * item.quantity;
        if (refundAmount > 0) {
          await createTransaction(item.order.userId, refundAmount, "ORDER_ITEM_REFUND",
            `Batch #${batchId} - Item #${itemId} cancelled & refunded (Amount: ${refundAmount})`,
            refundReference, tx);
        }
      }
    }

    const updatedItem = await tx.orderItem.update({
      where: { id: parseInt(itemId) },
      data: { status: newStatus }
    });

    return { success: true, item: updatedItem };
  }, { timeout: 15000 });
};

/**
 * Re-download a batch as Excel (for re-export)
 */
const getBatchForDownload = async (batchId) => {
  const batch = await prisma.orderBatch.findUnique({
    where: { id: parseInt(batchId) },
    include: {
      items: {
        include: {
          order: { include: { user: { select: { name: true } } } },
          product: { select: { name: true, description: true, price: true } }
        }
      }
    }
  });

  if (!batch) throw new Error("Batch not found");

  const rows = batch.items.map(item => ({
    orderId: item.orderId,
    itemId: item.id,
    agent: item.order?.user?.name || "N/A",
    phone: item.mobileNumber || item.order?.mobileNumber || "",
    product: item.productName || item.product.name,
    bundle: item.productDescription || item.product.description,
    price: item.productPrice || item.product.price,
    quantity: item.quantity,
    status: item.status
  }));

  return { batch, rows };
};

/**
 * Update status of multiple batches at once
 */
const updateBatchesStatus = async (batchIds, newStatus) => {
  const validStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status. Must be: Pending, Processing, Completed, or Cancelled");
  }

  let totalUpdated = 0;
  let totalRefund = 0;
  const errors = [];

  for (const batchId of batchIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const batch = await tx.orderBatch.findUnique({
          where: { id: batchId },
          include: {
            items: {
              include: { order: true, product: true }
            }
          }
        });

        if (!batch) {
          errors.push(`Batch #${batchId} not found`);
          return;
        }

        let batchRefund = 0;

        if (newStatus === "Cancelled") {
          const orderItemsMap = new Map();
          for (const item of batch.items) {
            if (!orderItemsMap.has(item.orderId)) {
              orderItemsMap.set(item.orderId, { order: item.order, items: [] });
            }
            orderItemsMap.get(item.orderId).items.push(item);
          }

          for (const [orderId, { order, items }] of orderItemsMap) {
            const refundReference = `batch_refund:${batchId}:order:${orderId}`;
            const existingRefund = await tx.transaction.findFirst({
              where: { userId: order.userId, type: "ORDER_ITEMS_REFUND", reference: refundReference }
            });

            if (!existingRefund) {
              let orderRefund = 0;
              for (const item of items) {
                if (item.status !== "Cancelled" && item.status !== "Canceled") {
                  orderRefund += (item.productPrice || item.product.price) * item.quantity;
                }
              }
              if (orderRefund > 0) {
                await createTransaction(order.userId, orderRefund, "ORDER_ITEMS_REFUND",
                  `Batch #${batchId} - Order #${orderId} cancelled & refunded (Amount: ${orderRefund})`,
                  refundReference, tx);
                batchRefund += orderRefund;
              }
            }
          }
        }

        const result = await tx.orderItem.updateMany({
          where: { batchId: batchId },
          data: { status: newStatus }
        });

        await tx.orderBatch.update({
          where: { id: batchId },
          data: { status: newStatus }
        });

        totalUpdated += result.count;
        totalRefund += batchRefund;
      });
    } catch (err) {
      errors.push(`Batch #${batchId}: ${err.message}`);
    }
  }

  return {
    success: true,
    updatedBatches: batchIds.length,
    updatedItems: totalUpdated,
    totalRefund,
    errors: errors.length > 0 ? errors : undefined,
    message: `${totalUpdated} items across ${batchIds.length} batches updated to ${newStatus}${totalRefund > 0 ? `, refunded GHS ${totalRefund.toFixed(2)}` : ''}${errors.length > 0 ? `. Errors: ${errors.join('; ')}` : ''}`
  };
};

module.exports = {
  getPendingCountsByNetwork,
  exportPendingByNetwork,
  getAllBatches,
  getBatchById,
  updateBatchStatus,
  updateBatchesStatus,
  updateBatchOrderItemStatus,
  getBatchForDownload
};
