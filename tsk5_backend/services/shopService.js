const prisma = require("../config/db");
const { resolvePrice } = require("../utils/priceRouter");
const { generateOrderNumber } = require("../utils/orderNumberGenerator");

// Get or create the "shop" user for guest orders
const getOrCreateShopUser = async () => {
  const shopEmail = "shop@tsk5.com";
  
  let shopUser = await prisma.user.findUnique({
    where: { email: shopEmail }
  });
  
  if (!shopUser) {
    // Create the shop user if it doesn't exist
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash("shop_user_password_secure_123", 10);
    
    shopUser = await prisma.user.create({
      data: {
        name: "Shop",
        email: shopEmail,
        password: hashedPassword,
        role: "SHOP",
        loanBalance: 999999999, // High balance for shop orders
        hasLoan: false
      }
    });
  }
  
  return shopUser;
};

// Create a shop order (for guest users)
const createShopOrder = async (productId, mobileNumber, customerName) => {
  // Get the shop user
  const shopUser = await getOrCreateShopUser();
  
  // Get the product with role prices
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { rolePrices: { select: { role: true, price: true } } },
  });
  
  if (!product) {
    throw new Error("Product not found");
  }
  
  if (!product.showInShop) {
    throw new Error("Product is not available in shop");
  }
  
  // Create the order
  const orderNumber = generateOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: shopUser.id,
      mobileNumber: mobileNumber,
      status: "Pending",
      items: {
        create: [{
          productId: productId,
          quantity: 1,
          mobileNumber: mobileNumber,
          status: "Pending",
          productName: product.name,
          productPrice: resolvePrice(product, null),
          productDescription: product.description
        }]
      }
    },
    include: {
      items: {
        include: { product: true }
      },
      user: true
    }
  });
  
  return order;
};

// Track orders by order number or mobile number (public)
const trackOrders = async ({ mobileNumber, orderNumber }) => {
  const orConditions = [];

  // Order-number (or raw ID) lookup — no date limit
  if (orderNumber) {
    const normalizedOrderNumber = orderNumber.trim().toUpperCase();
    if (normalizedOrderNumber) {
      orConditions.push({ orderNumber: normalizedOrderNumber });
    }

    const numericId = parseInt(orderNumber, 10);
    if (!isNaN(numericId)) {
      orConditions.push({ id: numericId });
    }
  }

  // Mobile-based lookup (last 7 days)
  if (mobileNumber) {
    const cleanedNumber = mobileNumber.replace(/\D/g, '');
    const phoneVariants = [cleanedNumber];

    if (cleanedNumber.startsWith('0') && cleanedNumber.length === 10) {
      phoneVariants.push(cleanedNumber.substring(1));
      phoneVariants.push('233' + cleanedNumber.substring(1));
    } else if (cleanedNumber.startsWith('233') && cleanedNumber.length === 12) {
      phoneVariants.push('0' + cleanedNumber.substring(3));
      phoneVariants.push(cleanedNumber.substring(3));
    } else if (cleanedNumber.length === 9) {
      phoneVariants.push('0' + cleanedNumber);
      phoneVariants.push('233' + cleanedNumber);
    }

    phoneVariants.forEach((variant) => {
      orConditions.push({ mobileNumber: { contains: variant } });
      orConditions.push({
        items: {
          some: {
            mobileNumber: { contains: variant }
          }
        }
      });
    });
  }

  if (orConditions.length === 0) {
    return [];
  }

  // Only apply 7-day window when we're searching by mobile (order-number searches should see all time)
  const dateFilter = mobileNumber && !orderNumber ? { createdAt: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })() } } : {};

  const orders = await prisma.order.findMany({
    where: {
      ...(Object.keys(dateFilter).length ? dateFilter : {}),
      OR: orConditions
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  // Fetch related complaints for these orders
  if (orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    const orderItemIds = orders.flatMap(o => o.items.map(i => i.id));

    const complaints = await prisma.complaint.findMany({
      where: {
        OR: [
          { orderId: { in: orderIds } },
          { orderItemId: { in: orderItemIds } }
        ]
      },
      select: {
        id: true,
        orderId: true,
        orderItemId: true,
        status: true,
        refundStatus: true,
        message: true,
        adminNotes: true,
        proofImage: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Attach complaints to their orders
    return orders.map(order => ({
      ...order,
      complaints: complaints.filter(
        c => c.orderId === order.id || (c.orderItemId && order.items.some(i => i.id === c.orderItemId))
      )
    }));
  }

  return orders;
};

module.exports = {
  getOrCreateShopUser,
  createShopOrder,
  trackOrders
};
