const {
  submitCart,
  getOrderStatus,
  processOrderItem,
  getAllOrders,
  processOrder,
  getUserCompletedOrders,
  getOrderHistory,
  updateOrderItemsStatus,
  updateSingleOrderItemStatus,
  downloadOrdersForExcel,
  getOrderTrackerData,
  cancelOrderItem,
} = require("../services/orderService");

const orderService = require('../services/orderService');
const path = require('path');
const prisma = require('../config/db');

const formatOrderExportWorksheet = (ws) => {
  ws['!cols'] = [{ wch: 22 }, { wch: 16 }];
  ws['!autofilter'] = { ref: 'A1:B1' };

  if (!ws['!ref']) return;

  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'D9D9D9' } },
    bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
    left: { style: 'thin', color: { rgb: 'D9D9D9' } },
    right: { style: 'thin', color: { rgb: 'D9D9D9' } },
  };

  const range = xlsx.utils.decode_range(ws['!ref']);

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= Math.min(range.e.c, 1); col++) {
      const cellRef = xlsx.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellRef];
      if (!cell) continue;

      if (row === range.s.r) {
        cell.t = 's';
        cell.s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'D78C1E' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder,
        };
        continue;
      }

      if (col === 0) {
        cell.t = 's';
        cell.z = '@';
        if (cell.v != null) cell.v = String(cell.v);
      }

      cell.s = {
        alignment: {
          horizontal: col === 0 ? 'left' : 'center',
          vertical: 'center',
        },
        border: thinBorder,
      };
    }
  }
};

// ==================== USER BULK ORDERS (Pasted / Excel / Multi-item) ====================
const deriveAggregateStatus = (items = []) => {
  if (!items.length) return 'Pending';
  const statusCounts = { Pending: 0, Processing: 0, Completed: 0, Cancelled: 0, Canceled: 0 };
  items.forEach((i) => {
    const s = i.status || 'Pending';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  if (statusCounts.Completed === items.length) return 'Completed';
  if (statusCounts.Cancelled + statusCounts.Canceled === items.length) return 'Cancelled';
  if (statusCounts.Processing > 0) return 'Processing';
  return 'Pending';
};

const normalizeNetworkLabel = (productName = '') => {
  const raw = String(productName || '').trim().toUpperCase();
  if (!raw) return 'N/A';
  if (raw.startsWith('MTN')) return 'MTN';
  if (raw.startsWith('TELECEL')) return 'TELECEL';
  if (raw.startsWith('AIRTEL')) return 'AIRTEL TIGO';
  return raw.split(' ')[0];
};

exports.getUserBulkOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          select: {
            id: true,
            status: true,
            productName: true,
            productDescription: true,
            productPrice: true,
            quantity: true,
            mobileNumber: true,
            product: { select: { name: true, description: true, price: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    const extractGBFromItem = (it) => {
      const desc = (it.productDescription || it.productName || it.product?.description || it.product?.name || '').toLowerCase();
      const gbMatch = desc.match(/(\d+(?:\.\d+)?)\s*gb/i);
      return gbMatch ? parseFloat(gbMatch[1]) : 0;
    };

    const bulkOrders = orders
      .filter((o) => (o._count?.items || o.items.length) >= 2)
      .map((o) => {
        const totalItems = o._count?.items || o.items.length;
        let totalPrice = 0;
        let totalGB = 0;
        o.items.forEach((it) => {
          const price = it.productPrice ?? it.product?.price ?? 0;
          totalPrice += price * (it.quantity || 1);
          totalGB += extractGBFromItem(it) * (it.quantity || 1);
        });
        const firstItem = o.items[0] || {};
        return {
          id: o.id,
          orderNumber: o.orderNumber || `#${o.id}`,
          createdAt: o.createdAt,
          totalItems,
          totalPrice,
          totalGB,
          status: deriveAggregateStatus(o.items),
          network: normalizeNetworkLabel(firstItem.productName || firstItem.product?.name || ''),
        };
      });

    res.json({ success: true, orders: bulkOrders });
  } catch (error) {
    console.error('Error fetching bulk orders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserBulkOrderDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = parseInt(req.params.orderId);
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            status: true,
            productName: true,
            productDescription: true,
            productPrice: true,
            quantity: true,
            mobileNumber: true,
            product: { select: { name: true, description: true, price: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    if (!order || (order._count?.items || order.items.length) < 2) {
      return res.status(404).json({ success: false, message: 'Bulk order not found' });
    }

    // Fetch complaint status for each order item
    const itemIds = order.items.map(it => it.id);
    const complaints = await prisma.complaint.findMany({
      where: { orderItemId: { in: itemIds } },
      select: {
        orderItemId: true,
        id: true,
        status: true,
        refundStatus: true,
        refundedAt: true,
        createdAt: true,
      }
    });
    const complaintMap = {};
    for (const c of complaints) {
      complaintMap[c.orderItemId] = { complaintId: c.id, status: c.status, refundStatus: c.refundStatus, refundedAt: c.refundedAt, createdAt: c.createdAt };
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber || `#${order.id}`,
        createdAt: order.createdAt,
        status: deriveAggregateStatus(order.items),
        items: order.items.map((it, idx) => ({
          id: it.id,
          itemNumber: `${order.orderNumber || `#${order.id}`}-${idx + 1}`,
          status: it.status,
          productName: it.productName || it.product?.name,
          productDescription: it.productDescription || it.product?.description,
          productPrice: it.productPrice ?? it.product?.price ?? 0,
          quantity: it.quantity || 1,
          mobileNumber: it.mobileNumber || '',
          network: normalizeNetworkLabel(it.productName || it.product?.name || ''),
          complaint: complaintMap[it.id] || null,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching bulk order detail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reportBulkOrderIssue = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = parseInt(req.params.orderId);
    const itemId = parseInt(req.params.itemId);
    const { message = 'Customer did not receive bundle' } = req.body || {};

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });

    if (!order || (order.items?.length || 0) < 2) {
      return res.status(404).json({ success: false, message: 'Bulk order not found' });
    }

    const item = order.items.find((it) => it.id === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found' });
    }

    // Only completed orders can be reported
    if (item.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Only completed orders can be reported' });
    }

    // Check 48-hour lock: if item was completed more than 48 hours ago, reject
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
    if (item.updatedAt) {
      const elapsed = Date.now() - new Date(item.updatedAt).getTime();
      if (elapsed > FORTY_EIGHT_HOURS_MS) {
        return res.status(400).json({
          success: false,
          message: 'This order was completed more than 48 hours ago. You can no longer report it as not received.'
        });
      }
    }

    // Check if complaint already exists for this order item
    const existingComplaint = await prisma.complaint.findFirst({
      where: { orderItemId: itemId, status: { in: ['pending', 'reviewed'] } }
    });

    if (existingComplaint) {
      return res.json({ success: true, complaint: existingComplaint, message: 'Complaint already submitted' });
    }

    const complaint = await prisma.complaint.create({
      data: {
        orderId: String(orderId),
        orderItemId: itemId,
        mobileNumber: item.mobileNumber || '',
        message,
        status: 'pending',
        refundStatus: 'none',
        complaintDate: new Date(),
        complaintTime: new Date().toTimeString().slice(0, 5),
        adminNotes: `Bulk order item ${itemId} report`,
      },
    });

    // Emit real-time notification to admin
    try {
      const { io } = require('../index');
      io.emit('new-complaint', { complaintId: complaint.id, mobileNumber: complaint.mobileNumber });
    } catch (e) { /* socket emit is best-effort */ }

    res.json({ success: true, complaint });
  } catch (error) {
    console.error('Error reporting bulk order issue:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const buildSheetName = (network) => {
  const networkLabel = String(network || 'Orders').trim().toUpperCase() || 'ORDERS';
  return `${networkLabel} Bulk Orders`.slice(0, 31);
};

exports.submitCart = async (req, res) => {
  try {
    const { userId, mobileNumber } = req.body;

    const order = await submitCart(userId, mobileNumber);

    // Trigger Skanka5 auto-processing (fire-and-forget)
    try {
      const skanka5Service = require('../services/skanka5Service');
      skanka5Service.triggerProcessing(order).catch(err =>
        console.error('[Skanka5] Agent cart trigger error:', err.message)
      );
    } catch (e) { /* non-blocking */ }

    // Emit real-time notification to admin
    try {
      const { io } = require('../index');
      io.emit('new-order', { orderId: order.id, userId, itemCount: order.items?.length || 0 });
    } catch (e) { /* socket emit is best-effort */ }

    res.status(201).json({
      success: true,
      message: "Order submitted successfully",
      order,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await getAllOrders(parseInt(limit), parseInt(offset));
    
    // Transform data to match frontend expectations
    const transformedData = result.orders.flatMap(order => 
      order.items.map(item => ({
        ...item,
        orderId: order.id,
        createdAt: order.createdAt,
        user: order.user,
        order: {
          ...order,
          items: [item] // Only include current item to avoid status mix-ups
        }
      }))
    );
    
    res.json(transformedData);
  } catch (error) {
    console.error('Error in getAllOrders:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderStatus = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      orderIdFilter,
      phoneNumberFilter,
      selectedProduct,
      selectedStatusMain,
      selectedDate,
      startTime,
      endTime,
      sortOrder = 'newest',
      showNewRequestsOnly = false,
      sourceFilter
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      orderIdFilter,
      phoneNumberFilter,
      selectedProduct,
      selectedStatusMain,
      selectedDate,
      startTime,
      endTime,
      sortOrder,
      showNewRequestsOnly: showNewRequestsOnly === 'true',
      sourceFilter
    };

    const result = await getOrderStatus(options);
    res.json(result);
  } catch (error) {
    console.error('Error in getOrderStatus:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.processOrderItem = async (req, res) => {
  const { orderItemId, status } = req.body;
  try {
    const updatedItem = await processOrderItem(orderItemId, status);
    res.json({ message: "Order item status updated", updatedItem });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.processOrderController = async (req, res) => {
  const { status } = req.body;
  try {
    const updatedOrder = await processOrder(
      parseInt(req.params.orderId),
      status
    );
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserCompletedOrdersController = async (req, res) => {
  try {
    const orders = await getUserCompletedOrders(parseInt(req.params.userId));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId); // Get userId from request params

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Users can only view their own order history; admins can view any
    if (req.user.role?.toUpperCase() !== 'ADMIN' && req.user.id !== userId) {
      return res.status(403).json({ error: "You can only view your own order history" });
    }

    const orders = await getOrderHistory(userId);

    if (!orders.length) {
      return res.status(404).json({ message: "No order history found" });
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};





exports.updateOrderItemsStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    // Validate inputs
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }
    
    if (!status) {
      return res.status(400).json({ success: false, message: "New status is required" });
    }
    
    // Validate status is one of the allowed values
    const allowedStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Status must be one of: ${allowedStatuses.join(", ")}` 
      });
    }
    
    const result = await updateOrderItemsStatus(orderId, status);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to update order items status" 
    });
  }
}

exports.updateSingleOrderItemStatus = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ success: false, message: "Item ID is required" });
    }
    
    if (!status) {
      return res.status(400).json({ success: false, message: "New status is required" });
    }
    
    const allowedStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Status must be one of: ${allowedStatuses.join(", ")}` 
      });
    }
    
    const result = await updateSingleOrderItemStatus(itemId, status);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to update order item status" 
    });
  }
}

exports.getOrders = async (req, res) => {
  try {
    const { 
      page, 
      limit,
      startDate,
      endDate,
      status,
      product,
      mobileNumber
    } = req.query;
    
    const filters = {
      startDate,
      endDate,
      status,
      product,
      mobileNumber
    };
    
    const result = await orderService.getOrdersPaginated({
      page,
      limit,
      filters
    });
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: error.message });
  }
},

// Excel Upload Controller for Agent Orders
exports.uploadExcelOrders = async (req, res) => {
  const prisma = require('../config/db');
  const userService = require('../services/userService');
  const productService = require('../services/productService');
  const cartService = require('../services/cartService');
  const xlsx = require('xlsx');
  const fs = require('fs');

  try {
    const { agentId, network } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    if (!agentId || !network) {
      return res.status(400).json({ success: false, message: 'Missing agentId or network.' });
    }

    // Parse Excel file
    const filePath = req.file.path;
    let data = [];
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: 'Failed to parse Excel file.' });
    }

    let total = data.length;
    let errorReport = [];

    // Fetch agent/user and role
    const agent = await userService.getUserById(parseInt(agentId));
    if (!agent) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, message: 'Agent not found.' });
    }
    const userRole = agent.role;
    const username = agent.name;

    // Validate all rows before adding to cart
    let productsToAdd = [];
    let totalCost = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const phoneNumber = row['phone'] ? String(row['phone']).trim() : '';
      const item = row['item'] ? String(row['item']).trim() : '';
      const bundleAmount = row['bundle amount'] ? String(row['bundle amount']).trim() : '';
      const quantity = 1;
      let rowErrors = [];
      if (!phoneNumber) rowErrors.push('Missing phone');
      if (!item) rowErrors.push('Missing item (e.g: MTN - SUPERAGENT)');
      if (!bundleAmount) rowErrors.push('Missing bundle amount (e.g: 50GB)');
      // Lookup product by item and bundle amount
      let product = await prisma.product.findFirst({
        where: {
          name: item,
          description: bundleAmount
        },
      });
      if (!product) {
        rowErrors.push('Product not found for item: ' + item + ' and bundle amount: ' + bundleAmount);
      }
      // Get price for user role
      let finalPrice = null;
      if (product) {
        finalPrice = productService.getPriceForUserRole(userRole, product);
        if (finalPrice == null) {
          rowErrors.push('Price could not be determined for user role and product.');
        }
      }
      // Check stock
      if (product && product.stock < quantity) {
        rowErrors.push('Not enough stock for product: ' + item + ' (' + bundleAmount + ')');
      }
      // Accumulate total cost
      if (finalPrice && rowErrors.length === 0) {
        totalCost += finalPrice * quantity;
        productsToAdd.push({ product, quantity, phoneNumber, price: finalPrice });
      } else if (rowErrors.length > 0) {
        errorReport.push({ row: i + 2, errors: rowErrors });
      }
    }

    // Check wallet balance
    if (productsToAdd.length > 0 && agent.walletBalance !== undefined) {
      if (agent.walletBalance < totalCost) {
        errorReport.push({ row: 'ALL', errors: ['Insufficient wallet balance for total order. Required: ' + totalCost + ', Available: ' + agent.walletBalance] });
      }
    }

    // If any errors, do not add to cart
    if (errorReport.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, errorReport });
    }

    // All validations passed, add to cart
    let added = 0;
    for (const item of productsToAdd) {
      await cartService.addItemToCart(agent.id, item.product.id, item.quantity, item.phoneNumber, agent.role);
      added++;
    }
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: `${added} products added to cart.`, summary: { total, added } });
  } catch (err) {
    if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const stats = await orderService.getOrderStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: error.message });
  }
},

exports.downloadSimplifiedTemplate = (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'order_template.xlsx');
  res.download(filePath, 'order_template.xlsx', (err) => {
    if (err) {
      console.error("Error downloading template:", err);
      res.status(500).send("Could not download the file.");
    }
  });
};

// New Excel Upload Controller for Simplified (2-column) Agent Orders
exports.uploadSimplifiedExcelOrders = async (req, res) => {
  const prisma = require('../config/db');
  const userService = require('../services/userService');
  const cartService = require('../services/cartService');
  const xlsx = require('xlsx');
  const fs = require('fs');

  try {
    const { agentId, network } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    if (!agentId || !network) {
      return res.status(400).json({ success: false, message: 'Missing agentId or network.' });
    }

    const filePath = req.file.path;
    let data = [];
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: 'Failed to parse Excel file.' });
    }

    let total = data.length;
    let errorReport = [];

    const agent = await userService.getUserById(parseInt(agentId));
    if (!agent) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, message: 'Agent not found.' });
    }
    const userRole = agent.role; 

    let productsToAdd = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Support multiple column name variations (case-insensitive)
      const getColumnValue = (row, possibleNames) => {
        for (const name of possibleNames) {
          // Check exact match first
          if (row[name] !== undefined) return String(row[name]).trim();
          // Check case-insensitive match
          const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
          if (key && row[key] !== undefined) return String(row[key]).trim();
        }
        return '';
      };
      
      const phoneNumber = getColumnValue(row, ['phone', 'Phone', 'PHONE', 'phone_number', 'Phone Number', 'phoneNumber']);
      const bundleAmount = getColumnValue(row, ['bundle_amount', 'bundle amount', 'Bundle_Amount', 'Bundle Amount', 'BUNDLE_AMOUNT', 'BUNDLE AMOUNT', 'bundle', 'Bundle', 'amount', 'Amount', 'data', 'Data', 'gb', 'GB']);
      
      let rowErrors = [];

      if (!phoneNumber) rowErrors.push('Missing phone number.');
      if (!bundleAmount || isNaN(parseFloat(bundleAmount))) rowErrors.push(`Invalid or missing bundle amount. It must be a number. Got: "${bundleAmount}"`);

      if(rowErrors.length > 0) {
        errorReport.push({ row: i + 2, errors: rowErrors });
        continue; // Skip to next row
      }

      const productDescription = `${bundleAmount}GB`;
      let productName;
      if (userRole.toUpperCase() === 'USER') {
        // For 'USER' role, product name is just the network
        productName = network.toUpperCase();
      } else {
        // For all other roles, it's 'NETWORK - ROLE'
        productName = `${network.toUpperCase()} - ${userRole.toUpperCase()}`;
      }

      const product = await prisma.product.findFirst({
        where: {
          name: productName,
          description: productDescription,
        },
      });

      if (!product) {
        rowErrors.push(`Product not found for your user type (${userRole}) with bundle ${productDescription} and network ${network}.`);
      } else {
          productsToAdd.push({ 
              product, 
              quantity: 1, // Quantity is always 1 in the new flow
              phoneNumber 
            });
      }

      if (rowErrors.length > 0) {
        errorReport.push({ row: i + 2, errors: rowErrors });
      }
    }

    if (errorReport.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors occurred.',
        summary: { total, successful: total - errorReport.length, failed: errorReport.length },
        errors: errorReport 
      });
    }

    // All validations passed — add to cart
    const productService = require('../services/productService');
    const cartService = require('../services/cartService');

    let added = 0;
    for (const item of productsToAdd) {
      await cartService.addItemToCart(agent.id, item.product.id, item.quantity || 1, item.phoneNumber, agent.role);
      added++;
    }

    fs.unlinkSync(filePath);
    return res.json({ 
        success: true, 
        message: `${added} products added to cart.`,
        summary: { total, successful: added, failed: 0 }
    });

  } catch (err) {
    if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const updatedOrder = await orderService.updateOrderStatus(orderId, status);
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: error.message });
  }
}

// Direct order creation from ext_agent system
exports.createDirectOrder = async (req, res) => {
  try {
    const { userId, items, totalAmount } = req.body;
    
    // Validate required fields
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: userId, items array' 
      });
    }

    const order = await orderService.createDirectOrder(userId, items, totalAmount);

    // Trigger Skanka5 auto-processing (fire-and-forget)
    try {
      const skanka5Service = require('../services/skanka5Service');
      skanka5Service.triggerProcessing(order).catch(err =>
        console.error('[Skanka5] Direct order trigger error:', err.message)
      );
    } catch (e) { /* non-blocking */ }

    // Emit real-time notification to admin
    try {
      const { io } = require('../index');
      io.emit('new-order', { orderId: order.id, userId, itemCount: items?.length || 0 });
    } catch (e) { /* socket emit is best-effort */ }

    res.status(201).json({
      success: true,
      message: "Direct order created successfully",
      orderId: order.id,
      order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Get specific order by ID for status sync
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const prisma = require('../config/db');
    
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, description: true, price: true }
            }
          }
        },
        user: {
          select: { id: true, name: true, email: true, phone: true }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order ${orderId} not found`
      });
    }

    // Transform to match expected format
    const matchingOrders = order.items.map(item => ({
      id: item.id,
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      mobileNumber: item.mobileNumber || order.mobileNumber,
      user: order.user,
      product: item.product,
      order: {
        id: order.id,
        createdAt: order.createdAt,
        items: [{ status: item.status }]
      }
    }));
    
    res.json({
      success: true,
      data: matchingOrders,
      orderId: parseInt(orderId),
      itemCount: matchingOrders.length
    });
  } catch (error) {
    console.error(`[GET ORDER] Error fetching order ${req.params.orderId}:`, error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// Get multiple orders by IDs for GB calculation
exports.getOrdersByIds = async (req, res) => {
  try {
    const { orderIds } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order IDs array is required'
      });
    }

    const orders = await orderService.getOrdersByIds(orderIds);
    
    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error(`❌ [GET ORDERS BY IDS] Error:`, error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// Batch complete all processing orders (respects filters)
exports.batchCompleteProcessing = async (req, res) => {
  try {
    const { selectedProduct, selectedDate, sourceFilter, phoneNumberFilter, orderIdFilter, startTime, endTime } = req.body;
    const result = await orderService.batchCompleteProcessingOrders({
      selectedProduct, selectedDate, sourceFilter, phoneNumberFilter, orderIdFilter, startTime, endTime
    });
    res.json({
      success: true,
      message: `Successfully completed ${result.count} processing orders`,
      count: result.count
    });
  } catch (error) {
    console.error(`❌ [BATCH COMPLETE] Error:`, error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// Order tracker data with balance tracking and fraud detection
exports.getOrderTracker = async (req, res) => {
  try {
    const { agentId, productId, startDate, endDate, startTime, endTime } = req.query;
    const result = await getOrderTrackerData({ agentId, productId, startDate, endDate, startTime, endTime });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in getOrderTracker:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Download orders for Excel and update pending to processing
exports.downloadOrdersForExcel = async (req, res) => {
  try {
    const { statusFilter, selectedProduct, selectedDate, sortOrder, sourceFilter, phoneNumberFilter, orderIdFilter, startTime, endTime } = req.query;
    const result = await downloadOrdersForExcel({
      statusFilter, selectedProduct, selectedDate, sortOrder,
      sourceFilter, phoneNumberFilter, orderIdFilter, startTime, endTime
    });
    res.json(result);
  } catch (error) {
    console.error('Error in downloadOrdersForExcel:', error);
    res.status(500).json({ error: error.message });
  }
}

exports.cancelOrderItem = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const orderItemId = parseInt(req.params.itemId);
    const result = await cancelOrderItem(userId, orderItemId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ==================== ORDER BATCH (Order Files) ====================
const orderBatchService = require('../services/orderBatchService');
const xlsx = require('xlsx');

exports.getPendingCounts = async (req, res) => {
  try {
    const counts = await orderBatchService.getPendingCountsByNetwork();
    res.json({ success: true, counts });
  } catch (error) {
    console.error('Error fetching pending counts:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportPendingOrders = async (req, res) => {
  try {
    const { network } = req.body;
    if (!network) return res.status(400).json({ success: false, message: 'Network is required' });

    const adminUserId = req.user.id;
    const { batch, rows, totalItems, totalPrice } = await orderBatchService.exportPendingByNetwork(adminUserId, network);

    const worksheetData = rows.map(row => {
      let phone = row.phone || '';
      if (phone.startsWith('233')) phone = '0' + phone.substring(3);
      const volume = (row.bundle || '').replace(/[^0-9.]/g, '');
      return { 'Phone Number': phone, 'Volume (GB)': volume };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(worksheetData);
    formatOrderExportWorksheet(ws);
    xlsx.utils.book_append_sheet(wb, ws, buildSheetName(network));
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=${batch.filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting pending orders:', error);
    res.status(error.message.includes('No pending') ? 404 : 500).json({ success: false, message: error.message });
  }
};

exports.getAllBatches = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await orderBatchService.getAllBatches(parseInt(page), parseInt(limit));
    res.json({ success: true, batches: result.batches, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const batch = await orderBatchService.getBatchById(req.params.batchId);
    res.json({ success: true, batch });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBatchStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const result = await orderBatchService.updateBatchStatus(req.params.batchId, status);
    res.json(result);
  } catch (error) {
    console.error('Error updating batch status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBatchOrderItemStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const result = await orderBatchService.updateBatchOrderItemStatus(req.params.batchId, req.params.itemId, status);
    res.json(result);
  } catch (error) {
    console.error('Error updating batch item status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadBatch = async (req, res) => {
  try {
    const { batch, rows } = await orderBatchService.getBatchForDownload(req.params.batchId);

    const worksheetData = rows.map(row => {
      let phone = row.phone || '';
      if (phone.startsWith('233')) phone = '0' + phone.substring(3);
      const volume = (row.bundle || '').replace(/[^0-9.]/g, '');
      return { 'Phone Number': phone, 'Volume (GB)': volume };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(worksheetData);
    formatOrderExportWorksheet(ws);
    xlsx.utils.book_append_sheet(wb, ws, buildSheetName(batch.network));
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=${batch.filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
